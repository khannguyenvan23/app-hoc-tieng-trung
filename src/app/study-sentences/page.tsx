"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { isEditableKeyboardTarget } from "@/lib/keyboard";
import { sortDecksByRecentContent } from "@/lib/deck-activity";
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

function countWaitingNewSentences(
  reviews: DueSentenceReview[],
  remainingNewSentences: number,
) {
  const newSentenceCount = reviews.filter(
    (review) => Number(review.review_count) === 0,
  ).length;

  return Math.max(0, newSentenceCount - remainingNewSentences);
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

function normalizePinyinSyllable(value: string) {
  return value
    .replace(/^[\s,.;:!?'"“”‘’()[\]{}，。！？；：、]+/u, "")
    .replace(/[\s,.;:!?'"“”‘’()[\]{}，。！？；：、]+$/u, "")
    .trim();
}

function getTokenPinyinMap(
  sentence: string | null | undefined,
  sentencePinyin: string | null | undefined,
) {
  const map = new Map<string, string[]>();

  if (!sentence || !sentencePinyin) {
    return map;
  }

  const pinyinSyllables = sentencePinyin
    .split(/\s+/)
    .map(normalizePinyinSyllable)
    .filter(Boolean);
  let syllableIndex = 0;

  Array.from(sentence.normalize("NFKC")).forEach((character) => {
    if (/^[\p{P}\p{S}\s]+$/u.test(character)) {
      return;
    }

    const syllable = pinyinSyllables[syllableIndex];
    syllableIndex += 1;

    if (!syllable) {
      return;
    }

    const values = map.get(character) || [];
    values.push(syllable);
    map.set(character, values);
  });

  return map;
}

function takeTokenPinyin(
  token: string | null | undefined,
  pinyinMap: Map<string, string[]>,
) {
  if (!token) {
    return "";
  }

  const syllables: string[] = [];

  Array.from(token.normalize("NFKC")).forEach((character) => {
    if (/^[\p{P}\p{S}\s]+$/u.test(character)) {
      return;
    }

    const values = pinyinMap.get(character);
    const syllable = values?.shift();

    if (syllable) {
      syllables.push(syllable);
    }
  });

  return syllables.join(" ");
}

function SentenceDiffToken({
  item,
  pinyin,
}: {
  item: SentenceDiffItem;
  pinyin?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left sm:block sm:min-w-16 sm:text-center ${sentenceDiffStyles[item.status]}`}
    >
      {pinyin ? (
        <div className="mb-1 text-xs font-medium leading-tight text-teal-800">
          {pinyin}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-1 text-lg font-semibold sm:justify-center">
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
      {item.status !== "missing" ? (
        <div className="text-right text-xs font-medium sm:mt-1 sm:text-center">
          {sentenceDiffLabels[item.status]}
        </div>
      ) : null}
    </div>
  );
}

export default function StudySentencesPage() {
  const configured = hasPublicEnv();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceAnswerRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [newSentencesWaiting, setNewSentencesWaiting] = useState(0);
  const [updatingDailyLimit, setUpdatingDailyLimit] = useState(false);
  const [dailyLimitError, setDailyLimitError] = useState("");
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

    const reviewRows = (data || []) as DueSentenceReview[];
    setNewSentencesStudiedToday(studiedToday);
    setNewSentencesWaiting(
      countWaitingNewSentences(reviewRows, remainingNewSentences),
    );
    setReviews(
      applyNewSentenceLimit(
        reviewRows,
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

        const sentenceDecks = sortDecksByRecentContent(
          (data || []) as Deck[],
          "last_sentence_added_at",
        );

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

            const retryRows = (retryResult.data || []) as DueSentenceReview[];
            setNewSentencesStudiedToday(studiedToday);
            setNewSentencesWaiting(
              countWaitingNewSentences(retryRows, remainingNewSentences),
            );
            setReviews(
              applyNewSentenceLimit(
                retryRows,
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

      const reviewRows = (data || []) as DueSentenceReview[];
      setNewSentencesStudiedToday(studiedToday);
      setNewSentencesWaiting(
        countWaitingNewSentences(reviewRows, remainingNewSentences),
      );
      setReviews(
        applyNewSentenceLimit(
          reviewRows,
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

    const currentCard = reviews[index]?.sentence_cards;

    if (currentCard && !currentCard.sentence_audio_url) {
      void ensureSentenceAudioForCard(currentCard);
    }
  }, [cacheSentenceAudio, ensureSentenceAudioForCard, index, reviews]);

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

  async function increaseDailySentenceLimit() {
    const nextLimit = Math.min(
      100,
      Math.max(30, studySettings.daily_new_sentence_limit + 10),
    );
    const nextSettings = {
      ...studySettings,
      daily_new_sentence_limit: nextLimit,
    };

    setUpdatingDailyLimit(true);
    setDailyLimitError("");
    setLoading(true);

    const response = await fetchWithAuth("/api/study-settings", {
      body: JSON.stringify(nextSettings),
      method: "PUT",
    });
    const data = await response.json().catch(() => null);
    setUpdatingDailyLimit(false);

    if (!response.ok) {
      setDailyLimitError(data?.error || "Không thể tăng giới hạn câu mới.");
      setLoading(false);
      return;
    }

    setStudySettings((data?.settings || nextSettings) as StudySettings);
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
    if (!(writingMode || dictationMode) || showAnswer || !currentCardId) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      sentenceAnswerRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [currentCardId, dictationMode, showAnswer, writingMode]);

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
  const dailyLimitReached =
    !weakOnly &&
    newSentencesWaiting > 0 &&
    newSentencesStudiedToday >= studySettings.daily_new_sentence_limit;
  const suggestedDailyLimit = Math.min(
    100,
    Math.max(30, studySettings.daily_new_sentence_limit + 10),
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto min-w-0 w-full max-w-2xl">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold">Luyện câu</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {reviews.length} câu cần ôn ngay trong {selectedDeckName}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Câu mới hôm nay: {newSentencesStudiedToday} /{" "}
              {studySettings.daily_new_sentence_limit}
            </p>
          </div>

          {loading || repairingReviews ? (
            <p className="text-sm text-zinc-600">
              {repairingReviews ? "Đang kiểm tra lịch ôn câu..." : "Đang tải câu..."}
            </p>
          ) : !card ? (
            <EmptyState
              action={
                dailyLimitReached ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                      disabled={updatingDailyLimit}
                      onClick={increaseDailySentenceLimit}
                      type="button"
                    >
                      {updatingDailyLimit
                        ? "Đang cập nhật..."
                        : `Tăng lên ${suggestedDailyLimit} câu/ngày`}
                    </button>
                    <Link
                      className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                      href="/options"
                    >
                      Mở cài đặt
                    </Link>
                  </div>
                ) : undefined
              }
              body={
                dailyLimitReached
                  ? `Bạn đã học đủ ${studySettings.daily_new_sentence_limit} câu mới hôm nay. Còn ít nhất ${newSentencesWaiting} câu mới đang chờ trong bộ đã chọn.`
                  : "Hiện chưa có câu nào cần ôn trong bộ đã chọn."
              }
              title={
                dailyLimitReached
                  ? "Đã đạt giới hạn câu mới hôm nay"
                  : "Bạn đã luyện xong"
              }
            />
          ) : (
            <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="text-sm text-zinc-500">
                Câu {index + 1} / {reviews.length}
              </div>

              <div className="mt-4 text-center sm:mt-5">
                {dictationMode && !showAnswer ? (
                  <div>
                    <div className="text-sm font-medium text-zinc-500">
                      Luyện chính tả
                    </div>
                    <div className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">
                      Nghe và chép lại câu tiếng Trung
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
                      <button
                        className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 sm:px-4"
                        disabled={creatingAudioId === card.id}
                        onClick={() => void playSentenceAudio()}
                        type="button"
                      >
                        {creatingAudioId === card.id
                          ? "Đang tạo audio..."
                          : "Phát lại audio"}
                      </button>
                      <button
                        className={`min-h-10 rounded-md border px-3 py-2 text-sm font-medium sm:px-4 ${
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
                      <div className="mx-auto mt-5 max-w-xl rounded-md bg-stone-50 px-3 py-3 sm:px-4">
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
                    <div className="mt-3 break-words text-2xl font-semibold leading-tight sm:text-3xl">
                      {card.sentence_vi}
                    </div>
                  </div>
                )}
              </div>

              {!showAnswer ? (
                <div className="mt-7 sm:mt-10">
                  {writingMode || dictationMode ? (
                    <div className="rounded-lg border border-zinc-200 bg-stone-50 p-3 sm:p-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        {dictationMode
                          ? "Gõ lại câu tiếng Trung vừa nghe"
                          : "Gõ câu tiếng Trung"}
                        <textarea
                          className="mt-2 h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-xl leading-relaxed outline-none focus:border-teal-700 sm:h-28 sm:text-2xl"
                          ref={sentenceAnswerRef}
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

                            if (
                              event.key === "Enter" &&
                              !event.shiftKey &&
                              !event.nativeEvent.isComposing
                            ) {
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
                        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3 sm:p-4">
                          <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
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
                          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                            {(() => {
                              const tokenPinyinMap = getTokenPinyinMap(
                                card.sentence_cn,
                                card.sentence_pinyin,
                              );

                              return sentenceDiff.items.map((item, itemIndex) => (
                                <SentenceDiffToken
                                  item={item}
                                  key={`${item.status}-${itemIndex}-${item.actual || ""}-${item.expected || ""}`}
                                  pinyin={takeTokenPinyin(
                                    item.expected || item.actual,
                                    tokenPinyinMap,
                                  )}
                                />
                              ));
                            })()}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid grid-cols-2 gap-2">
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
                <div className="mt-4 sm:mt-5">
                  {writingResult === "correct" ? (
                    <div className="mb-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
                      Đúng rồi. Đây là câu chính xác:
                    </div>
                  ) : null}
                  <div className="rounded-lg bg-stone-50 p-3 text-center sm:p-4">
                    <div className="text-2xl font-semibold leading-relaxed sm:text-3xl">
                      {card.sentence_cn}
                    </div>
                    {showPinyinHint && card.sentence_pinyin ? (
                      <div className="mt-3 text-base text-teal-800">
                        {card.sentence_pinyin}
                      </div>
                    ) : null}

                    {card.sentence_audio_url ? (
                      <div className="mt-3 flex justify-center">
                        <button
                          className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                          onClick={() => void playSentenceAudio()}
                          type="button"
                        >
                          Phát lại audio
                        </button>
                        <audio
                          className="hidden"
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
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
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

          {dailyLimitError ? (
            <p className="mt-3 text-sm text-red-700">{dailyLimitError}</p>
          ) : null}

          <div className="mt-5 grid min-w-0 w-full grid-cols-3 gap-2 border-t border-zinc-200 pt-4 sm:flex sm:flex-wrap sm:items-center">
            <select
              aria-label="Chọn bộ thẻ luyện câu"
              className="col-span-3 min-h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-700 sm:w-36 sm:shrink-0"
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
            <div className="col-span-3 grid min-h-9 w-full grid-cols-2 rounded-md border border-zinc-300 p-1 text-sm sm:w-40 sm:shrink-0">
              <button
                className={`rounded px-2 py-1 ${
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
                className={`rounded px-2 py-1 ${
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
              aria-pressed={writingMode}
              className={`min-h-9 w-full rounded-md border px-2 py-1.5 text-sm font-medium sm:w-auto sm:shrink-0 sm:px-3 ${
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
              aria-pressed={dictationMode}
              className={`min-h-9 w-full rounded-md border px-2 py-1.5 text-sm font-medium sm:w-auto sm:shrink-0 sm:px-3 ${
                dictationMode
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 hover:bg-zinc-100"
              }`}
              onClick={toggleDictationMode}
              type="button"
            >
              Chính tả
            </button>
            <button
              aria-pressed={showPinyinHint}
              className={`min-h-9 w-full rounded-md border px-2 py-1.5 text-sm font-medium sm:w-auto sm:shrink-0 sm:px-3 ${
                showPinyinHint
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 hover:bg-zinc-100"
              }`}
              onClick={togglePinyinHint}
              type="button"
            >
              Pinyin
            </button>
            {audioNotice ? (
              <p className="col-span-3 text-left text-xs text-red-700 sm:basis-full sm:text-right">
                {audioNotice}{" "}
                <Link className="font-medium underline" href="/pricing">
                  Nạp credit
                </Link>
              </p>
            ) : null}
            <span className="sr-only">
              Chọn Bình thường để nghe tự nhiên hoặc Chậm để nghe rõ từng âm.
              Phím P bật tắt pinyin, W bật tắt luyện viết và D bật tắt chính tả.
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Space đáp án · R audio · 1-4 đánh giá · P/W/D chế độ</span>
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
