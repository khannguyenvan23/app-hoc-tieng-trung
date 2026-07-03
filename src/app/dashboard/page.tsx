"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck, ReviewRating, TemplateDeck } from "@/lib/types";

type DashboardStats = {
  totalCards: number;
  dueToday: number;
  newToday: number;
  streakDays: number;
};

type StudySettings = {
  daily_new_card_limit: number;
  daily_new_sentence_limit: number;
};

type UserCredits = {
  plan: string;
  credit_balance: number;
  lifetime_credits: number;
  monthly_credit_limit: number;
};

type ReviewStats = {
  studiedToday: number;
  ratingCounts: Record<ReviewRating, number>;
  sevenDays: { key: string; label: string; count: number }[];
  topDeckName: string;
  topDeckCount: number;
};

type WeakReviewItem = {
  id: string;
  type: "word" | "sentence";
  title: string;
  detail: string;
  deckName: string;
  weakScore: number;
  lapseCount: number;
};

const emptyStats: DashboardStats = {
  totalCards: 0,
  dueToday: 0,
  newToday: 0,
  streakDays: 0,
};

const defaultStudySettings: StudySettings = {
  daily_new_card_limit: 10,
  daily_new_sentence_limit: 5,
};

const defaultCredits: UserCredits = {
  plan: "free",
  credit_balance: 0,
  lifetime_credits: 0,
  monthly_credit_limit: 50,
};

const emptyReviewStats: ReviewStats = {
  studiedToday: 0,
  ratingCounts: {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  },
  sevenDays: [],
  topDeckName: "Chưa có dữ liệu",
  topDeckCount: 0,
};

const ratingLabels: Record<ReviewRating, string> = {
  again: "Quên",
  hard: "Khó",
  good: "Nhớ",
  easy: "Dễ",
};

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function toLocalDateKey(dateValue: string | Date) {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getLastSevenDays() {
  const today = startOfLocalDay(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(today, index - 6);
    return {
      key: toLocalDateKey(date),
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      count: 0,
    };
  });
}

function getNestedDeckName(review: unknown, relationName: string) {
  const relation = (review as Record<string, unknown>)[relationName];
  const item = Array.isArray(relation) ? relation[0] : relation;

  if (!item || typeof item !== "object") {
    return "Không rõ deck";
  }

  const decks = (item as Record<string, unknown>).decks;
  const deck = Array.isArray(decks) ? decks[0] : decks;

  if (!deck || typeof deck !== "object") {
    return "Không rõ deck";
  }

  return String((deck as Record<string, unknown>).name || "Không rõ deck");
}

function getRelationObject(source: unknown, relationName: string) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const relation = (source as Record<string, unknown>)[relationName];
  const item = Array.isArray(relation) ? relation[0] : relation;

  return item && typeof item === "object"
    ? (item as Record<string, unknown>)
    : null;
}

function getDeckNameFromItem(item: Record<string, unknown> | null) {
  const deck = getRelationObject(item, "decks");

  return String(deck?.name || "Khong ro deck");
}

function buildWeakReviewItems(
  cardReviews: unknown[],
  sentenceReviews: unknown[],
) {
  const cardItems = cardReviews.flatMap((review) => {
    const row = review as {
      id?: string;
      weak_score?: number | null;
      lapse_count?: number | null;
    };
    const card = getRelationObject(review, "cards");

    if (!row.id || !card) {
      return [];
    }

    return [
      {
        id: row.id,
        type: "word" as const,
        title: String(card.chinese || "The tu vung"),
        detail: String(card.meaning_vi || card.pinyin || ""),
        deckName: getDeckNameFromItem(card),
        weakScore: Number(row.weak_score || 0),
        lapseCount: Number(row.lapse_count || 0),
      },
    ];
  });
  const sentenceItems = sentenceReviews.flatMap((review) => {
    const row = review as {
      id?: string;
      weak_score?: number | null;
      lapse_count?: number | null;
    };
    const card = getRelationObject(review, "sentence_cards");

    if (!row.id || !card) {
      return [];
    }

    return [
      {
        id: row.id,
        type: "sentence" as const,
        title: String(card.sentence_cn || "Cau luyen tap"),
        detail: String(card.sentence_vi || card.sentence_pinyin || ""),
        deckName: getDeckNameFromItem(card),
        weakScore: Number(row.weak_score || 0),
        lapseCount: Number(row.lapse_count || 0),
      },
    ];
  });

  return [...cardItems, ...sentenceItems]
    .sort((left, right) => right.weakScore - left.weakScore)
    .slice(0, 8);
}

