"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/icons";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StudyCardSkeleton } from "@/components/loading-skeletons";
import { RatingButtons } from "@/components/rating-buttons";
import { ReviewQueueStatus } from "@/components/review-queue-status";
import { SentenceDiffBreakdown } from "@/components/sentence-diff-view";
import { StudyModeMenu } from "@/components/study-mode-menu";
import { StudyProgress } from "@/components/study-progress";
import { AudioSpeedMenu } from "@/components/audio-speed-menu";
import { fetchDueReviewRows } from "@/lib/due-reviews";
import { hasPublicEnv } from "@/lib/env";
import {
  fetchWithAuth,
  getApiErrorMessage,
  isInsufficientCreditsPayload,
} from "@/lib/fetch-auth";
import { isEditableKeyboardTarget } from "@/lib/keyboard";
import { sortDecksByRecentContent } from "@/lib/deck-activity";
import { getNextReview } from "@/lib/review";
import {
  getReviewQueueKey,
  getReviewQueueStats,
} from "@/lib/review-queue-stats";
import {
  compareChineseSentences,
  type SentenceDiffResult,
} from "@/lib/sentence-diff";
import {
  defaultStudySettings,
  formatCountdownLabel,
  normalizeStudySettings,
  type StudySettings,
} from "@/lib/study-settings";
import {
  buildStudyQueue as buildLimitedStudyQueue,
  countWaitingNewItems,
  getNextDueLearningQueueIndex,
  getNextPendingLearningAt,
  getNextStudyQueueIndex,
  isAvailableForStudy,
  shouldRequeueInCurrentSession,
} from "@/lib/study-queue";
import {
  getStoredStudyProgress,
  getStoredReviewIndex,
  getStudySessionKey,
  restoreStoredReviewQueue,
  saveStoredReviewId,
  saveStoredReviewQueue,
  saveStoredStudyProgress,
} from "@/lib/study-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Deck,
  DueSentenceReview,
  ReviewRating,
  SentenceCard,
} from "@/lib/types";

const allDecksValue = "all";
const audioCacheLimit = 16;

const copyKeyToRating: Record<string, ReviewRating> = {
  "1": "again",
  "2": "good",
  "3": "easy",
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

// Deck handed over by the deck page (`/study?deck=<id>`).
// Pure on purpose: a useState initializer runs twice under StrictMode, so this
// must not touch the URL. Stripping the param happens in an effect instead.
function getRequestedDeckId() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("deck") || "";
}

// Drop `?deck=` once it has been applied, so switching decks by hand is not
// undone the next time the page is refreshed.
function clearRequestedDeckParam() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (!url.searchParams.has("deck")) {
    return;
  }

  url.searchParams.delete("deck");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function dueReviewCutoff() {
  return new Date(Date.now() + 60_000).toISOString();
}

function learnAheadReviewCutoff(settings: StudySettings) {
  return new Date(
    Date.now() + settings.learn_ahead_limit_minutes * 60_000,
  ).toISOString();
}

function buildSentenceStudyQueue(
  reviews: DueSentenceReview[],
  remainingNewSentences: number,
  settings: StudySettings,
) {
  return buildLimitedStudyQueue(
    reviews,
    remainingNewSentences,
    settings,
    (review) => review.sentence_cards?.created_at,
  );
}

function countWaitingNewSentences(
  reviews: DueSentenceReview[],
  remainingNewSentences: number,
) {
  return countWaitingNewItems(reviews, remainingNewSentences);
}

function getRestoredSentenceStudyIndex(
  reviews: DueSentenceReview[],
  storageKey: string,
  learnAheadLimitMinutes: number,
) {
  const storedIndex = getStoredReviewIndex(
    reviews,
    storageKey,
    (review) => review.sentence_cards?.id,
  );
  const nextStudyIndex = getNextStudyQueueIndex(
    reviews,
    storedIndex,
    new Date(),
    undefined,
    learnAheadLimitMinutes,
  );

  return nextStudyIndex >= 0 ? nextStudyIndex : storedIndex;
}

function getPendingSentenceStudyAt(reviews: DueSentenceReview[]) {
  return getNextPendingLearningAt(reviews);
}

function getSentenceAudioUrl(card: SentenceCard | null | undefined) {
  return card?.sentence_audio_url || null;
}

type SentenceAudioData = {
  sentenceAudioUrl: string | null;
};

