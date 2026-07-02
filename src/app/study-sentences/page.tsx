"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck, DueSentenceReview, ReviewRating } from "@/lib/types";

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

function normalizeSentenceHanzi(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[。．.！？!?，,、；;：:“”"']/g, "")
    .trim();
}

function applyNewSentenceLimit(
  reviews: DueSentenceReview[],
  remainingNewSentences: number,
) {
  const reviewSentences = reviews.filter(
    (review) => Number(review.review_count) > 0,
  );
  const newSentences = reviews
    .filter((review) => Number(review.review_count) === 0)
    .slice(0, remainingNewSentences);

  return [...reviewSentences, ...newSentences].sort(
    (left, right) =>
      new Date(left.next_review_at).getTime() -
      new Date(right.next_review_at).getTime(),
  );
}

export default function StudySentencesPage() {
  const configured = hasPublicEnv();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repairingReviewsRef = useRef(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState(() => {
    if (typeof window === "undefined") {
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
  const [showPinyinHint, setShowPinyinHint] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
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
  const [sentenceAnswer, setSentenceAnswer] = useState("");
  const [writingResult, setWritingResult] = useState<"correct" | "wrong" | "">(
    "",
  );
  const [repairingReviews, setRepairingReviews] = useState(false);
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [newSentencesStudiedToday, setNewSentencesStudiedToday] = useState(0);

  async function getNewSentencesStudiedToday(deckId = selectedDeckId) {
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("sentence_reviews")
      .select("id, sentence_cards!inner(id)", { count: "exact", head: true })
      .gt("review_count", 0)
      .gte("updated_at", startOfLocalDay(new Date()).toISOString());

    if (deckId !== allDecksValue) {
      query = query.eq("sentence_cards.deck_id", deckId);
    }

    const { count } = await query;
    return count || 0;
  }

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
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(200);

    if (deckId !== allDecksValue) {
      query = query.eq("sentence_cards.deck_id", deckId);
    }

    const { data } = await query;

    setNewSentencesStudiedToday(studiedToday);
    setReviews(
      applyNewSentenceLimit(
        (data || []) as DueSentenceReview[],
        remainingNewSentences,
      ),
    );
    setIndex(0);
    setShowAnswer(false);
    setShowPinyinHint(false);
    setSentenceAnswer("");
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
      .from("sentence_reviews")
      .select("*, sentence_cards!inner(*)")
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(200);

    let studiedTodayQuery = supabase
      .from("sentence_reviews")
      .select("id, sentence_cards!inner(id)", { count: "exact", head: true })
      .gt("review_count", 0)
      .gte("updated_at", todayStart);

    if (selectedDeckId !== allDecksValue) {
      query = query.eq("sentence_cards.deck_id", selectedDeckId);
      studiedTodayQuery = studiedTodayQuery.eq(
        "sentence_cards.deck_id",
        selectedDeckId,
      );
    }

    Promise.all([query, studiedTodayQuery]).then(
      async ([{ data }, countResult]) => {
      if (!active) {
        return;
      }

      const studiedToday = countResult.count || 0;
      const remainingNewSentences = Math.max(
        0,
        studySettings.daily_new_sentence_limit - studiedToday,
      );

      if (
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
              .lte("next_review_at", new Date().toISOString())
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
              ),
            );
            setIndex(0);
            setShowAnswer(false);
            setShowPinyinHint(false);
            setSentenceAnswer("");
            setWritingResult("");
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
        ),
      );
      setIndex(0);
      setShowAnswer(false);
      setShowPinyinHint(false);
      setSentenceAnswer("");
      setWritingResult("");
      setLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [configured, selectedDeckId, studySettings.daily_new_sentence_limit]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioSpeeds[audioSpeed];
    }
  }, [audioSpeed, showAnswer, index]);

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
  }

  function toggleWritingMode() {
    const nextValue = !writingMode;
    setWritingMode(nextValue);
    setSentenceAnswer("");
    setShowPinyinHint(false);
    setWritingResult("");
    window.localStorage.setItem("hanzi-sentence-writing-mode", String(nextValue));
  }

  function playSentenceAudio() {
    if (!card?.sentence_audio_url) {
      return;
    }

    const audio = new Audio(card.sentence_audio_url);
    audio.playbackRate = audioSpeeds[audioSpeed];
    audio.play().catch(() => {
      // Browsers can block autoplay if the click gesture is lost.
    });
  }

  function showAnswerAndPlayAudio() {
    setShowAnswer(true);
    setShowPinyinHint(false);
    playSentenceAudio();
  }

  function checkSentenceAnswer() {
    if (!card) {
      return;
    }

    const expected = normalizeSentenceHanzi(card.sentence_cn);
    const actual = normalizeSentenceHanzi(sentenceAnswer);

    if (actual && actual === expected) {
      setWritingResult("correct");
      showAnswerAndPlayAudio();
      return;
    }

    setWritingResult("wrong");
  }

  async function rate(rating: ReviewRating) {
    const current = reviews[index];
    if (!current?.sentence_cards) {
      return;
    }

    setSaving(true);
    const response = await fetchWithAuth("/api/review-sentence", {
      method: "POST",
      body: JSON.stringify({
        sentenceCardId: current.sentence_cards.id,
        rating,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      alert("Không thể lưu kết quả luyện câu.");
      return;
    }

    const nextIndex = index + 1;
    setShowAnswer(false);
    setShowPinyinHint(false);
    setSentenceAnswer("");
    setWritingResult("");

    if (nextIndex >= reviews.length) {
      await loadReviews();
    } else {
      setIndex(nextIndex);
    }
  }

  const current = reviews[index];
  const card = current?.sentence_cards;
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
                <div className="text-sm font-medium text-zinc-500">
                  Câu tiếng Việt
                </div>
                <div className="mt-3 text-3xl font-semibold leading-tight">
                  {card.sentence_vi}
                </div>
              </div>

              {!showAnswer ? (
                <div className="mt-10">
                  {writingMode ? (
                    <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        Gõ câu tiếng Trung
                        <textarea
                          className="mt-2 h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-2xl leading-relaxed outline-none focus:border-teal-700"
                          onChange={(event) => {
                            setSentenceAnswer(event.target.value);
                            setWritingResult("");
                          }}
                          onKeyDown={(event) => {
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
                    {card.sentence_pinyin ? (
                      showPinyinHint ? (
                        <div className="mt-3 text-base text-teal-800">
                          {card.sentence_pinyin}
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

                    {card.sentence_audio_url ? (
                      <div className="mt-5 flex justify-center">
                        <audio
                          controls
                          onLoadedMetadata={(event) => {
                            event.currentTarget.playbackRate =
                              audioSpeeds[audioSpeed];
                          }}
                          ref={audioRef}
                          src={card.sentence_audio_url}
                        />
                      </div>
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
