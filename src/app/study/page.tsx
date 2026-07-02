"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck, DueReview, ReviewRating } from "@/lib/types";

const allDecksValue = "all";

const ratingLabels: Record<ReviewRating, string> = {
  again: "Quên",
  hard: "Khó",
  good: "Nhớ",
  easy: "Dễ",
};

const ratingIntervals: Record<ReviewRating, string> = {
  again: "10 phút",
  hard: "1 ngày",
  good: "3 ngày",
  easy: "7 ngày",
};

const audioSpeeds = {
  normal: 1,
  slow: 0.75,
} as const;

type AudioSpeed = keyof typeof audioSpeeds;

type StudySettings = {
  daily_new_card_limit: number;
  daily_new_sentence_limit: number;
};

const defaultStudySettings: StudySettings = {
  daily_new_card_limit: 10,
  daily_new_sentence_limit: 5,
};

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function normalizeHanzi(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function applyNewCardLimit(reviews: DueReview[], remainingNewCards: number) {
  const reviewCards = reviews.filter((review) => Number(review.review_count) > 0);
  const newCards = reviews
    .filter((review) => Number(review.review_count) === 0)
    .slice(0, remainingNewCards);

  return [...reviewCards, ...newCards].sort(
    (left, right) =>
      new Date(left.next_review_at).getTime() -
      new Date(right.next_review_at).getTime(),
  );
}

export default function StudyPage() {
  const configured = hasPublicEnv();
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const repairingReviewsRef = useRef(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    if (typeof window === "undefined") {
      return allDecksValue;
    }
    return window.localStorage.getItem("hanzi-study-deck-id") || allDecksValue;
  });
  const [reviews, setReviews] = useState<DueReview[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyinHint, setShowPinyinHint] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
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
  const [newCardsStudiedToday, setNewCardsStudiedToday] = useState(0);

  async function getNewCardsStudiedToday(deckId = selectedDeckId) {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("reviews")
      .select("id, cards!inner(id)", { count: "exact", head: true })
      .gt("review_count", 0)
      .gte("updated_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      query = query.eq("cards.deck_id", deckId);
    }

    const { count } = await query;
    return count || 0;
  }

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
    let query = supabase
      .from("reviews")
      .select("*, cards!inner(*)")
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(200);

    if (deckId !== allDecksValue) {
      query = query.eq("cards.deck_id", deckId);
    }

    const { data } = await query;

    setNewCardsStudiedToday(studiedToday);
    setReviews(
      applyNewCardLimit((data || []) as DueReview[], remainingNewCards),
    );
    setIndex(0);
    setShowAnswer(false);
    setShowPinyinHint(false);
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

    fetchWithAuth("/api/study-settings").then(async (response) => {
      if (!active || !response.ok) {
        return;
      }

      const data = await response.json();

      if (!active) {
        return;
      }

      setStudySettings(
        (data.settings || defaultStudySettings) as StudySettings,
      );
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
    const todayStart = startOfLocalDay(new Date()).toISOString();
    let query = supabase
      .from("reviews")
      .select("*, cards!inner(*)")
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(200);

    let studiedTodayQuery = supabase
      .from("reviews")
      .select("id, cards!inner(id)", { count: "exact", head: true })
      .gt("review_count", 0)
      .gte("updated_at", todayStart);

    if (selectedDeckId !== allDecksValue) {
      query = query.eq("cards.deck_id", selectedDeckId);
      studiedTodayQuery = studiedTodayQuery.eq(
        "cards.deck_id",
        selectedDeckId,
      );
    }

    Promise.all([query, studiedTodayQuery]).then(async ([{ data }, countResult]) => {
      if (!active) {
        return;
      }

      const studiedToday = countResult.count || 0;
      const remainingNewCards = Math.max(
        0,
        studySettings.daily_new_card_limit - studiedToday,
      );

      if (
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
              .lte("next_review_at", new Date().toISOString())
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
              ),
            );
            setIndex(0);
            setShowAnswer(false);
            setShowPinyinHint(false);
            setWritingAnswer("");
            setWritingResult("");
            setLoading(false);
            return;
          }
        }
      }

      setNewCardsStudiedToday(studiedToday);
      setReviews(
        applyNewCardLimit((data || []) as DueReview[], remainingNewCards),
      );
      setIndex(0);
      setShowAnswer(false);
      setShowPinyinHint(false);
      setWritingAnswer("");
      setWritingResult("");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [configured, selectedDeckId, studySettings.daily_new_card_limit]);

  useEffect(() => {
    if (wordAudioRef.current) {
      wordAudioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }

    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }
  }, [audioSpeed, showAnswer, index]);

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
  }

  function toggleWritingMode() {
    const nextValue = !writingMode;
    setWritingMode(nextValue);
    setWritingAnswer("");
    setWritingResult("");
    window.localStorage.setItem("hanzi-writing-mode", String(nextValue));
  }

  async function ensureCardAudio() {
    if (!card) {
      return null;
    }

    if (card.word_audio_url || card.sentence_audio_url) {
      return {
        wordAudioUrl: card.word_audio_url,
        sentenceAudioUrl: card.sentence_audio_url,
      };
    }

    const response = await fetchWithAuth("/api/ensure-card-audio", {
      method: "POST",
      body: JSON.stringify({ cardId: card.id }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    setReviews((currentReviews) =>
      currentReviews.map((review) =>
        review.cards?.id === card.id
          ? {
              ...review,
              cards: {
                ...review.cards,
                word_audio_url: data.wordAudioUrl || null,
                sentence_audio_url: data.sentenceAudioUrl || null,
              },
            }
          : review,
      ),
    );

    return data as {
      wordAudioUrl: string | null;
      sentenceAudioUrl: string | null;
    };
  }

  async function playCardAudio() {
    const audioData = await ensureCardAudio();
    const audioUrl =
      audioData?.wordAudioUrl ||
      audioData?.sentenceAudioUrl ||
      card?.word_audio_url ||
      card?.sentence_audio_url;

    if (!audioUrl) {
      return;
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = audioSpeeds[audioSpeed];
    audio.play().catch(() => {
      // Some browsers may still block autoplay if the click gesture is lost.
    });
  }

  function showAnswerAndPlayAudio() {
    setShowAnswer(true);
    setShowPinyinHint(false);
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

  async function rate(rating: ReviewRating) {
    const current = reviews[index];
    if (!current?.cards) {
      return;
    }

    setSaving(true);
    const response = await fetchWithAuth("/api/review", {
      method: "POST",
      body: JSON.stringify({ cardId: current.cards.id, rating }),
    });
    setSaving(false);

    if (!response.ok) {
      alert("Không thể lưu kết quả ôn tập.");
      return;
    }

    const nextIndex = index + 1;
    setShowAnswer(false);
    setShowPinyinHint(false);
    setWritingAnswer("");
    setWritingResult("");

    if (nextIndex >= reviews.length) {
      await loadReviews();
    } else {
      setIndex(nextIndex);
    }
  }

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
            </div>
          </div>

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
                {false && writingMode && card?.pinyin ? (
                  <div className="mt-3 text-sm text-teal-800">
                    Gợi ý pinyin: {card?.pinyin}
                  </div>
                ) : null}
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
                    {card?.pinyin ? (
                      showPinyinHint ? (
                        <div className="mt-3 text-lg text-teal-800">
                          {card?.pinyin}
                        </div>
                      ) : (
                        <button
                          className="mt-4 rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
                          onClick={() => setShowPinyinHint(true)}
                          type="button"
                        >
                          Gợi ý pinyin
                        </button>
                      )
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
                          disabled={saving}
                          key={rating}
                          onClick={() => rate(rating)}
                          type="button"
                        >
                          <span className="block font-medium">
                            {ratingLabels[rating]}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            Lặp lại sau {ratingIntervals[rating]}
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