type SavedReviewSchedule = {
  next_review_at?: string;
  interval_days?: number;
  ease_factor?: number;
  learning_step?: number;
};

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
  const ratingInFlightRef = useRef(false);
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

    const requestedDeckId = getRequestedDeckId();

    if (requestedDeckId) {
      // Remember it so coming back to /study-sentences later lands on the same deck.
      window.localStorage.setItem(
        "hanzi-sentence-study-deck-id",
        requestedDeckId,
      );
      return requestedDeckId;
    }

    return (
      window.localStorage.getItem("hanzi-sentence-study-deck-id") ||
      allDecksValue
    );
  });
  const [reviews, setReviews] = useState<DueSentenceReview[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
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
  // Optional "chép lại để nhớ" panel on the back of a dictation card: copy the
  // revealed sentence once more to reinforce the characters.
  const [copyPracticeOpen, setCopyPracticeOpen] = useState(false);
  const [copyText, setCopyText] = useState("");
  const [repairingReviews, setRepairingReviews] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [settingsLoaded, setSettingsLoaded] = useState(!configured);
  const [newSentencesStudiedToday, setNewSentencesStudiedToday] = useState(0);
  const [newSentencesWaiting, setNewSentencesWaiting] = useState(0);
  const [scheduledReloadAt, setScheduledReloadAt] = useState<string | null>(
    null,
  );
  // Ticks every second while waiting for the next card, so the countdown on the
  // "chờ bước lặp lại" screen updates live.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [updatingDailyLimit, setUpdatingDailyLimit] = useState(false);
  const [dailyLimitError, setDailyLimitError] = useState("");
  const [audioNotice, setAudioNotice] = useState<{
    message: string;
    showPricing: boolean;
  } | null>(null);
  const [creatingAudioId, setCreatingAudioId] = useState<string | null>(null);
  const reloadReviewsRef = useRef<() => void>(() => {});

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
            const isCreditError = isInsufficientCreditsPayload(data);
            setAudioNotice({
              message: isCreditError
                ? getApiErrorMessage(data, "Không đủ credit để tạo audio.")
                : "Không tạo được audio cho câu này — bạn vẫn học bình thường được.",
              showPricing: isCreditError,
            });
            return sentenceCard.sentence_audio_url;
          }

          const data = (await response.json()) as SentenceAudioData;
          const sentenceAudioUrl =
            data.sentenceAudioUrl || sentenceCard.sentence_audio_url;

          setAudioNotice(null);

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
          setAudioNotice({
            message:
              "Không tạo được audio cho câu này — bạn vẫn học bình thường được.",
            showPricing: false,
          });
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

    const reviewRows = await fetchDueReviewRows<DueSentenceReview>(
      supabase,
      { table: "sentence_reviews", cardsRelation: "sentence_cards" },
      {
        deckId: deckId === allDecksValue ? null : deckId,
        weakOnly,
        dueCutoff: dueReviewCutoff(),
        learnAheadCutoff: learnAheadReviewCutoff(studySettings),
      },
    );
    setNewSentencesStudiedToday(studiedToday);
    setNewSentencesWaiting(
      countWaitingNewSentences(reviewRows, remainingNewSentences),
    );
    const storageKey = getStudySessionKey("sentence", deckId, weakOnly);
    const storedReviewQueue = restoreStoredReviewQueue(
      buildSentenceStudyQueue(
        reviewRows,
        remainingNewSentences,
        studySettings,
      ),
      storageKey,
      (review) => review.sentence_cards?.id,
      (review) => shouldRequeueInCurrentSession(review.next_review_at),
    );
    const reviewQueue = buildSentenceStudyQueue(
      storedReviewQueue,
      remainingNewSentences,
      studySettings,
    );
    const sessionProgress = getStoredStudyProgress(
      storageKey,
      reviewQueue.length,
    );
    setReviews(reviewQueue);
    setScheduledReloadAt(
      getPendingSentenceStudyAt(reviewQueue),
    );
    setSessionTotal(sessionProgress.total);
    setSessionAnswered(sessionProgress.answered);
    setIndex(
      getRestoredSentenceStudyIndex(
        reviewQueue,
        storageKey,
        studySettings.learn_ahead_limit_minutes,
      ),
    );
    setShowAnswer(false);
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);
    setLoading(false);
  }

  // Re-apply the requested deck once the deck list has loaded. The state
  // initializer already set it, but the validation that runs after the decks
  // arrive can overwrite it, and effect ordering is not guaranteed. Doing it
  // here — through the same path the dropdown uses — makes the deep link win
  // regardless of ordering. Only then is the param dropped from the URL.
  const requestedDeckIdRef = useRef(getRequestedDeckId());

  useEffect(() => {
    if (!decksLoaded) {
      return;
    }

    const requestedDeckId = requestedDeckIdRef.current;

    if (!requestedDeckId) {
      return;
    }

    requestedDeckIdRef.current = "";

    if (
      requestedDeckId !== selectedDeckId &&
      decks.some((deck) => deck.id === requestedDeckId)
    ) {
      changeDeck(requestedDeckId);
    }

    clearRequestedDeckParam();
  }, [decks, decksLoaded, selectedDeckId]);

  useEffect(() => {
    reloadReviewsRef.current = () => {
      void loadReviews();
    };
  });

  useEffect(() => {
    if (!configured || loading || reviews.length === 0) {
      return;
    }

    const storageKey = getStudySessionKey("sentence", selectedDeckId, weakOnly);
    saveStoredReviewQueue(storageKey, reviews);
    saveStoredReviewId(
      storageKey,
      reviews[index]?.id,
      reviews[index]?.sentence_cards?.id,
      index,
    );
  }, [configured, index, loading, reviews, selectedDeckId, weakOnly]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase
      .from("decks")
      .select(
        "id, user_id, name, source_template_slug, source_share_id, last_card_added_at, last_sentence_added_at, created_at, sentence_cards(count)",
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) {
          return;
        }

        const deckRows = (data || []) as unknown as Array<
          Deck & { sentence_cards?: { count: number | null }[] | null }
        >;
        const sentenceDecks = sortDecksByRecentContent(
          deckRows.filter(
            (deck) => Number(deck.sentence_cards?.[0]?.count || 0) > 0,
          ),
          "last_sentence_added_at",
        );

        setDecks(sentenceDecks);
        setSelectedDeckId((currentDeckId) => {
          if (
            currentDeckId === allDecksValue ||
            sentenceDecks.some((deck) => deck.id === currentDeckId) ||
            // A just-added deck reached here via ?deck= but the deck list can
            // lag one query behind its content. Keep it selected so the
            // repair/retry path heals it in seconds instead of resetting to
            // "all" and waiting for an incidental reload.
            currentDeckId === requestedDeckIdRef.current
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
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      try {
        const { data } = await supabase
          .from("user_study_settings")
          .select("*")
          .maybeSingle();

        if (!active) {
          return;
        }

        setStudySettings(normalizeStudySettings(data || defaultStudySettings));
      } catch (error) {
        console.warn("Could not load sentence study settings", error);
      } finally {
        if (active) {
          setSettingsLoaded(true);
        }
      }
    })();

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
    const loadDueRows = () =>
      fetchDueReviewRows<DueSentenceReview>(
        supabase,
        { table: "sentence_reviews", cardsRelation: "sentence_cards" },
        {
          deckId: selectedDeckId === allDecksValue ? null : selectedDeckId,
          weakOnly,
          dueCutoff: dueReviewCutoff(),
          learnAheadCutoff: learnAheadReviewCutoff(studySettings),
        },
      );

    Promise.all([loadDueRows(), getNewSentencesStudiedToday(selectedDeckId)]).then(
      async ([data, studiedToday]) => {
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
            const retryRows = await loadDueRows();

            if (!active) {
              return;
            }

            const storageKey = getStudySessionKey(
              "sentence",
              selectedDeckId,
              weakOnly,
            );
            const storedRetryQueue = restoreStoredReviewQueue(
              buildSentenceStudyQueue(
                retryRows,
                remainingNewSentences,
                studySettings,
              ),
              storageKey,
              (review) => review.sentence_cards?.id,
              (review) => shouldRequeueInCurrentSession(review.next_review_at),
            );
            const retryQueue = buildSentenceStudyQueue(
              storedRetryQueue,
              remainingNewSentences,
              studySettings,
            );
            setNewSentencesStudiedToday(studiedToday);
            setNewSentencesWaiting(
              countWaitingNewSentences(retryRows, remainingNewSentences),
            );
            const retryQueueProgress = getStoredStudyProgress(
              storageKey,
              retryQueue.length,
            );
            setSessionTotal(retryQueueProgress.total);
            setSessionAnswered(retryQueueProgress.answered);
            setReviews(retryQueue);
            setScheduledReloadAt(
              getPendingSentenceStudyAt(retryQueue),
            );
            setIndex(
              getRestoredSentenceStudyIndex(
                retryQueue,
                storageKey,
                studySettings.learn_ahead_limit_minutes,
              ),
            );
            setShowAnswer(false);
            setSentenceAnswer("");
            setWritingResult("");
            setSentenceDiff(null);
            setLoading(false);
            return;
          }
        }
      }

      const reviewRows = data;
      const storageKey = getStudySessionKey(
        "sentence",
        selectedDeckId,
        weakOnly,
      );
      const storedReviewQueue = restoreStoredReviewQueue(
        buildSentenceStudyQueue(
          reviewRows,
          remainingNewSentences,
          studySettings,
        ),
        storageKey,
        (review) => review.sentence_cards?.id,
        (review) => shouldRequeueInCurrentSession(review.next_review_at),
      );
      const reviewQueue = buildSentenceStudyQueue(
        storedReviewQueue,
        remainingNewSentences,
        studySettings,
      );
      // This effect is the path a page load / F5 takes, so the saved session
      // progress has to be restored here too — not only in loadReviews().
      const sessionProgress = getStoredStudyProgress(
        storageKey,
        reviewQueue.length,
      );
      setNewSentencesStudiedToday(studiedToday);
      setNewSentencesWaiting(
        countWaitingNewSentences(reviewRows, remainingNewSentences),
      );
      setSessionTotal(sessionProgress.total);
      setSessionAnswered(sessionProgress.answered);
      setReviews(reviewQueue);
      setScheduledReloadAt(
        getPendingSentenceStudyAt(reviewQueue),
      );
      setIndex(
        getRestoredSentenceStudyIndex(
          reviewQueue,
          storageKey,
          studySettings.learn_ahead_limit_minutes,
        ),
      );
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
    const templateDeckIds = new Set(
      decks
        .filter((deck) => Boolean(deck.source_template_slug))
        .map((deck) => deck.id),
    );

    reviews.slice(index, index + 3).forEach((review) => {
      const sentenceCard = review.sentence_cards;

      cacheSentenceAudio(getSentenceAudioUrl(sentenceCard));

      if (
        sentenceCard &&
        templateDeckIds.has(sentenceCard.deck_id) &&
        !sentenceCard.sentence_audio_url
      ) {
        void ensureSentenceAudioForCard(sentenceCard);
      }
    });
  }, [
    cacheSentenceAudio,
    decks,
    ensureSentenceAudioForCard,
    index,
    reviews,
  ]);

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
        "2": "good",
        "3": "easy",
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
    // Each freshly revealed card starts with the copy-practice panel closed.
    setCopyPracticeOpen(false);
    setCopyText("");
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

  function reconcileSavedReview(
    reviewId: string,
    schedule: SavedReviewSchedule,
  ) {
    if (
      !schedule.next_review_at ||
      typeof schedule.interval_days !== "number" ||
      typeof schedule.ease_factor !== "number"
    ) {
      return;
    }

    setReviews((currentReviews) => {
      let changed = false;
      const nextReviews = currentReviews.map((review) => {
        if (review.id !== reviewId) {
          return review;
        }

        changed = true;
        return {
          ...review,
          next_review_at: schedule.next_review_at!,
          interval_days: schedule.interval_days!,
          ease_factor: schedule.ease_factor!,
          learning_step:
            typeof schedule.learning_step === "number"
              ? schedule.learning_step
              : review.learning_step,
        };
      });

      if (changed) {
        const storageKey = getStudySessionKey(
          "sentence",
          selectedDeckId,
          weakOnly,
        );
        saveStoredReviewQueue(storageKey, nextReviews);
      }

      return nextReviews;
    });
  }

  function queueReviewSave(
    promise: Promise<Response>,
    errorMessage: string,
    onSuccess: (schedule: SavedReviewSchedule) => void,
  ) {
    const trackedPromise = promise
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (SavedReviewSchedule & { error?: string })
          | null;

        if (!response.ok) {
          const message =
            response.status === 401
              ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi tiếp tục luyện."
              : data?.error || errorMessage;
          throw new Error(message);
        }

        if (data) {
          onSuccess(data);
        }
      })
      .catch((error) => {
        console.error(error);
        alert(error instanceof Error ? error.message : errorMessage);
        reloadReviewsRef.current();
      })
      .finally(() => {
        ratingInFlightRef.current = false;
        setSavingRating(false);
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
    if (!current?.sentence_cards || ratingInFlightRef.current) {
      return;
    }

    ratingInFlightRef.current = true;
    setSavingRating(true);
    stopSentenceAudio();
    const wasNewSentence = Number(current.review_count || 0) === 0;
    const optimisticNextReview = getNextReview(
      rating,
      current,
      new Date(),
      studySettings,
    );
    const reviewedCurrent: DueSentenceReview = {
      ...current,
      ...optimisticNextReview,
      first_reviewed_at:
        current.first_reviewed_at ||
        (wasNewSentence ? new Date().toISOString() : current.first_reviewed_at),
      last_rating: rating,
      review_count: Number(current.review_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };
    const savePromise = queueReviewSave(
      fetchWithAuth("/api/review-sentence", {
        method: "POST",
        body: JSON.stringify({
          sentenceCardId: current.sentence_cards.id,
          rating,
        }),
      }),
      "Khong the luu ket qua luyen cau.",
      (schedule) => reconcileSavedReview(current.id, schedule),
    );

    if (wasNewSentence) {
      setNewSentencesStudiedToday((currentCount) => currentCount + 1);
    }
    scheduleLearningStepReload(
      optimisticNextReview.next_review_at,
      optimisticNextReview.interval_days,
    );

    const remainingReviews = [
      ...reviews.slice(0, index),
      ...reviews.slice(index + 1),
    ];
    const progressStorageKey = getStudySessionKey(
      "sentence",
      selectedDeckId,
      weakOnly,
    );
    const nextSessionTotal = Math.max(sessionTotal, reviews.length);
    const nextSessionAnswered = Math.min(
      sessionAnswered + 1,
      nextSessionTotal,
    );
    setSessionTotal(nextSessionTotal);
    setSessionAnswered(nextSessionAnswered);
    saveStoredStudyProgress(
      progressStorageKey,
      nextSessionTotal,
      nextSessionAnswered,
    );
    setShowAnswer(false);
    setSentenceAnswer("");
    setWritingResult("");
    setSentenceDiff(null);

    if (
      shouldRequeueInCurrentSession(optimisticNextReview.next_review_at)
    ) {
      // Keep the just-failed card in the session queue even when it is the last
      // one left, so the "waiting for the next step" screen shows and the card
      // comes back after its learning step instead of ending the session.
      const requeuedReviews = [...remainingReviews, reviewedCurrent];
      const nextStudyIndex = getNextStudyQueueIndex(
        requeuedReviews,
        index,
        new Date(),
        undefined,
        studySettings.learn_ahead_limit_minutes,
      );
      const nextIndex =
        nextStudyIndex >= 0
          ? nextStudyIndex
          : Math.min(index, requeuedReviews.length - 1);
      const storageKey = getStudySessionKey(
        "sentence",
        selectedDeckId,
        weakOnly,
      );
      saveStoredReviewQueue(storageKey, requeuedReviews);
      saveStoredReviewId(
        storageKey,
        requeuedReviews[nextIndex]?.id,
        requeuedReviews[nextIndex]?.sentence_cards?.id,
        nextIndex,
      );
      setReviews(requeuedReviews);
      setIndex(nextIndex);
      return;
    }

    if (remainingReviews.length === 0) {
      const storageKey = getStudySessionKey(
        "sentence",
        selectedDeckId,
        weakOnly,
      );
      saveStoredReviewQueue(storageKey, []);
      saveStoredReviewId(storageKey);
      saveStoredStudyProgress(storageKey);
      setReviews([]);
      setIndex(0);
      setSessionTotal(0);
      setSessionAnswered(0);

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
      const nextStudyIndex = getNextStudyQueueIndex(
        remainingReviews,
        index,
        new Date(),
        undefined,
        studySettings.learn_ahead_limit_minutes,
      );
      const nextIndex =
        nextStudyIndex >= 0
          ? nextStudyIndex
          : Math.min(index, remainingReviews.length - 1);
      const storageKey = getStudySessionKey(
        "sentence",
        selectedDeckId,
        weakOnly,
      );
      saveStoredReviewQueue(storageKey, remainingReviews);
      saveStoredReviewId(
        storageKey,
        remainingReviews[nextIndex]?.id,
        remainingReviews[nextIndex]?.sentence_cards?.id,
        nextIndex,
      );
      setReviews(remainingReviews);
      setIndex(nextIndex);
    }
  }

  useEffect(() => {
    if (!scheduledReloadAt) {
      return;
    }

    // Poll every second while waiting: keep the countdown live AND reveal the
    // next card the moment it becomes due. A one-shot timer could fire once
    // before anything was due and then never retry, leaving the card stuck.
    const check = () => {
      setNowTick(Date.now());

      if (loading || repairingReviews) {
        return;
      }

      if (reviews.length > 0) {
        const now = new Date();
        const nextLearningIndex = getNextDueLearningQueueIndex(
          reviews,
          index,
          now,
        );
        if (nextLearningIndex >= 0) {
          const currentReview = reviews[index];
          const currentIsAvailable =
            currentReview &&
            isAvailableForStudy(
              currentReview,
              now,
              studySettings.learn_ahead_limit_minutes,
            );

          setScheduledReloadAt(getNextPendingLearningAt(reviews, now));

          // Do not replace a card while the learner is answering it. The normal
          // queue selection after that answer prioritizes this due learning card.
          if (!currentIsAvailable) {
            setIndex(nextLearningIndex);
          }
          return;
        }

        setScheduledReloadAt(getNextPendingLearningAt(reviews, now));
        return;
      }

      // Queue emptied while waiting — reload from the server.
      setScheduledReloadAt(null);
      setLoading(true);
      reloadReviewsRef.current();
    };

    const immediate = window.setTimeout(check, 0);
    const interval = window.setInterval(check, 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [
    scheduledReloadAt,
    reviews,
    index,
    loading,
    repairingReviews,
    studySettings.learn_ahead_limit_minutes,
  ]);

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

  const queuedCurrent = reviews[index];
  const current =
    queuedCurrent &&
    isAvailableForStudy(
      queuedCurrent,
      new Date(),
      studySettings.learn_ahead_limit_minutes,
    )
      ? queuedCurrent
      : undefined;
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
  // Live check of the optional "chép lại" copy against the revealed sentence.
  const copyDiff =
    copyPracticeOpen && copyText.trim() && card
      ? compareChineseSentences(card.sentence_cn, copyText)
      : null;
  const copyDone = copyDiff
    ? copyDiff.counts.correct > 0 &&
      copyDiff.counts.wrong === 0 &&
      copyDiff.counts.missing === 0 &&
      copyDiff.counts.extra === 0
    : false;
  const waitingForLearningStep =
    Boolean(scheduledReloadAt) &&
    new Date(scheduledReloadAt || 0).getTime() > nowTick;
  const scheduledLearningStepLabel = scheduledReloadAt
    ? formatCountdownLabel(new Date(scheduledReloadAt).getTime() - nowTick)
    : "";
  const queueStats = getReviewQueueStats(reviews);
  const activeQueueKey = current ? getReviewQueueKey(current) : null;
  // Total work = what you have already answered plus what the three queues
  // still hold (Mới + Đang ôn + Review), so the percentage always reflects the
  // real remaining workload. Counting from the answered tally — which is
  // persisted — keeps the bar correct after a reload and still advances when a
  // card rated Quên/Khó goes back into the queue for its learning step.
  const queueRemaining =
    queueStats.new + queueStats.learning + queueStats.review;
  const progressTotal = Math.max(1, sessionAnswered + queueRemaining);
  const progressCurrent = Math.min(sessionAnswered + 1, progressTotal);
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
        <div className="study-page-shell mx-auto min-w-0 w-full max-w-2xl">
          {loading || repairingReviews ? (
            <StudyCardSkeleton />
          ) : !card ? (
            <EmptyState
              action={
                !waitingForLearningStep && dailyLimitReached ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                      disabled={updatingDailyLimit}
                      onClick={increaseDailySentenceLimit}
                      type="button"
                    >
                      {updatingDailyLimit
                        ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={15} />
                Đang cập nhật...
              </span>
            )
                        : `Tăng lên ${suggestedDailyLimit} câu/ngày`}
                    </button>
                    <Link
                      className="btn-secondary inline-flex items-center px-4 py-2 text-sm"
                      href="/options"
                    >
                      Mở cài đặt
                    </Link>
                  </div>
                ) : undefined
              }
              body={
                waitingForLearningStep
                  ? `Câu tiếp theo sẽ tự mở sau ${scheduledLearningStepLabel}. Bạn nghỉ một chút nhé.`
                  : dailyLimitReached
                  ? `Bạn đã học đủ ${studySettings.daily_new_sentence_limit} câu mới hôm nay. Còn ít nhất ${newSentencesWaiting} câu mới đang chờ trong bộ đã chọn.`
                  : "Hiện chưa có câu nào cần ôn trong bộ đã chọn."
              }
              title={
                waitingForLearningStep
                  ? "Đang chờ bước lặp lại"
                  : dailyLimitReached
                  ? "Đã đạt giới hạn câu mới hôm nay"
                  : "Bạn đã luyện xong"
              }
            />
          ) : (
            <section
              className="study-card min-w-0 overflow-hidden p-4 sm:p-5"
              key={current?.id || card.id}
            >
              <StudyProgress
                current={progressCurrent}
                itemName="Câu"
                total={progressTotal}
              />

              <div className="mt-4 text-center sm:mt-5">
                {dictationMode && !showAnswer ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                        Luyện chính tả
                      </span>
                      <button
                        className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
                        disabled={creatingAudioId === card.id}
                        onClick={() => void playSentenceAudio()}
                        type="button"
                      >
                        {creatingAudioId === card.id
                          ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={15} />
                Đang tạo audio...
              </span>
            )
                          : "Phát lại audio"}
                      </button>
                      <button
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium ${ showDictationMeaning ? "border-teal-700 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300" : "border-zinc-300 dark:border-white/15 hover:bg-zinc-100 dark:hover:bg-white/10" }`}
                        onClick={toggleDictationMeaning}
                        type="button"
                      >
                        {showDictationMeaning
                          ? "Tắt nghĩa Việt"
                          : "Bật nghĩa Việt"}
                      </button>
                    </div>
                    {showDictationMeaning ? (
                      <div className="mx-auto mt-3 max-w-xl rounded-lg bg-stone-50 dark:bg-white/5 px-3 py-2">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Nghĩa tiếng Việt
                        </div>
                        <div className="mt-1 text-lg font-semibold leading-snug text-zinc-800 dark:text-zinc-100 sm:text-xl">
                          {card.sentence_vi}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    {/* The Vietnamese is the prompt, not the material being
                        learned — keep it a step below the Chinese sentence. */}
                    <div className="break-words text-xl font-semibold leading-snug sm:text-2xl">
                      {card.sentence_vi}
                    </div>
                  </div>
                )}
              </div>

              {!showAnswer ? (
                <div className="mt-4 sm:mt-5">
                  {writingMode || dictationMode ? (
                    <div className="app-surface-muted rounded-xl p-3">
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {dictationMode
                          ? "Gõ lại câu tiếng Trung vừa nghe"
                          : "Gõ câu tiếng Trung"}
                        <textarea
                          className="mt-2 h-20 w-full rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-3 py-2 text-center text-xl leading-relaxed outline-none focus:border-teal-700 sm:h-24 sm:text-2xl"
                          ref={sentenceAnswerRef}
                          onChange={(event) => {
                            // Keep the last check result on screen while the
                            // learner types the correction, so they can see
                            // which words were wrong. It refreshes on the next
                            // "Kiểm tra" and clears when moving to another card.
                            setSentenceAnswer(event.target.value);
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
                        <p className="mt-3 text-sm font-medium text-teal-700 dark:text-teal-300">
                          Đúng rồi.
                        </p>
                      ) : null}
                      {writingResult === "wrong" ? (
                        <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
                          Chưa đúng, thử lại hoặc hiện đáp án.
                        </p>
                      ) : null}

                      {writingResult === "wrong" && sentenceDiff ? (
                        <SentenceDiffBreakdown
                          chinese={card.sentence_cn}
                          diff={sentenceDiff}
                          pinyin={card.sentence_pinyin}
                        />
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          className="btn-primary px-4 py-2 text-sm"
                          onClick={checkSentenceAnswer}
                          type="button"
                        >
                          Kiểm tra
                        </button>
                        <button
                          className="btn-secondary px-4 py-2 text-sm"
                          onClick={showAnswerAndPlayAudio}
                          type="button"
                        >
                          Hiện đáp án
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-primary w-full px-4 py-2 text-sm"
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
                    <div className="mb-3 rounded-md border border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 text-sm font-medium text-teal-800 dark:text-teal-300">
                      Đúng rồi. Đây là câu chính xác:
                    </div>
                  ) : null}
                  <div className="study-answer-panel p-3 text-center sm:p-4">
                    <div className="text-2xl font-semibold leading-relaxed sm:text-3xl">
                      {card.sentence_cn}
                    </div>
                    {showPinyinHint && card.sentence_pinyin ? (
                      <div className="mt-3 text-base text-teal-800 dark:text-teal-300">
                        {card.sentence_pinyin}
                      </div>
                    ) : null}

                    {card.sentence_audio_url ? (
                      <div className="mt-3 flex justify-center">
                        <button
                          className="btn-secondary px-3 py-1.5 text-sm"
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
                      <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
                        Đang tạo audio câu...
                      </p>
                    ) : null}
                  </div>

                  {!writingMode ? (
                    !copyPracticeOpen ? (
                      <div className="mt-3 text-center">
                        <button
                          className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                          onClick={() => setCopyPracticeOpen(true)}
                          type="button"
                        >
                          ✍️ Chép lại để nhớ
                        </button>
                      </div>
                    ) : (
                      <div className="app-surface mt-3 rounded-xl p-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Chép lại câu bên trên để khắc sâu chữ Hán:
                            <textarea
                              className="mt-2 h-20 w-full rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-3 py-2 text-center text-xl leading-relaxed outline-none focus:border-teal-700 sm:h-24 sm:text-2xl"
                              onChange={(event) => setCopyText(event.target.value)}
                              onKeyDown={(event) => {
                                // Once the copy matches, let the keyboard rate and
                                // move on without reaching for the mouse.
                                if (
                                  !copyDone ||
                                  event.nativeEvent.isComposing
                                ) {
                                  return;
                                }

                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  rate("good");
                                  return;
                                }

                                const rating = copyKeyToRating[event.key];
                                if (rating) {
                                  event.preventDefault();
                                  rate(rating);
                                }
                              }}
                              placeholder="输入完整句子"
                              value={copyText}
                            />
                          </label>
                          {copyDone ? (
                            <p className="mt-3 text-sm font-medium text-teal-700 dark:text-teal-300">
                              ✓ Đã chép xong, giỏi lắm!{" "}
                              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                — nhấn 1–3 để đánh giá · Enter = Nhớ, qua câu
                              </span>
                            </p>
                          ) : copyDiff ? (
                            <SentenceDiffBreakdown
                              chinese={card.sentence_cn}
                              diff={copyDiff}
                              pinyin={card.sentence_pinyin}
                            />
                          ) : null}
                        </div>
                      </div>
                    )
                  ) : null}

                  {vocabItems.length > 0 ? (
                    <div className="app-surface mt-3 rounded-xl">
                      <div className="border-b border-zinc-100 dark:border-white/10 px-4 py-3 text-sm font-semibold">
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
                            <div className="text-teal-800 dark:text-teal-300">
                              {showPinyinHint ? item.pinyin : ""}
                            </div>
                            <div className="text-zinc-700 dark:text-zinc-300">
                              {item.meaning_vi}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <RatingButtons
                    disabled={savingRating}
                    onRate={rate}
                    review={current}
                    settings={studySettings}
                  />
                </div>
              )}
            </section>
          )}

          {reviews.length > 0 ? (
            <ReviewQueueStatus
              active={activeQueueKey}
              itemName="Câu"
              stats={queueStats}
            />
          ) : null}

          {dailyLimitError ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">{dailyLimitError}</p>
          ) : null}

          <div className="study-controls">
            <div className="grid min-w-0 w-full grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                aria-label="Chọn bộ thẻ luyện câu"
                className="col-span-3 h-10 w-full rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-3 text-sm outline-none transition focus:border-teal-700 sm:w-48 sm:shrink-0"
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
              <AudioSpeedMenu
                className="justify-self-start sm:shrink-0"
                onChange={changeAudioSpeed}
                value={audioSpeed}
              />
              <StudyModeMenu
                className="col-span-2 justify-self-stretch sm:w-auto sm:shrink-0"
                options={[
                  {
                    description: "Gõ chữ Hán từ nghĩa tiếng Việt.",
                    enabled: writingMode,
                    id: "writing",
                    label: "Viết",
                    onToggle: toggleWritingMode,
                  },
                  {
                    description: "Nghe audio và chép lại cả câu.",
                    enabled: dictationMode,
                    id: "dictation",
                    label: "Chính tả",
                    onToggle: toggleDictationMode,
                  },
                  {
                    description: "Hiện phiên âm khi xem đáp án.",
                    enabled: showPinyinHint,
                    id: "pinyin",
                    label: "Pinyin",
                    onToggle: togglePinyinHint,
                  },
                ]}
              />
              {audioNotice ? (
                audioNotice.showPricing ? (
                  <p className="col-span-3 text-left text-xs text-red-700 dark:text-red-300 sm:basis-full sm:text-right">
                    {audioNotice.message}{" "}
                    <Link className="font-medium underline" href="/pricing">
                      Nạp credit
                    </Link>
                  </p>
                ) : (
                  <p className="col-span-3 text-left text-xs text-zinc-500 dark:text-zinc-400 sm:basis-full sm:text-right">
                    {audioNotice.message}
                  </p>
                )
              ) : null}
            </div>
            <span className="sr-only">
              Chọn Bình thường để nghe tự nhiên hoặc Chậm để nghe rõ từng âm.
              Phím P bật tắt pinyin, W bật tắt luyện viết và D bật tắt chính tả.
            </span>
          </div>

          <div className="study-shortcuts-hint">
            <span>Space đáp án · R audio · 1-3 đánh giá · P/W/D chế độ</span>
            <Link
              className="font-medium text-teal-800 dark:text-teal-300 hover:underline"
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
