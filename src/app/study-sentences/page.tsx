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
  compareChineseSentences,
  type SentenceDiffItem,
  type SentenceDiffResult,
  type SentenceDiffStatus,
} from "@/lib/sentence-diff";
import {
  defaultStudySettings,
  formatReviewIntervalLabel,
  type StudySettings,
} from "@/lib/study-settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Deck,
  DueSentenceReview,
  ReviewRating,
  SentenceCard,
} from "@/lib/types";

const allDecksValue = "all";
const audioCacheLimit = 16;

const ratingLabels: Record<ReviewRating, string> = {
  again: "Quên",
  hard: "Khó",
  good: "Nhớ",
  easy: "Dễ",
};

const sentenceDiffLabels: Record<SentenceDiffStatus, string> = {
  correct: "Đúng",
  wrong: "Sai",
  missing: "Bỏ trống",
  extra: "Thừa",
};

const sentenceDiffStyles: Record<SentenceDiffStatus, string> = {
  correct: "border-teal-200 bg-teal-50 text-teal-900",
  wrong: "border-red-200 bg-red-50 text-red-900",
  missing: "border-amber-200 bg-amber-50 text-amber-900",
  extra: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

const audioSpeeds = {
  normal: 1,
  slow: 0.75,
} as const;

type AudioSpeed = keyof typeof audioSpeeds;

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

function shuffleSentenceReviews(reviews: DueSentenceReview[]) {
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

function applyNewSentenceLimit(
  reviews: DueSentenceReview[],
  remainingNewSentences: number,
  settings: StudySettings,
) {
  const reviewSentences = reviews.filter(
    (review) => Number(review.review_count) > 0,
  );
  const newSentenceCandidates = reviews
    .filter((review) => Number(review.review_count) === 0)
    .sort(
      (left, right) =>
        new Date(
          left.sentence_cards?.created_at || left.next_review_at,
        ).getTime() -
        new Date(
          right.sentence_cards?.created_at || right.next_review_at,
        ).getTime(),
    );
  const newSentences =
    settings.insertion_order === "random"
      ? shuffleSentenceReviews(newSentenceCandidates).slice(
          0,
          remainingNewSentences,
        )
      : newSentenceCandidates.slice(0, remainingNewSentences);

  return [...reviewSentences, ...newSentences].sort(
    (left, right) =>
      new Date(left.next_review_at).getTime() -
      new Date(right.next_review_at).getTime(),
  );
}

function getRatingIntervalLabel(
  rating: ReviewRating,
  review: DueSentenceReview,
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

function getSentenceAudioUrl(card: SentenceCard | null | undefined) {
  return card?.sentence_audio_url || null;
}

type SentenceAudioData = {
  sentenceAudioUrl: string | null;
};

function SentenceDiffToken({ item }: { item: SentenceDiffItem }) {
  return (
    <div
      className={`min-w-16 rounded-md border px-3 py-2 text-center ${sentenceDiffStyles[item.status]}`}
    >
      <div className="flex items-center justify-center gap-1 text-lg font-semibold">
        {item.status === "wrong" ? (
          <>
            <span className="line-through opacity-70">{item.actual}</span>
            <span aria-hidden="true">→</span>
            <span>{item.expected}</span>
          </>
        ) : (
          <span className={item.status === "extra" ? "line-through" : ""}>
            {item.actual || item.expected}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs font-medium">
        {sentenceDiffLabels[item.status]}
      </div>
    </div>
  );
}

export default function StudySentencesPage() {
  const configured = hasPublicEnv();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transientAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const replaySentenceAudioRef = useRef<() => void>(() => {});
  const pendingSentenceAudioRef = useRef<Map<string, Promise<string | null>>>(
    new Map(),
  );
  const keyboardActionsRef = useRef<{
    replayAudio: () => void;
    showAnswer: () => void;
    togglePinyin: () => void;
    toggleWriting: () => void;
    toggleDictation: () => void;
    rate: (rating: ReviewRating) => void;
  }>({
    replayAudio: () => {},
    showAnswer: () => {},
    togglePinyin: () => {},
    toggleWriting: () => {},
    toggleDictation: () => {},
    rate: () => {},
  });
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
    return (
      window.localStorage.getItem("hanzi-sentence-study-deck-id") ||
      allDecksValue
    );
  });
  const [reviews, setReviews] = useState<DueSentenceReview[]>([]);
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
    return window.localStorage.getItem("hanzi-sentence-audio-speed") === "slow"
      ? "slow"
      : "normal";
  });
  const [writingMode, setWritingMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("hanzi-sentence-writing-mode") === "true";
  });
  const [dictationMode, setDictationMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("hanzi-sentence-dictation-mode") === "true";
  });
  const [showDictationMeaning, setShowDictationMeaning] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      window.localStorage.getItem("hanzi-sentence-dictation-meaning") === "true"
    );
  });
  const [sentenceAnswer, setSentenceAnswer] = useState("");
  const [writingResult, setWritingResult] = useState<"correct" | "wrong" | "">(
    "",
  );
  const [sentenceDiff, setSentenceDiff] = useState<SentenceDiffResult | null>(
    null,
  );
  const [repairingReviews, setRepairingReviews] = useState(false);
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [settingsLoaded, setSettingsLoaded] = useState(!configured);
  const [newSentencesStudiedToday, setNewSentencesStudiedToday] = useState(0);
  const [audioNotice, setAudioNotice] = useState("");
  const [creatingAudioId, setCreatingAudioId] = useState<string | null>(null);

  const cacheSentenceAudio = useCallback(
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
        console.warn("Could not preload sentence audio", error);
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

  const ensureSentenceAudioForCard = useCallback(
    async (sentenceCard: SentenceCard | null | undefined) => {
      if (!sentenceCard) {
        return null;
      }

      if (sentenceCard.sentence_audio_url) {
        cacheSentenceAudio(sentenceCard.sentence_audio_url);
        return sentenceCard.sentence_audio_url;
      }

      const pendingAudio = pendingSentenceAudioRef.current.get(sentenceCard.id);

      if (pendingAudio) {
        return pendingAudio;
      }

      setCreatingAudioId(sentenceCard.id);

      const pendingRequest = fetchWithAuth("/api/ensure-sentence-audio", {
        method: "POST",
        body: JSON.stringify({ sentenceCardId: sentenceCard.id }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            setAudioNotice(
              getApiErrorMessage(data, "Không thể tự tạo audio cho câu này."),
            );
            return sentenceCard.sentence_audio_url;
          }

          const data = (await response.json()) as SentenceAudioData;
          const sentenceAudioUrl =
            data.sentenceAudioUrl || sentenceCard.sentence_audio_url;

          setAudioNotice("");

          if (sentenceAudioUrl) {
            setReviews((currentReviews) =>
              currentReviews.map((currentReview) =>
                currentReview.sentence_cards?.id === sentenceCard.id
                  ? {
                      ...currentReview,
                      sentence_cards: {
                        ...currentReview.sentence_cards,
                        sentence_audio_url: sentenceAudioUrl,
                      },
                    }
                  : currentReview,
              ),
            );
            cacheSentenceAudio(sentenceAudioUrl);
          }

          return sentenceAudioUrl;
        })
        .catch((error) => {
          console.warn("Could not ensure sentence audio", error);
          setAudioNotice("Không thể tự tạo audio cho câu này.");
          return sentenceCard.sentence_audio_url;
        })
        .finally(() => {
          pendingSentenceAudioRef.current.delete(sentenceCard.id);
          setCreatingAudioId((currentId) =>
            currentId === sentenceCard.id ? null : currentId,
          );
        });

      pendingSentenceAudioRef.current.set(sentenceCard.id, pendingRequest);
      return pendingRequest;
    },
    [cacheSentenceAudio],
  );

  const getNewSentencesStudiedToday = useCallback(async (deckId = selectedDeckId) => {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("sentence_reviews")
      .select("id, sentence_cards!inner(id)", { count: "exact", head: true })
      .gte("first_reviewed_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      query = query.eq("sentence_cards.deck_id", deckId);
    }

    const { count, error } = await query;

    if (!error) {
      return count || 0;
    }

    let fallbackQuery = supabase
      .from("sentence_reviews")
      .select("id, sentence_cards!inner(id)", { count: "exact", head: true })
      .eq("review_count", 1)
      .gte("updated_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      fallbackQuery = fallbackQuery.eq("sentence_cards.deck_id", deckId);
    }

    const { count: fallbackCount } = await fallbackQuery;
    return fallbackCount || 0;
  }, [selectedDeckId]);

  async function loadReviews(deckId = selectedDeckId) {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const studiedToday = await getNewSentencesStudiedToday(deckId);
    const remainingNewSentences = Math.max(
      0,
      studySettings.daily_new_sentence_limit - studiedToday,
    );
    let query = supabase
      .from("sentence_reviews")
      .select("*, sentence_cards!inner(*)")
      .limit(200);

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
      query = query.eq("sentence_cards.deck_id", deckId);
    }

    const { data } = await query;

    setNewSentencesStudiedToday(studiedToday);
    setReviews(
      applyNewSentenceLimit(
        (data || []) as DueSentenceReview[],
        remainingNewSentences,
        studySettings,
      ),
    );
    setIndex(0);
    setShowAnswer(false);
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);
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
      .select("*, sentence_cards!inner(id)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) {
          return;
        }

        const sentenceDecks = (data || []) as Deck[];

        setDecks(sentenceDecks);
        setSelectedDeckId((currentDeckId) => {
          if (
            currentDeckId === allDecksValue ||
            sentenceDecks.some((deck) => deck.id === currentDeckId)
          ) {
            return currentDeckId;
          }

          window.localStorage.setItem(
            "hanzi-sentence-study-deck-id",
            allDecksValue,
          );
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
    let query = supabase
      .from("sentence_reviews")
      .select("*, sentence_cards!inner(*)")
      .limit(200);

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
      query = query.eq("sentence_cards.deck_id", selectedDeckId);
    }

    Promise.all([query, getNewSentencesStudiedToday(selectedDeckId)]).then(
      async ([{ data }, studiedToday]) => {
      if (!active) {
        return;
      }

      const remainingNewSentences = Math.max(
        0,
        studySettings.daily_new_sentence_limit - studiedToday,
      );

      if (
        !weakOnly &&
        selectedDeckId !== allDecksValue &&
        (!data || data.length === 0) &&
        !repairingReviewsRef.current
      ) {
        repairingReviewsRef.current = true;
        setRepairingReviews(true);
        const repairResponse = await fetchWithAuth(
          "/api/repair-sentence-deck-reviews",
          {
            method: "POST",
            body: JSON.stringify({ deckId: selectedDeckId }),
          },
        );
        repairingReviewsRef.current = false;
        setRepairingReviews(false);

        if (!active) {
          return;
        }

        if (repairResponse.ok) {
          const repairData = await repairResponse.json();

          if ((repairData.created || 0) + (repairData.updated || 0) > 0) {
            const retryResult = await supabase
              .from("sentence_reviews")
              .select("*, sentence_cards!inner(*)")
              .lte("next_review_at", dueReviewCutoff())
              .eq("sentence_cards.deck_id", selectedDeckId)
              .order("next_review_at", { ascending: true })
              .limit(200);

            if (!active) {
              return;
            }

            setNewSentencesStudiedToday(studiedToday);
            setReviews(
              applyNewSentenceLimit(
                (retryResult.data || []) as DueSentenceReview[],
                remainingNewSentences,
                studySettings,
              ),
            );
            setIndex(0);
            setShowAnswer(false);
            setSentenceAnswer("");
            setWritingResult("");
            setSentenceDiff(null);
            setLoading(false);
            return;
          }
        }
      }

      setNewSentencesStudiedToday(studiedToday);
      setReviews(
        applyNewSentenceLimit(
          (data || []) as DueSentenceReview[],
          remainingNewSentences,
          studySettings,
        ),
      );
      setIndex(0);
      setShowAnswer(false);
      setSentenceAnswer("");
      setWritingResult("");
      setSentenceDiff(null);
      setLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [
    configured,
    decksLoaded,
    getNewSentencesStudiedToday,
    selectedDeckId,
    settingsLoaded,
    studySettings,
    weakOnly,
  ]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }

    audioCacheRef.current.forEach((audio) => {
      audio.playbackRate = audioSpeeds[audioSpeed];
    });
  }, [audioSpeed, showAnswer, index]);

  useEffect(() => {
    reviews.slice(index, index + 3).forEach((review) => {
      cacheSentenceAudio(getSentenceAudioUrl(review.sentence_cards));
    });
  }, [cacheSentenceAudio, index, reviews]);

  useEffect(() => {
    const audioCache = audioCacheRef.current;
    const pendingSentenceAudio = pendingSentenceAudioRef.current;

    return () => {
      audioCache.forEach((audio) => {
        audio.pause();
      });
      audioCache.clear();
      pendingSentenceAudio.clear();
    };
  }, []);

  function changeDeck(deckId: string) {
    setLoading(true);
    setSelectedDeckId(deckId);
    window.localStorage.setItem("hanzi-sentence-study-deck-id", deckId);
  }

  function changeAudioSpeed(nextSpeed: AudioSpeed) {
    setAudioSpeed(nextSpeed);
    window.localStorage.setItem("hanzi-sentence-audio-speed", nextSpeed);

    if (audioRef.current) {
      audioRef.current.playbackRate = audioSpeeds[nextSpeed];
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
    if (nextValue) {
      setDictationMode(false);
      window.localStorage.setItem("hanzi-sentence-dictation-mode", "false");
    }
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);
    window.localStorage.setItem("hanzi-sentence-writing-mode", String(nextValue));
  }

  function toggleDictationMode() {
    const nextValue = !dictationMode;
    stopSentenceAudio();
    setDictationMode(nextValue);
    setShowAnswer(false);
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);

    if (nextValue) {
      setWritingMode(false);
      window.localStorage.setItem("hanzi-sentence-writing-mode", "false");
    }

    window.localStorage.setItem(
      "hanzi-sentence-dictation-mode",
      String(nextValue),
    );
  }

  function toggleDictationMeaning() {
    const nextValue = !showDictationMeaning;
    setShowDictationMeaning(nextValue);
    window.localStorage.setItem(
      "hanzi-sentence-dictation-meaning",
      String(nextValue),
    );
  }

  async function playSentenceAudio() {
    let audioUrl = getSentenceAudioUrl(card);

    if (!audioUrl) {
      audioUrl = await ensureSentenceAudioForCard(card);
    }

    if (!audioUrl) {
      return;
    }

    stopSentenceAudio();
    const audio = cacheSentenceAudio(audioUrl) || new Audio(audioUrl);
    transientAudioRef.current = audio;
    audio.playbackRate = audioSpeeds[audioSpeed];
    try {
      if (audio.readyState > 0) {
        audio.currentTime = 0;
      }
    } catch (error) {
      console.warn("Could not rewind sentence audio", error);
    }
    audio.play().catch(() => {
      // Browsers can block autoplay if the click gesture is lost.
    });
  }

  useEffect(() => {
    replaySentenceAudioRef.current = () => {
      void playSentenceAudio();
    };
  });

  useEffect(() => {
    let controlPressedAlone = false;

    function handleStudyShortcut(event: KeyboardEvent) {
      if (event.key === "Control") {
        if (!event.repeat) {
          controlPressedAlone = true;
        }
        return;
      }

      if (event.ctrlKey) {
        controlPressedAlone = false;
      }

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
      } else if (key === "d") {
        event.preventDefault();
        keyboardActionsRef.current.toggleDictation();
      } else if (rating) {
        event.preventDefault();
        keyboardActionsRef.current.rate(rating);
      }
    }

    function handleStudyShortcutKeyUp(event: KeyboardEvent) {
      if (event.key !== "Control") {
        return;
      }

      if (controlPressedAlone) {
        event.preventDefault();
        keyboardActionsRef.current.replayAudio();
      }

      controlPressedAlone = false;
    }

    function resetControlShortcut() {
      controlPressedAlone = false;
    }

    window.addEventListener("keydown", handleStudyShortcut);
    window.addEventListener("keyup", handleStudyShortcutKeyUp);
    window.addEventListener("blur", resetControlShortcut);

    return () => {
      window.removeEventListener("keydown", handleStudyShortcut);
      window.removeEventListener("keyup", handleStudyShortcutKeyUp);
      window.removeEventListener("blur", resetControlShortcut);
    };
  }, []);

  function stopSentenceAudio() {
    [audioRef.current, transientAudioRef.current].forEach((audio) => {
      if (!audio) {
        return;
      }

      try {
        audio.pause();
        if (audio.readyState > 0) {
          audio.currentTime = 0;
        }
      } catch (error) {
        console.warn("Could not stop sentence audio", error);
      }
    });
    transientAudioRef.current = null;
  }

  function showAnswerAndPlayAudio() {
    setShowAnswer(true);
    void playSentenceAudio();
  }

  function checkSentenceAnswer() {
    if (!card) {
      return;
    }

    const comparison = compareChineseSentences(
      card.sentence_cn,
      sentenceAnswer,
    );
    const hasAnswer = comparison.items.some((item) => item.actual);
    const hasMistake =
      comparison.counts.wrong > 0 ||
      comparison.counts.missing > 0 ||
      comparison.counts.extra > 0;

    setSentenceDiff(comparison);

    if (hasAnswer && !hasMistake) {
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
    if (!current?.sentence_cards) {
      return;
    }

    stopSentenceAudio();
    const savePromise = queueReviewSave(
      fetchWithAuth("/api/review-sentence", {
        method: "POST",
        body: JSON.stringify({
          sentenceCardId: current.sentence_cards.id,
          rating,
        }),
      }),
      "Khong the luu ket qua luyen cau.",
    );

    const nextIndex = index + 1;
    setShowAnswer(false);
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);

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
        if (showAnswer || dictationMode) {
          void playSentenceAudio();
        }
      },
      showAnswer: showAnswerAndPlayAudio,
      togglePinyin: togglePinyinHint,
      toggleWriting: toggleWritingMode,
      toggleDictation: toggleDictationMode,
      rate: (rating) => {
        if (showAnswer) {
          rate(rating);
        }
      },
    };
  });

  const current = reviews[index];
  const card = current?.sentence_cards;
  const currentCardId = card?.id;

  useEffect(() => {
    if (!dictationMode || showAnswer || !currentCardId) {
      return;
    }

    const playTimer = window.setTimeout(() => {
      replaySentenceAudioRef.current();
    }, 0);

    return () => {
      window.clearTimeout(playTimer);
    };
  }, [currentCardId, dictationMode, showAnswer]);

  const vocabItems = Array.isArray(card?.vocab_json) ? card.vocab_json : [];
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
              <h1 className="text-2xl font-semibold">Luyện câu</h1>
              <p className="mt-1 text-sm text-zinc-600">
                {reviews.length} câu cần ôn ngay trong {selectedDeckName}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Câu mới hôm nay: {newSentencesStudiedToday} /{" "}
                {studySettings.daily_new_sentence_limit}
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
                  dictationMode
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
                onClick={toggleDictationMode}
                type="button"
              >
                {dictationMode ? "Đang chính tả" : "Bật chính tả"}
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
                Tốc độ audio: chọn Bình thường để nghe tự nhiên, Chậm để nghe rõ từng âm. Ctrl hoặc R phát audio; Space hiện đáp án, kể cả khi đang gõ. 1-4 đánh giá, P pinyin, W luyện viết, D chính tả.
              </p>
              {audioNotice ? (
                <p className="basis-full text-left text-xs text-red-700 sm:text-right">
                  {audioNotice}{" "}
                  <Link className="font-medium underline" href="/pricing">
                    Nạp credit
                  </Link>
                </p>
              ) : null}
            </div>
          </div>

          {loading || repairingReviews ? (
            <p className="text-sm text-zinc-600">
              {repairingReviews ? "Đang kiểm tra lịch ôn câu..." : "Đang tải câu..."}
            </p>
          ) : !card ? (
            <EmptyState
              body="Hiện chưa có câu nào cần ôn trong bộ đã chọn."
              title="Bạn đã luyện xong"
            />
          ) : (
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-zinc-500">
                Câu {index + 1} / {reviews.length}
              </div>

              <div className="mt-8 text-center">
                {dictationMode && !showAnswer ? (
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Luyện chính tả
                    </div>
                    <div className="mt-3 text-2xl font-semibold leading-tight">
                      Nghe và chép lại câu tiếng Trung
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <button
                        className="min-h-10 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
                        disabled={creatingAudioId === card.id}
                        onClick={() => void playSentenceAudio()}
                        type="button"
                      >
                        {creatingAudioId === card.id
                          ? "Đang tạo audio..."
                          : "Phát lại audio"}
                      </button>
                      <button
                        className={`min-h-10 rounded-md border px-4 py-2 text-sm font-medium ${
                          showDictationMeaning
                            ? "border-teal-700 bg-teal-50 text-teal-800"
                            : "border-zinc-300 hover:bg-zinc-100"
                        }`}
                        onClick={toggleDictationMeaning}
                        type="button"
                      >
                        {showDictationMeaning
                          ? "Tắt nghĩa Việt"
                          : "Bật nghĩa Việt"}
                      </button>
                    </div>
                    {showDictationMeaning ? (
                      <div className="mx-auto mt-5 max-w-xl rounded-md bg-stone-50 px-4 py-3">
                        <div className="text-xs font-medium uppercase text-zinc-500">
                          Nghĩa tiếng Việt
                        </div>
                        <div className="mt-1 text-lg font-medium text-zinc-800">
                          {card.sentence_vi}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Câu tiếng Việt
                    </div>
                    <div className="mt-3 text-3xl font-semibold leading-tight">
                      {card.sentence_vi}
                    </div>
                  </div>
                )}
              </div>

              {!showAnswer ? (
                <div className="mt-10">
                  {writingMode || dictationMode ? (
                    <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        {dictationMode
                          ? "Gõ lại câu tiếng Trung vừa nghe"
                          : "Gõ câu tiếng Trung"}
                        <textarea
                          className="mt-2 h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-2xl leading-relaxed outline-none focus:border-teal-700"
                          onChange={(event) => {
                            setSentenceAnswer(event.target.value);
                            setWritingResult("");
                            setSentenceDiff(null);
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key === " " &&
                              !event.nativeEvent.isComposing
                            ) {
                              event.preventDefault();
                              showAnswerAndPlayAudio();
                              return;
                            }

                            if (event.key === "Enter" && event.ctrlKey) {
                              event.preventDefault();
                              checkSentenceAnswer();
                            }
                          }}
                          placeholder="输入完整句子"
                          value={sentenceAnswer}
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

                      {writingResult === "wrong" && sentenceDiff ? (
                        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-zinc-900">
                              Kết quả từng từ
                            </h3>
                            <p className="text-xs text-zinc-500">
                              Đúng {sentenceDiff.counts.correct} · Sai{" "}
                              {sentenceDiff.counts.wrong} · Bỏ trống{" "}
                              {sentenceDiff.counts.missing} · Thừa{" "}
                              {sentenceDiff.counts.extra}
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {sentenceDiff.items.map((item, itemIndex) => (
                              <SentenceDiffToken
                                item={item}
                                key={`${item.status}-${itemIndex}-${item.actual || ""}-${item.expected || ""}`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button
                          className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                          onClick={checkSentenceAnswer}
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
                    <div className="text-3xl font-semibold leading-relaxed">
                      {card.sentence_cn}
                    </div>
                    {showPinyinHint && card.sentence_pinyin ? (
                      <div className="mt-3 text-base text-teal-800">
                        {card.sentence_pinyin}
                      </div>
                    ) : null}

                    {card.sentence_audio_url ? (
                      <div className="mt-5 flex justify-center">
                        <audio
                          controls
                          onLoadedMetadata={(event) => {
                            event.currentTarget.playbackRate =
                              audioSpeeds[audioSpeed];
                          }}
                          preload="auto"
                          ref={audioRef}
                          src={card.sentence_audio_url}
                        />
                      </div>
                    ) : creatingAudioId === card.id ? (
                      <p className="mt-5 text-sm text-zinc-500">
                        Đang tạo audio câu...
                      </p>
                    ) : null}
                  </div>

                  {vocabItems.length > 0 ? (
                    <div className="mt-5 rounded-lg border border-zinc-200 bg-white">
                      <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">
                        Từ vựng trong câu
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {vocabItems.map((item, itemIndex) => (
                          <div
                            className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_2fr]"
                            key={`${item.chinese}-${itemIndex}`}
                          >
                            <div className="text-lg font-semibold">
                              {item.chinese}
                            </div>
                            <div className="text-teal-800">
                              {showPinyinHint ? item.pinyin : ""}
                            </div>
                            <div className="text-zinc-700">
                              {item.meaning_vi}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

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