function calculateReviewStats(
  cardReviews: unknown[],
  sentenceReviews: unknown[],
) {
  const todayKey = toLocalDateKey(new Date());
  const sevenDays = getLastSevenDays();
  const sevenDayMap = new Map(sevenDays.map((day) => [day.key, day]));
  const ratingCounts: Record<ReviewRating, number> = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  };
  const deckCounts = new Map<string, number>();
  let studiedToday = 0;

  const handleReview = (review: unknown, relationName: string) => {
    const row = review as {
      updated_at?: string;
      last_rating?: ReviewRating | null;
    };

    if (!row.updated_at) {
      return;
    }

    const dayKey = toLocalDateKey(row.updated_at);

    if (dayKey === todayKey) {
      studiedToday += 1;
    }

    const day = sevenDayMap.get(dayKey);

    if (day) {
      day.count += 1;
    }

    if (row.last_rating && row.last_rating in ratingCounts) {
      ratingCounts[row.last_rating] += 1;
    }

    const deckName = getNestedDeckName(review, relationName);
    deckCounts.set(deckName, (deckCounts.get(deckName) || 0) + 1);
  };

  cardReviews.forEach((review) => handleReview(review, "cards"));
  sentenceReviews.forEach((review) => handleReview(review, "sentence_cards"));

  const topDeck = Array.from(deckCounts.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0];

  return {
    studiedToday,
    ratingCounts,
    sevenDays,
    topDeckName: topDeck?.[0] || "Chưa có dữ liệu",
    topDeckCount: topDeck?.[1] || 0,
  };
}

function calculateStreak(reviewDates: string[]) {
  const studiedDays = new Set(reviewDates.map(toLocalDateKey));

  if (studiedDays.size === 0) {
    return 0;
  }

  const today = startOfLocalDay(new Date());
  const yesterday = addLocalDays(today, -1);
  let cursor = studiedDays.has(toLocalDateKey(today)) ? today : yesterday;
  let streak = 0;

  while (studiedDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }

  return streak;
}

