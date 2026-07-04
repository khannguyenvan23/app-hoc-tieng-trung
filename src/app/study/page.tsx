"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { isEditableKeyboardTarget } from "@/lib/keyboard";
import { getNextReview } from "@/lib/review";
import {
  defaultStudySettings,
  formatReviewIntervalLabel,
  type StudySettings,
} from "@/lib/study-settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Card, Deck, DueReview, ReviewRating } from "@/lib/types";

const allDecksValue = "all";
const audioCacheLimit = 16;

const ratingLabels: Record<ReviewRating, string> = {
  again: "Quên",
  hard: "Khó",
  good: "Nhớ",
  easy: "Dễ",
};

const audioSpeeds = {
  normal: 1,
  slow: 0.75,
} as const;

type AudioSpeed = keyof typeof audioSpeeds;

type CardAudioData = {
  wordAudioUrl: string | null;
  sentenceAudioUrl: string | null;
};

function isWeakStudyRequest() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("weak") === "1";
}

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function dueReviewCutoff() {
  return new Date(Date.now() + 60_000).toISOString();
}

function normalizeHanzi(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function shuffleReviews(reviews: DueReview[]) {
  const nextReviews = [...reviews];

  for (let index = nextReviews.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextReviews[index], nextReviews[swapIndex]] = [
      nextReviews[swapIndex],
      nextReviews[index],
    ];
  }

  return nextReviews;
}

function applyNewCardLimit(
  reviews: DueReview[],
  remainingNewCards: number,
  settings: StudySettings,
) {
  const reviewCards = reviews.filter((review) => Number(review.review_count) > 0);
  const newCardCandidates = reviews
    .filter((review) => Number(review.review_count) === 0)
    .sort(
      (left, right) =>
        new Date(left.cards?.created_at || left.next_review_at).getTime() -
        new Date(right.cards?.created_at || right.next_review_at).getTime(),
    );
  const newCards =
    settings.insertion_order === "random"
      ? shuffleReviews(newCardCandidates).slice(0, remainingNewCards)
      : newCardCandidates.slice(0, remainingNewCards);

  return [...reviewCards, ...newCards].sort(
    (left, right) =>
      new Date(left.next_review_at).getTime() -
      new Date(right.next_review_at).getTime(),
  );
}

function getRatingIntervalLabel(
  rating: ReviewRating,
  review: DueReview,
  settings: StudySettings,
) {
  const now = new Date();
  const nextReview = getNextReview(rating, review, now, settings);

  return formatReviewIntervalLabel(
    nextReview.next_review_at,
    nextReview.interval_days,
    now,
  );
}

function getCardAudioData(card: Card | null | undefined): CardAudioData | null {
  if (!card) {
    return null;
  }

  return {
    wordAudioUrl: card.word_audio_url,
    sentenceAudioUrl: card.sentence_audio_url,
  };
}

function getPreferredCardAudioUrl(audioData: CardAudioData | null) {
  return audioData?.wordAudioUrl || audioData?.sentenceAudioUrl || null;
}

