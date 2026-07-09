"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { isEditableKeyboardTarget } from "@/lib/keyboard";
import { getNextReview } from "@/lib/review";
import { sortDecksByRecentContent } from "@/lib/deck-activity";
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

function buildStudyQueue(
  reviews: DueReview[],
  remainingNewCards: number,
  settings: StudySettings,
) {
  return applyNewCardLimit(reviews, remainingNewCards, settings);
}

function countWaitingNewCards(reviews: DueReview[], remainingNewCards: number) {
  const newCardCount = reviews.filter(
    (review) => Number(review.review_count) === 0,
  ).length;

  return Math.max(0, newCardCount - remainingNewCards);
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
  const [decksLoaded, setDecksLoaded] = useState(!configured);
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
  const [newCardsWaiting, setNewCardsWaiting] = useState(0);
  const [scheduledReloadAt, setScheduledReloadAt] = useState<string | null>(
    null,
  );
  const [creditNotice, setCreditNotice] = useState("");
  const reloadReviewsRef = useRef<() => void>(() => {});

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

    if (!weakOnly && deckId !== allDecksValue) {
      await fetchWithAuth("/api/repair-deck-reviews", {
        method: "POST",
        body: JSON.stringify({ deckId }),
      }).catch((error) => {
        console.warn("Could not repair deck reviews", error);
      });
    }

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
    const reviewRows = (data || []) as DueReview[];

    setNewCardsStudiedToday(studiedToday);
    setNewCardsWaiting(countWaitingNewCards(reviewRows, remainingNewCards));
    setReviews(
      buildStudyQueue(
        reviewRows,
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
    reloadReviewsRef.current = () => {
      void loadReviews();
    };
  });

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase
      .from("decks")
      .select("*, cards!inner(id)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) {
          return;
        }

        const vocabularyDecks = sortDecksByRecentContent(
          (data || []) as Deck[],
          "last_card_added_at",
        );

        setDecks(vocabularyDecks);
        setSelectedDeckId((currentDeckId) => {
          if (
            currentDeckId === allDecksValue ||
            vocabularyDecks.some((deck) => deck.id === currentDeckId)
          ) {
            return currentDeckId;
          }

          window.localStorage.setItem("hanzi-study-deck-id", allDecksValue);
          return allDecksValue;
        });
        setDecksLoaded(true);
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
    if (!configured || !settingsLoaded || !decksLoaded) {
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

    const repairSelectedDeck =
      !weakOnly && selectedDeckId !== allDecksValue
        ? fetchWithAuth("/api/repair-deck-reviews", {
            method: "POST",
            body: JSON.stringify({ deckId: selectedDeckId }),
          }).catch((error) => {
            console.warn("Could not repair deck reviews", error);
          })
        : Promise.resolve();

    repairSelectedDeck.then(() =>
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

            const retryRows = (retryResult.data || []) as DueReview[];
            setNewCardsStudiedToday(studiedToday);
            setNewCardsWaiting(
              countWaitingNewCards(retryRows, remainingNewCards),
            );
            setReviews(
              buildStudyQueue(
                retryRows,
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

      const reviewRows = (data || []) as DueReview[];
      setNewCardsStudiedToday(studiedToday);
      setNewCardsWaiting(countWaitingNewCards(reviewRows, remainingNewCards));
      setReviews(
        buildStudyQueue(
          reviewRows,
          remainingNewCards,
          studySettings,
        ),
      );
      setIndex(0);
      setShowAnswer(false);
      setWritingAnswer("");
      setWritingResult("");
      setLoading(false);
      }),
    );

    return () => {
      active = false;
    };
  }, [
    configured,
    decksLoaded,
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
    const templateDeckIds = new Set(
      decks
        .filter((deck) => Boolean(deck.source_template_slug))
        .map((deck) => deck.id),
    );

    reviews.slice(index, index + 2).forEach((review) => {
      const audioData = getCardAudioData(review.cards);

      cacheAudio(audioData?.wordAudioUrl);
      cacheAudio(audioData?.sentenceAudioUrl);

      if (
        review.cards &&
        templateDeckIds.has(review.cards.deck_id) &&
        (!review.cards.word_audio_url ||
          (review.cards.example_cn && !review.cards.sentence_audio_url))
      ) {
        void ensureCardAudioForReview(review);
      }
    });
  }, [cacheAudio, decks, ensureCardAudioForReview, index, reviews]);

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

  function playVisibleAudio(audio: HTMLAudioElement | null) {
    if (!audio) {
      return;
    }

    stopCardAudio();
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
      // The click itself normally grants playback permission.
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

  function scheduleLearningStepReload(nextReviewAt: string, intervalDays: number) {
    const minutesUntilDue = Math.round(
      (new Date(nextReviewAt).getTime() - Date.now()) / 60_000,
    );

    if (intervalDays > 0 && minutesUntilDue >= 23 * 60) {
      return;
    }

    setScheduledReloadAt((currentReloadAt) => {
      if (!currentReloadAt) {
        return nextReviewAt;
      }

      return new Date(nextReviewAt).getTime() <
        new Date(currentReloadAt).getTime()
        ? nextReviewAt
        : currentReloadAt;
    });
  }

  function rate(rating: ReviewRating) {
    const current = reviews[index];
    if (!current?.cards) {
      return;
    }

    stopCardAudio();
    const wasNewCard = Number(current.review_count || 0) === 0;
    const optimisticNextReview = getNextReview(
      rating,
      current,
      new Date(),
      studySettings,
    );
    const reviewedCurrent: DueReview = {
      ...current,
      ...optimisticNextReview,
      first_reviewed_at:
        current.first_reviewed_at ||
        (wasNewCard ? new Date().toISOString() : current.first_reviewed_at),
      last_rating: rating,
      review_count: Number(current.review_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };
    const savePromise = queueReviewSave(fetchWithAuth("/api/review", {
      method: "POST",
      body: JSON.stringify({ cardId: current.cards.id, rating }),
    }), "Khong the luu ket qua on tap.");

    if (wasNewCard) {
      setNewCardsStudiedToday((currentCount) => currentCount + 1);
    }
    scheduleLearningStepReload(
      optimisticNextReview.next_review_at,
      optimisticNextReview.interval_days,
    );

    const nextIndex = index + 1;
    setShowAnswer(false);
    setWritingAnswer("");
    setWritingResult("");

    if (rating === "again") {
      const remainingReviews = [
        ...reviews.slice(0, index),
        ...reviews.slice(index + 1),
      ];

      if (remainingReviews.length > 0) {
        const requeuedReviews = [...remainingReviews, reviewedCurrent];
        setReviews(requeuedReviews);
        setIndex(Math.min(index, requeuedReviews.length - 1));
        return;
      }
    }

    if (nextIndex >= reviews.length) {
      setReviews([]);
      setIndex(0);

      if (!weakOnly && selectedDeckId !== allDecksValue) {
        void Promise.allSettled([
          ...pendingReviewSavesRef.current,
          savePromise,
        ]);
        return;
      }

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
    if (!scheduledReloadAt) {
      return;
    }

    const delayMs = Math.max(
      0,
      new Date(scheduledReloadAt).getTime() - Date.now() + 500,
    );
    const timer = window.setTimeout(() => {
      if (reviews.length > 0 || loading || repairingReviews) {
        return;
      }

      setScheduledReloadAt(null);
      setLoading(true);
      reloadReviewsRef.current();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, repairingReviews, reviews.length, scheduledReloadAt]);

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
  const scheduledLearningStepLabel = scheduledReloadAt
    ? formatReviewIntervalLabel(scheduledReloadAt, 0)
    : "";
  const waitingForLearningStep =
    Boolean(scheduledReloadAt) &&
    new Date(scheduledReloadAt || 0).getTime() > Date.now();
  const dailyLimitReached =
    !weakOnly &&
    newCardsWaiting > 0 &&
    newCardsStudiedToday >= studySettings.daily_new_card_limit;

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto min-w-0 w-full max-w-2xl">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold">Ôn tập</h1>
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
              action={
                !waitingForLearningStep && dailyLimitReached ? (
                  <Link
                    className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                    href="/options"
                  >
                    Mở cài đặt
                  </Link>
                ) : undefined
              }
              body={
                waitingForLearningStep
                  ? `Thẻ vừa bấm Quên/Khó sẽ quay lại sau ${scheduledLearningStepLabel} theo cài đặt Learning steps/Again interval.`
                  : dailyLimitReached
                  ? `Bạn đã học đủ ${studySettings.daily_new_card_limit} thẻ mới hôm nay. Còn ít nhất ${newCardsWaiting} thẻ mới đang chờ trong bộ đã chọn.`
                  : "Hiện chưa có thẻ nào cần ôn trong bộ đã chọn."
              }
              title={
                waitingForLearningStep
                  ? "Đang chờ bước lặp lại"
                  : dailyLimitReached
                  ? "Đã đạt giới hạn thẻ mới hôm nay"
                  : "Bạn đã ôn xong"
              }
            />
          ) : (
            <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="text-sm text-zinc-500">
                Thẻ {index + 1} / {reviews.length}
              </div>

              <div className="mt-4 text-center sm:mt-5">
                <div className="text-sm font-medium text-zinc-500">
                  Nghĩa tiếng Việt
                </div>
                <div className="mt-3 text-2xl font-semibold sm:text-3xl">
                  {card.meaning_vi}
                </div>
              </div>

              {!showAnswer ? (
                <div className="mt-7 sm:mt-10">
                  {writingMode ? (
                    <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 sm:p-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        Gõ chữ Hán bạn đoán
                        <input
                          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-2xl outline-none focus:border-teal-700 sm:text-3xl"
                          onChange={(event) => {
                            setWritingAnswer(event.target.value);
                            setWritingResult("");
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" &&
                              !event.nativeEvent.isComposing
                            ) {
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

                      <div className="mt-4 grid grid-cols-2 gap-2">
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
                <div className="mt-4 sm:mt-5">
                  <div className="rounded-lg bg-stone-50 p-3 text-center sm:p-4">
                    <div className="text-4xl font-semibold sm:text-5xl">{card.chinese}</div>
                    {showPinyinHint && card?.pinyin ? (
                      <div className="mt-3 text-lg text-teal-800">
                        {card?.pinyin}
                      </div>
                    ) : null}
                    {card.example_cn || card.example_pinyin || card.example_vi ? (
                      <div className="mt-4">
                        <div className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                          Câu ví dụ
                        </div>
                        {card.example_cn ? (
                          <div className="mt-2 text-lg text-zinc-900 sm:text-xl">
                            {card.example_cn}
                          </div>
                        ) : null}
                        {showPinyinHint && card.example_pinyin ? (
                          <div className="mt-1 text-sm text-teal-800">
                            {card.example_pinyin}
                          </div>
                        ) : null}
                        {card.example_vi ? (
                          <div className="mt-1 text-sm text-zinc-600">
                            {card.example_vi}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {card.word_audio_url || card.sentence_audio_url ? (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {card.word_audio_url ? (
                          <>
                            <button
                              className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                              onClick={() =>
                                playVisibleAudio(wordAudioRef.current)
                              }
                              type="button"
                            >
                              Phát âm từ
                            </button>
                            <audio
                              className="hidden"
                              onLoadedMetadata={(event) => {
                                event.currentTarget.playbackRate =
                                  audioSpeeds[audioSpeed];
                              }}
                              preload="auto"
                              ref={wordAudioRef}
                              src={card.word_audio_url}
                            />
                          </>
                        ) : null}
                        {card.sentence_audio_url ? (
                          <>
                            <button
                              className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                              onClick={() =>
                                playVisibleAudio(sentenceAudioRef.current)
                              }
                              type="button"
                            >
                              Phát câu ví dụ
                            </button>
                            <audio
                              className="hidden"
                              onLoadedMetadata={(event) => {
                                event.currentTarget.playbackRate =
                                  audioSpeeds[audioSpeed];
                              }}
                              preload="auto"
                              ref={sentenceAudioRef}
                              src={card.sentence_audio_url}
                            />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

          <div className="mt-5 border-t border-zinc-200 pt-4">
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                aria-label="Chọn bộ thẻ ôn từ"
                className="col-span-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-teal-700 sm:w-48 sm:shrink-0"
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
              <div className="col-span-2 grid h-10 w-full grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1 text-sm sm:w-40 sm:shrink-0">
                <button
                  className={`rounded px-2 py-1 font-medium transition ${
                    audioSpeed === "normal"
                      ? "bg-teal-700 text-white shadow-sm"
                      : "text-zinc-700 hover:bg-white"
                  }`}
                  onClick={() => changeAudioSpeed("normal")}
                  type="button"
                >
                  Bình thường
                </button>
                <button
                  className={`rounded px-2 py-1 font-medium transition ${
                    audioSpeed === "slow"
                      ? "bg-teal-700 text-white shadow-sm"
                      : "text-zinc-700 hover:bg-white"
                  }`}
                  onClick={() => changeAudioSpeed("slow")}
                  type="button"
                >
                  Nghe chậm
                </button>
              </div>
              <button
                aria-pressed={writingMode}
                className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-medium transition sm:w-auto sm:shrink-0 ${
                  writingMode
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
                onClick={toggleWritingMode}
                type="button"
              >
                Viết
              </button>
              <button
                aria-pressed={showPinyinHint}
                className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-medium transition sm:w-auto sm:shrink-0 ${
                  showPinyinHint
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
                onClick={togglePinyinHint}
                type="button"
              >
                Pinyin
              </button>
            </div>
            <span className="sr-only">
              Chọn Bình thường để nghe tự nhiên hoặc Chậm để nghe rõ từng âm.
              Phím P bật tắt pinyin và W bật tắt luyện viết.
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Space đáp án · R audio · 1-4 đánh giá · P/W chế độ</span>
            <Link
              className="font-medium text-teal-800 hover:underline"
              href="/shortcuts"
            >
              Hướng dẫn phím tắt
            </Link>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