export default function DashboardPage() {
  const router = useRouter();
  const configured = hasPublicEnv();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [templates, setTemplates] = useState<TemplateDeck[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(configured);
  const [copyingTemplateId, setCopyingTemplateId] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [reviewStats, setReviewStats] = useState<ReviewStats>(emptyReviewStats);
  const [weakItems, setWeakItems] = useState<WeakReviewItem[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [credits, setCredits] = useState<UserCredits>(defaultCredits);
  const [creditsMessage, setCreditsMessage] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();
    const todayStart = startOfLocalDay(new Date()).toISOString();
    const todayEnd = endOfLocalDay(new Date()).toISOString();
    const sevenDaysStart = addLocalDays(startOfLocalDay(new Date()), -6).toISOString();

    Promise.all([
      supabase.from("decks").select("*").order("created_at", {
        ascending: false,
      }),
      supabase.from("cards").select("id", { count: "exact", head: true }),
      supabase
        .from("sentence_cards")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .lte("next_review_at", todayEnd),
      supabase
        .from("sentence_reviews")
        .select("id", { count: "exact", head: true })
        .lte("next_review_at", todayEnd),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      supabase
        .from("sentence_cards")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      supabase
        .from("reviews")
        .select("updated_at")
        .gt("review_count", 0)
        .order("updated_at", { ascending: false })
        .limit(250),
      supabase
        .from("sentence_reviews")
        .select("updated_at")
        .gt("review_count", 0)
        .order("updated_at", { ascending: false })
        .limit(250),
      fetchWithAuth("/api/template-decks"),
      fetchWithAuth("/api/study-settings"),
      supabase
        .from("reviews")
        .select("updated_at, last_rating, cards!inner(decks(name))")
        .gt("review_count", 0)
        .gte("updated_at", sevenDaysStart)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("sentence_reviews")
        .select("updated_at, last_rating, sentence_cards!inner(decks(name))")
        .gt("review_count", 0)
        .gte("updated_at", sevenDaysStart)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("reviews")
        .select(
          "id, weak_score, lapse_count, cards!inner(chinese, pinyin, meaning_vi, decks(name))",
        )
        .gte("weak_score", 2)
        .order("weak_score", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("sentence_reviews")
        .select(
          "id, weak_score, lapse_count, sentence_cards!inner(sentence_cn, sentence_pinyin, sentence_vi, decks(name))",
        )
        .gte("weak_score", 2)
        .order("weak_score", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(8),
    ]).then(
      async ([
        decksResult,
        cardsCountResult,
        sentenceCardsCountResult,
        dueCardsResult,
        dueSentenceCardsResult,
        newCardsResult,
        newSentenceCardsResult,
        reviewedCardsResult,
        reviewedSentenceCardsResult,
        templatesResponse,
        settingsResponse,
        sevenDayReviewsResult,
        sevenDaySentenceReviewsResult,
        weakReviewsResult,
        weakSentenceReviewsResult,
      ]) => {
        if (!active) {
          return;
        }

        const reviewDates = [
          ...((reviewedCardsResult.data || []) as { updated_at: string }[]),
          ...((reviewedSentenceCardsResult.data || []) as {
            updated_at: string;
          }[]),
        ].map((review) => review.updated_at);

        if (templatesResponse.ok) {
          const templateData = await templatesResponse.json();
          setTemplates((templateData.templates || []) as TemplateDeck[]);
        } else {
          setTemplates([]);
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setStudySettings(
            (settingsData.settings || defaultStudySettings) as StudySettings,
          );
        }

        setDecks((decksResult.data || []) as Deck[]);
        setStats({
          totalCards:
            (cardsCountResult.count || 0) +
            (sentenceCardsCountResult.count || 0),
          dueToday:
            (dueCardsResult.count || 0) + (dueSentenceCardsResult.count || 0),
          newToday:
            (newCardsResult.count || 0) +
            (newSentenceCardsResult.count || 0),
          streakDays: calculateStreak(reviewDates),
        });
        setReviewStats(
          calculateReviewStats(
            sevenDayReviewsResult.data || [],
            sevenDaySentenceReviewsResult.data || [],
          ),
        );
        setWeakItems(
          buildWeakReviewItems(
            weakReviewsResult.error ? [] : weakReviewsResult.data || [],
            weakSentenceReviewsResult.error
              ? []
              : weakSentenceReviewsResult.data || [],
          ),
        );
        setLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;

    fetchWithAuth("/api/credits").then(async (response) => {
      const data = await response.json().catch(() => null);

      if (!active) {
        return;
      }

      if (!response.ok) {
        setCreditsMessage(data?.error || "Không thể tải credit.");
        return;
      }

      setCredits((data.credits || defaultCredits) as UserCredits);
      setCreditsMessage("");
    });

    return () => {
      active = false;
    };
  }, [configured]);

  async function copyTemplate(templateDeckId: string) {
    setCopyingTemplateId(templateDeckId);
    setTemplateMessage("");

    const response = await fetchWithAuth("/api/template-decks", {
      method: "POST",
      body: JSON.stringify({ templateDeckId }),
    });
    const data = await response.json();
    setCopyingTemplateId("");

    if (!response.ok) {
      if (data.alreadyAdded) {
        setTemplateMessage(data.error || "Bo the nay da duoc them roi.");
        return;
      }

      setTemplateMessage(data.error || "Không thể thêm bộ thẻ mẫu.");
      return;
    }

    router.push(`/decks/${data.deckId}`);
  }

  function updateStudySetting(name: keyof StudySettings, value: string) {
    const numericValue = Math.min(100, Math.max(0, Number(value) || 0));
    setStudySettings((current) => ({ ...current, [name]: numericValue }));
    setSettingsMessage("");
  }

  async function saveStudySettings() {
    setSavingSettings(true);
    setSettingsMessage("");

    const response = await fetchWithAuth("/api/study-settings", {
      method: "PUT",
      body: JSON.stringify(studySettings),
    });
    const data = await response.json();
    setSavingSettings(false);

    if (!response.ok) {
      setSettingsMessage(data.error || "Không thể lưu cài đặt học.");
      return;
    }

    setStudySettings((data.settings || studySettings) as StudySettings);
    setSettingsMessage("Đã lưu giới hạn học mỗi ngày.");
  }

  async function copyStarterTemplate() {
    if (!hsk1Template) {
      setOnboardingMessage("Chưa tìm thấy bộ HSK1 mẫu. Hãy thêm template HSK1 trong Supabase trước.");
      return;
    }

    if (hsk1Template.already_added && hsk1Template.user_deck_id) {
      router.push(`/decks/${hsk1Template.user_deck_id}`);
      return;
    }

    setCopyingTemplateId(hsk1Template.id);
    setOnboardingMessage("");

    const response = await fetchWithAuth("/api/template-decks", {
      method: "POST",
      body: JSON.stringify({ templateDeckId: hsk1Template.id }),
    });
    const data = await response.json();
    setCopyingTemplateId("");

    if (!response.ok) {
      if (data.alreadyAdded && data.deckId) {
        router.push(`/decks/${data.deckId}`);
        return;
      }

      setOnboardingMessage(data.error || "Không thể thêm bộ HSK1 mẫu.");
      return;
    }

    router.push(`/decks/${data.deckId}`);
  }

  async function applyStarterStudyPlan() {
    const starterSettings = {
      daily_new_card_limit: 10,
      daily_new_sentence_limit: 5,
    };

    setSavingSettings(true);
    setSettingsMessage("");
    setOnboardingMessage("");
    setStudySettings(starterSettings);

    const response = await fetchWithAuth("/api/study-settings", {
      method: "PUT",
      body: JSON.stringify(starterSettings),
    });
    const data = await response.json();
    setSavingSettings(false);

    if (!response.ok) {
      setOnboardingMessage(data.error || "Không thể đặt mục tiêu học mỗi ngày.");
      setStudySettings(studySettings);
      return;
    }

    setStudySettings((data.settings || starterSettings) as StudySettings);
    setOnboardingMessage("Đã đặt mục tiêu 10 từ mới và 5 câu mới mỗi ngày.");
  }

  function enablePinyinAndStartStudy() {
    window.localStorage.setItem("hanzi-show-pinyin", "true");
    router.push("/study");
  }

  const hsk1Template = templates.find((template) => {
    const name = template.name.toLowerCase();
    const slug = template.slug.toLowerCase();
    const level = template.level?.toLowerCase() || "";

    return name.includes("hsk1") || slug.includes("hsk1") || level === "hsk1";
  });
  const showOnboarding = !loading && stats.totalCards === 0;
  const starterPlanReady =
    studySettings.daily_new_card_limit === 10 &&
    studySettings.daily_new_sentence_limit === 5;

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bộ thẻ</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Sắp xếp từ vựng theo HSK, chủ đề hoặc khóa học.
            </p>
          </div>
          <PrimaryLink href="/decks/new">Tạo bộ thẻ</PrimaryLink>
        </div>

        {showOnboarding ? (
          <section className="mt-6 rounded-lg border border-teal-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Bắt đầu học trong 3 bước</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Tài khoản mới chưa có thẻ. Làm nhanh 3 bước này để có HSK1, mục tiêu học
                  mỗi ngày và chế độ pinyin/audio sẵn sàng.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
                Gợi ý cho người mới
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    1
                  </span>
                  <h3 className="font-semibold">Thêm HSK1 cơ bản</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Copy bộ HSK1 mẫu vào tài khoản để có từ vựng học ngay, không phải tự nhập
                  từ đầu.
                </p>
                <button
                  className="mt-4 min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  disabled={!hsk1Template || Boolean(copyingTemplateId)}
                  onClick={copyStarterTemplate}
                  type="button"
                >
                  {copyingTemplateId === hsk1Template?.id
                    ? "Đang thêm HSK1..."
                    : hsk1Template?.already_added
                      ? "Mở bộ HSK1"
                      : "Thêm HSK1"}
                </button>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    2
                  </span>
                  <h3 className="font-semibold">Học 10 thẻ mỗi ngày</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Đặt nhịp học nhẹ: 10 từ mới và 5 câu mới mỗi ngày. Thẻ cũ đến hạn vẫn
                  được ôn bình thường.
                </p>
                <button
                  className={`mt-4 min-h-10 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                    starterPlanReady
                      ? "border border-teal-700 bg-teal-50 text-teal-800"
                      : "bg-teal-700 text-white hover:bg-teal-800"
                  }`}
                  disabled={savingSettings || starterPlanReady}
                  onClick={applyStarterStudyPlan}
                  type="button"
                >
                  {starterPlanReady ? "Đã đặt 10 thẻ/ngày" : "Đặt mục tiêu 10 thẻ"}
                </button>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    3
                  </span>
                  <h3 className="font-semibold">Bật pinyin và audio</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Pinyin sẽ hiện khi ôn tập. Audio tự phát khi bấm hiện đáp án, giúp nghe
                  phát âm ngay từ buổi đầu.
                </p>
                <button
                  className="mt-4 min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  onClick={enablePinyinAndStartStudy}
                  type="button"
                >
                  Bật và bắt đầu học
                </button>
              </div>
            </div>

            {onboardingMessage ? (
              <p
                className={`mt-4 text-sm ${
                  onboardingMessage.startsWith("Đã")
                    ? "text-teal-700"
                    : "text-red-700"
                }`}
              >
                {onboardingMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-zinc-500">Tổng số thẻ</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "..." : stats.totalCards}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Từ vựng và câu luyện tập</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-zinc-500">Cần ôn hôm nay</div>
            <div className="mt-2 text-3xl font-semibold text-teal-800">
              {loading ? "..." : stats.dueToday}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Tính đến hết hôm nay</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-zinc-500">Mới import hôm nay</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "..." : stats.newToday}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Thẻ vừa thêm trong ngày</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-zinc-500">Streak học</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "..." : stats.streakDays}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Ngày học liên tiếp</p>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Credit AI</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Credit dùng để import bằng AI và tạo audio. Ôn tập thẻ đã có sẵn không
                tốn credit.
              </p>
              {creditsMessage ? (
                <p className="mt-2 text-sm text-red-700">{creditsMessage}</p>
              ) : null}
            </div>
            <div className="min-w-36 rounded-md border border-teal-100 bg-teal-50 px-4 py-3 text-right">
              <div className="text-xs font-medium uppercase text-teal-800">
                Còn lại
              </div>
              <div className="mt-1 text-3xl font-semibold text-teal-900">
                {credits.credit_balance}
              </div>
              <div className="mt-1 text-xs text-teal-800">
                Gói {credits.plan}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Import từ bằng AI</div>
              <p className="mt-1 text-zinc-600">1 credit / từ tạo nghĩa, pinyin và câu ví dụ.</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Tạo câu luyện tập</div>
              <p className="mt-1 text-zinc-600">2 credit / câu AI tạo từ một từ vựng.</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Tạo audio</div>
              <p className="mt-1 text-zinc-600">1 credit / file audio từ vựng hoặc câu.</p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Bộ thẻ của bạn</h2>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Đang tải bộ thẻ...</p>
            ) : decks.length === 0 ? (
              <EmptyState
                action={<PrimaryLink href="/decks/new">Tạo bộ thẻ</PrimaryLink>}
                body="Bắt đầu với một chủ đề như HSK2, ăn uống hoặc giao tiếp hằng ngày."
                title="Chưa có bộ thẻ nào"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {decks.map((deck) => (
                  <Link
                    className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm hover:border-teal-700"
                    href={`/decks/${deck.id}`}
                    key={deck.id}
                  >
                    <h3 className="font-semibold">{deck.name}</h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      Tạo ngày{" "}
                      {new Date(deck.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Giới hạn học mỗi ngày</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Thẻ cũ đến hạn vẫn được ôn bình thường. Giới hạn này chỉ áp
                dụng cho thẻ mới chưa học.
              </p>
            </div>
            <button
              className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={savingSettings}
              onClick={saveStudySettings}
              type="button"
            >
              {savingSettings ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Từ mới mỗi ngày
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                max={100}
                min={0}
                onChange={(event) =>
                  updateStudySetting(
                    "daily_new_card_limit",
                    event.target.value,
                  )
                }
                type="number"
                value={studySettings.daily_new_card_limit}
              />
            </label>
            <label className="block text-sm font-medium">
              Câu mới mỗi ngày
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                max={100}
                min={0}
                onChange={(event) =>
                  updateStudySetting(
                    "daily_new_sentence_limit",
                    event.target.value,
                  )
                }
                type="number"
                value={studySettings.daily_new_sentence_limit}
              />
            </label>
          </div>

          {settingsMessage ? (
            <p
              className={`mt-3 text-sm ${
                settingsMessage.startsWith("Đã") ? "text-teal-700" : "text-red-700"
              }`}
            >
              {settingsMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Thống kê học</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Dựa trên lượt ôn gần nhất của từng thẻ trong 7 ngày qua.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-zinc-500">Đã học hôm nay</div>
              <div className="text-3xl font-semibold text-teal-800">
                {loading ? "..." : reviewStats.studiedToday}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
            <div>
              <h3 className="text-sm font-semibold">Quên / Khó / Nhớ / Dễ</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(ratingLabels) as ReviewRating[]).map((rating) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    key={rating}
                  >
                    <div className="text-xs text-zinc-500">
                      {ratingLabels[rating]}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {loading ? "..." : reviewStats.ratingCounts[rating]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">7 ngày gần nhất</h3>
              <div className="mt-3 flex h-40 items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                {reviewStats.sevenDays.map((day) => {
                  const maxCount = Math.max(
                    1,
                    ...reviewStats.sevenDays.map((item) => item.count),
                  );
                  const height = `${Math.max(8, (day.count / maxCount) * 100)}%`;

                  return (
                    <div
                      className="flex h-full flex-1 flex-col justify-end gap-2 text-center"
                      key={day.key}
                    >
                      <div className="text-xs font-medium text-zinc-600">
                        {day.count}
                      </div>
                      <div
                        className="mx-auto w-full rounded-t bg-teal-700"
                        style={{ height }}
                      />
                      <div className="text-[11px] text-zinc-500">
                        {day.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Deck học nhiều nhất</h3>
              <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-lg font-semibold">
                  {loading ? "..." : reviewStats.topDeckName}
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {loading
                    ? "Đang tải..."
                    : `${reviewStats.topDeckCount} lượt ôn trong 7 ngày qua`}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Cần học lại</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Thẻ bấm Quên nhiều lần sẽ tự vào nhóm yếu để ôn gấp.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-10 items-center rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                href="/study?weak=1"
              >
                Ôn từ yếu
              </Link>
              <Link
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                href="/study-sentences?weak=1"
              >
                Ôn câu yếu
              </Link>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-600">Đang tải nhóm yếu...</p>
          ) : weakItems.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">
              Chưa có thẻ nào bị quên nhiều lần.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {weakItems.map((item) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  key={`${item.type}-${item.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      {item.type === "word" ? "Từ vựng" : "Câu"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Quên {item.lapseCount} lần
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">
                    {item.title}
                  </div>
                  {item.detail ? (
                    <p className="mt-1 text-sm text-zinc-600">{item.detail}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-zinc-500">
                    {item.deckName} · điểm yếu {item.weakScore}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Bộ thẻ mẫu</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Thêm bộ mẫu vào tài khoản của bạn. Mỗi user sẽ có bản copy và
                tiến độ ôn riêng.
              </p>
            </div>
          </div>

          {templateMessage ? (
            <p className="mt-3 text-sm text-red-700">{templateMessage}</p>
          ) : null}

          {templates.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const alreadyAdded = Boolean(template.already_added);

                return (
                <div
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                  key={template.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.level ? (
                        <p className="mt-1 text-xs font-medium uppercase text-teal-800">
                          {template.level}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                      {template.card_count} thẻ
                    </span>
                  </div>
                  {template.description ? (
                    <p className="mt-3 text-sm text-zinc-600">
                      {template.description}
                    </p>
                  ) : null}
                  <button
                    className={`mt-4 min-h-10 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-70 ${
                      alreadyAdded
                        ? "border border-zinc-300 bg-zinc-100 text-zinc-600"
                        : "bg-teal-700 text-white hover:bg-teal-800"
                    }`}
                    disabled={Boolean(copyingTemplateId) || alreadyAdded}
                    onClick={() => copyTemplate(template.id)}
                    type="button"
                  >
                    {alreadyAdded
                      ? "Đã thêm"
                      : copyingTemplateId === template.id
                      ? "Đang thêm..."
                      : "Thêm bộ này"}
                  </button>
                  {alreadyAdded && template.user_deck_id ? (
                    <Link
                      className="mt-2 inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                      href={`/decks/${template.user_deck_id}`}
                    >
                      Mở bộ
                    </Link>
                  ) : null}
                </div>
                );
              })}
            </div>
          ) : loading ? (
            <p className="mt-3 text-sm text-zinc-600">Đang tải bộ mẫu...</p>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              Chưa có bộ thẻ mẫu. Hãy chạy migration template trong Supabase.
            </p>
          )}
        </section>

      </AppShell>
    </AuthGuard>
  );
}