export default function StudyPage() {
  const configured = hasPublicEnv();
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const transientAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const replayCardAudioRef = useRef<() => void>(() => {});
  const keyboardActionsRef = useRef<{
    replayAudio: () => void;
    showAnswer: () => void;
    togglePinyin: () => void;
    toggleWriting: () => void;
    rate: (rating: ReviewRating) => void;
  }>({
    replayAudio: () => {},
    showAnswer: () => {},
    togglePinyin: () => {},
    toggleWriting: () => {},
    rate: () => {},
  });
  const pendingCardAudioRef = useRef<Map<string, Promise<CardAudioData | null>>>(
    new Map(),
  );
  const repairingReviewsRef = useRef(false);
  const pendingReviewSavesRef = useRef<Promise<void>[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [weakOnly] = useState(() => isWeakStudyRequest());
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    if (typeof window === "undefined") {
      return allDecksValue;
    }
    if (isWeakStudyRequest()) {
      return allDecksValue;
    }
    return window.localStorage.getItem("hanzi-study-deck-id") || allDecksValue;
  });
  const [reviews, setReviews] = useState<DueReview[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyinHint, setShowPinyinHint] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("hanzi-show-pinyin") === "true";
  });
  const [loading, setLoading] = useState(configured);
  const [audioSpeed, setAudioSpeed] = useState<AudioSpeed>(() => {
    if (typeof window === "undefined") {
      return "normal";
    }
    return window.localStorage.getItem("hanzi-card-audio-speed") === "slow"
      ? "slow"
      : "normal";
  });
  const [writingMode, setWritingMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("hanzi-writing-mode") === "true";
  });
  const [writingAnswer, setWritingAnswer] = useState("");
  const [writingResult, setWritingResult] = useState<"correct" | "wrong" | "">(
    "",
  );
  const [repairingReviews, setRepairingReviews] = useState(false);
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [settingsLoaded, setSettingsLoaded] = useState(!configured);
  const [newCardsStudiedToday, setNewCardsStudiedToday] = useState(0);
  const [creditNotice, setCreditNotice] = useState("");

  const cacheAudio = useCallback(
    (audioUrl: string | null | undefined) => {
      if (!audioUrl) {
        return null;
      }

      const cache = audioCacheRef.current;
      const cachedAudio = cache.get(audioUrl);

      if (cachedAudio) {
        cachedAudio.playbackRate = audioSpeeds[audioSpeed];
        return cachedAudio;
      }

      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.playbackRate = audioSpeeds[audioSpeed];
      cache.set(audioUrl, audio);

      try {
        audio.load();
      } catch (error) {
        console.warn("Could not preload card audio", error);
      }

      if (cache.size > audioCacheLimit) {
        const oldestUrl = cache.keys().next().value;

        if (oldestUrl) {
          const oldestAudio = cache.get(oldestUrl);

          if (oldestAudio && oldestAudio !== transientAudioRef.current) {
            oldestAudio.pause();
          }

          cache.delete(oldestUrl);
        }
      }

      return audio;
    },
    [audioSpeed],
  );

  const ensureCardAudioForReview = useCallback(
    async (review: DueReview | null | undefined) => {
      const reviewCard = review?.cards;

      if (!reviewCard) {
        return null;
      }

      if (reviewCard.word_audio_url && reviewCard.sentence_audio_url) {
        const audioData = getCardAudioData(reviewCard);
        cacheAudio(audioData?.wordAudioUrl);
        cacheAudio(audioData?.sentenceAudioUrl);
        return audioData;
      }

      const pendingAudio = pendingCardAudioRef.current.get(reviewCard.id);

      if (pendingAudio) {
        return pendingAudio;
      }

      const pendingRequest = fetchWithAuth("/api/ensure-card-audio", {
        method: "POST",
        body: JSON.stringify({ cardId: reviewCard.id }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            setCreditNotice(
              getApiErrorMessage(data, "Không thể tự tạo audio cho thẻ này."),
            );
            return getCardAudioData(reviewCard);
          }

          const data = (await response.json()) as CardAudioData;
          setCreditNotice("");
          const audioData = {
            wordAudioUrl: data.wordAudioUrl || reviewCard.word_audio_url,
            sentenceAudioUrl:
              data.sentenceAudioUrl || reviewCard.sentence_audio_url,
          };

          setReviews((currentReviews) =>
            currentReviews.map((currentReview) =>
              currentReview.cards?.id === reviewCard.id
                ? {
                    ...currentReview,
                    cards: {
                      ...currentReview.cards,
                      word_audio_url: audioData.wordAudioUrl,
                      sentence_audio_url: audioData.sentenceAudioUrl,
                    },
                  }
                : currentReview,
            ),
          );
          cacheAudio(audioData.wordAudioUrl);
          cacheAudio(audioData.sentenceAudioUrl);
          return audioData;
        })
        .catch((error) => {
          console.warn("Could not ensure card audio", error);
          return getCardAudioData(reviewCard);
        })
        .finally(() => {
          pendingCardAudioRef.current.delete(reviewCard.id);
        });

      pendingCardAudioRef.current.set(reviewCard.id, pendingRequest);
      return pendingRequest;
    },
    [cacheAudio],
  );

  const getNewCardsStudiedToday = useCallback(async (deckId = selectedDeckId) => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("reviews")
      .select("id, cards!inner(id)", { count: "exact", head: true })
      .gte("first_reviewed_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      query = query.eq("cards.deck_id", deckId);
    }

    const { count, error } = await query;

    if (!error) {
      return count || 0;
    }

    let fallbackQuery = supabase
      .from("reviews")
      .select("id, cards!inner(id)", { count: "exact", head: true })
      .eq("review_count", 1)
      .gte("updated_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      fallbackQuery = fallbackQuery.eq("cards.deck_id", deckId);
    }

    const { count: fallbackCount } = await fallbackQuery;
    return fallbackCount || 0;
  }, [selectedDeckId]);

  async function loadReviews(deckId = selectedDeckId) {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const studiedToday = await getNewCardsStudiedToday(deckId);
    const remainingNewCards = Math.max(
      0,
      studySettings.daily_new_card_limit - studiedToday,
    );
    let query = supabase.from("reviews").select("*, cards!inner(*)").limit(200);

    if (weakOnly) {
      query = query
        .gte("weak_score", 2)
        .order("weak_score", { ascending: false })
        .order("next_review_at", { ascending: true });
    } else {
      query = query
        .lte("next_review_at", dueReviewCutoff())
        .order("next_review_at", { ascending: true });
    }

    if (deckId !== allDecksValue) {
      query = query.eq("cards.deck_id", deckId);
    }

    const { data } = await query;

    setNewCardsStudiedToday(studiedToday);
    setReviews(
      applyNewCardLimit(
        (data || []) as DueReview[],
        remainingNewCards,
        studySettings,
      ),
    );
    setIndex(0);
    setShowAnswer(false);
    setWritingAnswer("");
    setWritingResult("");
    setLoading(false);
  }

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase
      .from("decks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) {
          return;
        }

        setDecks((data || []) as Deck[]);
      });

    return () => {
      active = false;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;

    fetchWithAuth("/api/study-settings")
      .then(async (response) => {
        if (!active) {
          return;
        }

        if (!response.ok) {
          setSettingsLoaded(true);
          return;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setStudySettings(
          (data.settings || defaultStudySettings) as StudySettings,
        );
        setSettingsLoaded(true);
      })
      .catch(() => {
        if (active) {
          setSettingsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured || !settingsLoaded) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();
    let query = supabase.from("reviews").select("*, cards!inner(*)").limit(200);

    if (weakOnly) {
      query = query
        .gte("weak_score", 2)
        .order("weak_score", { ascending: false })
        .order("next_review_at", { ascending: true });
    } else {
      query = query
        .lte("next_review_at", dueReviewCutoff())
        .order("next_review_at", { ascending: true });
    }

    if (selectedDeckId !== allDecksValue) {
      query = query.eq("cards.deck_id", selectedDeckId);
    }

    Promise.all([query, getNewCardsStudiedToday(selectedDeckId)]).then(async ([{ data }, studiedToday]) => {
      if (!active) {
        return;
      }

      const remainingNewCards = Math.max(
        0,
        studySettings.daily_new_card_limit - studiedToday,
      );

      if (
        !weakOnly &&
        selectedDeckId !== allDecksValue &&
        (!data || data.length === 0) &&
        !repairingReviewsRef.current
      ) {
        repairingReviewsRef.current = true;
        setRepairingReviews(true);
        const repairResponse = await fetchWithAuth("/api/repair-deck-reviews", {
          method: "POST",
          body: JSON.stringify({ deckId: selectedDeckId }),
        });
        repairingReviewsRef.current = false;
        setRepairingReviews(false);

        if (!active) {
          return;
        }

        if (repairResponse.ok) {
          const repairData = await repairResponse.json();

          if ((repairData.created || 0) + (repairData.updated || 0) > 0) {
            const retryQuery = supabase
              .from("reviews")
              .select("*, cards!inner(*)")
              .lte("next_review_at", dueReviewCutoff())
              .eq("cards.deck_id", selectedDeckId)
              .order("next_review_at", { ascending: true })
              .limit(200);
            const retryResult = await retryQuery;

            if (!active) {
              return;
            }

            setNewCardsStudiedToday(studiedToday);
            setReviews(
              applyNewCardLimit(
                (retryResult.data || []) as DueReview[],
                remainingNewCards,
                studySettings,
              ),
            );
            setIndex(0);
            setShowAnswer(false);
            setWritingAnswer("");
            setWritingResult("");
            setLoading(false);
            return;
          }
        }
      }

      setNewCardsStudiedToday(studiedToday);
      setReviews(
        applyNewCardLimit(
          (data || []) as DueReview[],
          remainingNewCards,
          studySettings,
        ),
      );
      setIndex(0);
      setShowAnswer(false);
      setWritingAnswer("");
      setWritingResult("");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    configured,
    getNewCardsStudiedToday,
    selectedDeckId,
    settingsLoaded,
    studySettings,
    weakOnly,
  ]);

  useEffect(() => {
    if (wordAudioRef.current) {
      wordAudioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }

    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }

    audioCacheRef.current.forEach((audio) => {
      audio.playbackRate = audioSpeeds[audioSpeed];
    });
  }, [audioSpeed, showAnswer, index]);

  useEffect(() => {
    reviews.slice(index, index + 3).forEach((review) => {
      const audioData = getCardAudioData(review.cards);

      cacheAudio(audioData?.wordAudioUrl);
      cacheAudio(audioData?.sentenceAudioUrl);
    });
  }, [cacheAudio, index, reviews]);

  useEffect(() => {
    const audioCache = audioCacheRef.current;
    const pendingCardAudio = pendingCardAudioRef.current;

    return () => {
      audioCache.forEach((audio) => {
        audio.pause();
      });
      audioCache.clear();
      pendingCardAudio.clear();
    };
  }, []);

  function changeDeck(deckId: string) {
    setLoading(true);
    setSelectedDeckId(deckId);
    window.localStorage.setItem("hanzi-study-deck-id", deckId);
  }

  function changeAudioSpeed(nextSpeed: AudioSpeed) {
    setAudioSpeed(nextSpeed);
    window.localStorage.setItem("hanzi-card-audio-speed", nextSpeed);

    if (wordAudioRef.current) {
      wordAudioRef.current.playbackRate = audioSpeeds[nextSpeed];
    }

    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.playbackRate = audioSpeeds[nextSpeed];
    }

    audioCacheRef.current.forEach((audio) => {
      audio.playbackRate = audioSpeeds[nextSpeed];
    });
  }

  function togglePinyinHint() {
    const nextValue = !showPinyinHint;
    setShowPinyinHint(nextValue);
    window.localStorage.setItem("hanzi-show-pinyin", String(nextValue));
  }

  function toggleWritingMode() {
    const nextValue = !writingMode;
    setWritingMode(nextValue);
    setWritingAnswer("");
    setWritingResult("");
    window.localStorage.setItem("hanzi-writing-mode", String(nextValue));
  }

  async function ensureCardAudio() {
    return ensureCardAudioForReview(current);
  }

  async function playCardAudio() {
    let audioData = getCardAudioData(card);
    let audioUrl = getPreferredCardAudioUrl(audioData);

    if (!audioUrl) {
      audioData = await ensureCardAudio();
      audioUrl = getPreferredCardAudioUrl(audioData);
    }

    if (!audioUrl) {
      return;
    }

    stopCardAudio();
    const audio = cacheAudio(audioUrl) || new Audio(audioUrl);
    transientAudioRef.current = audio;
    audio.playbackRate = audioSpeeds[audioSpeed];
    try {
      if (audio.readyState > 0) {
        audio.currentTime = 0;
      }
    } catch (error) {
      console.warn("Could not rewind card audio", error);
    }
    audio.play().catch(() => {
      // Some browsers may still block autoplay if the click gesture is lost.
    });
  }

  useEffect(() => {
    replayCardAudioRef.current = () => {
      void playCardAudio();
    };
  });

  useEffect(() => {
    function handleStudyShortcut(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const ratingByKey: Partial<Record<string, ReviewRating>> = {
        "1": "again",
        "2": "hard",
        "3": "good",
        "4": "easy",
      };
      const rating = ratingByKey[key];

      if (key === "r") {
        event.preventDefault();
        keyboardActionsRef.current.replayAudio();
      } else if (event.key === " ") {
        event.preventDefault();
        keyboardActionsRef.current.showAnswer();
      } else if (key === "p") {
        event.preventDefault();
        keyboardActionsRef.current.togglePinyin();
      } else if (key === "w") {
        event.preventDefault();
        keyboardActionsRef.current.toggleWriting();
      } else if (rating) {
        event.preventDefault();
        keyboardActionsRef.current.rate(rating);
      }
    }

    window.addEventListener("keydown", handleStudyShortcut);

    return () => {
      window.removeEventListener("keydown", handleStudyShortcut);
    };
  }, []);

  function stopCardAudio() {
    [wordAudioRef.current, sentenceAudioRef.current, transientAudioRef.current].forEach(
      (audio) => {
        if (!audio) {
          return;
        }

        try {
          audio.pause();
          if (audio.readyState > 0) {
            audio.currentTime = 0;
          }
        } catch (error) {
          console.warn("Could not stop card audio", error);
        }
      },
    );
    transientAudioRef.current = null;
  }

  function showAnswerAndPlayAudio() {
    setShowAnswer(true);
    playCardAudio();
  }

  function checkWritingAnswer() {
    if (!card) {
      return;
    }

    const expected = normalizeHanzi(card.chinese);
    const actual = normalizeHanzi(writingAnswer);

    if (actual && actual === expected) {
      setWritingResult("correct");
      showAnswerAndPlayAudio();
      return;
    }

    setWritingResult("wrong");
  }

  function queueReviewSave(promise: Promise<Response>, errorMessage: string) {
    const trackedPromise = promise
      .then((response) => {
        if (!response.ok) {
          throw new Error(errorMessage);
        }
      })
      .catch((error) => {
        console.error(error);
        alert(errorMessage);
      });

    pendingReviewSavesRef.current.push(trackedPromise);
    trackedPromise.finally(() => {
      pendingReviewSavesRef.current = pendingReviewSavesRef.current.filter(
        (item) => item !== trackedPromise,
      );
    });

    return trackedPromise;
  }

  function rate(rating: ReviewRating) {
    const current = reviews[index];
    if (!current?.cards) {
      return;
    }

    stopCardAudio();
    const savePromise = queueReviewSave(fetchWithAuth("/api/review", {
      method: "POST",
      body: JSON.stringify({ cardId: current.cards.id, rating }),
    }), "Khong the luu ket qua on tap.");

    const nextIndex = index + 1;
    setShowAnswer(false);
    setWritingAnswer("");
    setWritingResult("");

    if (rating === "again") {
      const requeuedReviews = [
        ...reviews.slice(0, index),
        ...reviews.slice(index + 1),
        current,
      ];
      setReviews(requeuedReviews);
      setIndex(Math.min(index, Math.max(0, requeuedReviews.length - 1)));
      return;
    }

    if (nextIndex >= reviews.length) {
      setReviews([]);
      setIndex(0);
      setLoading(true);
      void Promise.allSettled([
        ...pendingReviewSavesRef.current,
        savePromise,
      ]).finally(() => {
        void loadReviews();
      });
    } else {
      setIndex(nextIndex);
    }
  }

  useEffect(() => {
    keyboardActionsRef.current = {
      replayAudio: () => {
        if (showAnswer) {
          void playCardAudio();
        }
      },
      showAnswer: showAnswerAndPlayAudio,
      togglePinyin: togglePinyinHint,
      toggleWriting: toggleWritingMode,
      rate: (rating) => {
        if (showAnswer) {
          rate(rating);
        }
      },
    };
  });

  const current = reviews[index];
  const card = current?.cards;
  const selectedDeckName =
    selectedDeckId === allDecksValue
      ? "Tất cả"
      : decks.find((deck) => deck.id === selectedDeckId)?.name || "Deck đã chọn";

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Ôn tập</h1>
              <p className="mt-1 text-sm text-zinc-600">
                {reviews.length} thẻ cần ôn ngay trong {selectedDeckName}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Từ mới hôm nay: {newCardsStudiedToday} /{" "}
                {studySettings.daily_new_card_limit}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <select
                className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-700"
                onChange={(event) => changeDeck(event.target.value)}
                value={selectedDeckId}
              >
                <option value={allDecksValue}>Tất cả bộ thẻ</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 rounded-md border border-zinc-300 p-1 text-sm">
                <button
                  className={`rounded px-3 py-2 ${
                    audioSpeed === "normal"
                      ? "bg-teal-700 text-white"
                      : "hover:bg-zinc-100"
                  }`}
                  onClick={() => changeAudioSpeed("normal")}
                  type="button"
                >
                  Bình thường
                </button>
                <button
                  className={`rounded px-3 py-2 ${
                    audioSpeed === "slow"
                      ? "bg-teal-700 text-white"
                      : "hover:bg-zinc-100"
                  }`}
                  onClick={() => changeAudioSpeed("slow")}
                  type="button"
                >
                  Chậm
                </button>
              </div>
              <button
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  writingMode
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
                onClick={toggleWritingMode}
                type="button"
              >
                {writingMode ? "Đang luyện viết" : "Bật luyện viết"}
              </button>
              <button
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  showPinyinHint
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
                onClick={togglePinyinHint}
                type="button"
              >
                {showPinyinHint ? "Tắt pinyin" : "Bật pinyin"}
              </button>
              <p className="basis-full text-left text-xs text-zinc-500 sm:text-right">
                Tốc độ audio: chọn Bình thường để nghe tự nhiên, Chậm để nghe rõ từng âm. Space hiện đáp án; sau khi hiện đáp án dùng R audio, 1-4 đánh giá. P pinyin, W luyện viết.
              </p>
            </div>
          </div>

          {creditNotice ? (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
              <div>{creditNotice}</div>
              <Link
                className="mt-2 inline-flex font-medium text-red-900 underline"
                href="/pricing"
              >
                Xem bảng giá và nạp credit
              </Link>
            </div>
          ) : null}

          {loading || repairingReviews ? (
            <p className="text-sm text-zinc-600">
              {repairingReviews ? "Đang kiểm tra lịch ôn..." : "Đang tải thẻ..."}
            </p>
          ) : !card ? (
            <EmptyState
              body="Hiện chưa có thẻ nào cần ôn trong bộ đã chọn."
              title="Bạn đã ôn xong"
            />
          ) : (
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-zinc-500">
                Thẻ {index + 1} / {reviews.length}
              </div>

              <div className="mt-8 text-center">
                <div className="text-sm font-medium text-zinc-500">
                  Nghĩa tiếng Việt
                </div>
                <div className="mt-3 text-3xl font-semibold">
                  {card.meaning_vi}
                </div>
              </div>

              {!showAnswer ? (
                <div className="mt-10">
                  {writingMode ? (
                    <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        Gõ chữ Hán bạn đoán
                        <input
                          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-3xl outline-none focus:border-teal-700"
                          onChange={(event) => {
                            setWritingAnswer(event.target.value);
                            setWritingResult("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              checkWritingAnswer();
                            }
                          }}
                          placeholder="输入汉字"
                          value={writingAnswer}
                        />
                      </label>

                      {writingResult === "correct" ? (
                        <p className="mt-3 text-sm font-medium text-teal-700">
                          Đúng rồi.
                        </p>
                      ) : null}
                      {writingResult === "wrong" ? (
                        <p className="mt-3 text-sm font-medium text-red-700">
                          Chưa đúng, thử lại hoặc hiện đáp án.
                        </p>
                      ) : null}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button
                          className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                          onClick={checkWritingAnswer}
                          type="button"
                        >
                          Kiểm tra
                        </button>
                        <button
                          className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                          onClick={showAnswerAndPlayAudio}
                          type="button"
                        >
                          Hiện đáp án
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                      onClick={showAnswerAndPlayAudio}
                      type="button"
                    >
                      Hiện đáp án
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-8">
                  <div className="rounded-lg bg-stone-50 p-5 text-center">
                    <div className="text-5xl font-semibold">{card.chinese}</div>
                    {showPinyinHint && card?.pinyin ? (
                      <div className="mt-3 text-lg text-teal-800">
                        {card?.pinyin}
                      </div>
                    ) : null}
                    <div className="mt-6 text-sm font-medium uppercase tracking-wide text-zinc-500">
                      Câu ví dụ
                    </div>
                    <div className="mt-2 text-xl text-zinc-900">
                      {card.example_cn}
                    </div>
                    {showPinyinHint && card.example_pinyin ? (
                      <div className="mt-1 text-sm text-teal-800">
                        {card.example_pinyin}
                      </div>
                    ) : null}
                    <div className="mt-1 text-sm text-zinc-600">
                      {card.example_vi}
                    </div>
                    <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                      {card.word_audio_url ? (
                        <audio
                          controls
                          onLoadedMetadata={(event) => {
                            event.currentTarget.playbackRate =
                              audioSpeeds[audioSpeed];
                          }}
                          preload="auto"
                          ref={wordAudioRef}
                          src={card.word_audio_url}
                        />
                      ) : null}
                      {card.sentence_audio_url ? (
                        <audio
                          controls
                          onLoadedMetadata={(event) => {
                            event.currentTarget.playbackRate =
                              audioSpeeds[audioSpeed];
                          }}
                          preload="auto"
                          ref={sentenceAudioRef}
                          src={card.sentence_audio_url}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(ratingLabels) as ReviewRating[]).map(
                      (rating) => (
                        <button
                          className="min-h-14 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
                          key={rating}
                          onClick={() => rate(rating)}
                          type="button"
                        >
                          <span className="block font-medium">
                            {ratingLabels[rating]}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            Lặp lại sau{" "}
                            {getRatingIntervalLabel(
                              rating,
                              current,
                              studySettings,
                            )}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
