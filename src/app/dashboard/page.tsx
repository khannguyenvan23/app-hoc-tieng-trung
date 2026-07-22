"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/icons";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import {
  CommunityDeckSkeleton,
  DeckGridSkeleton,
  HskProgressSkeleton,
  WeakItemsSkeleton,
} from "@/components/loading-skeletons";
import { communityJoinUrl, hasZaloGroupUrl } from "@/lib/community";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import {
  defaultStudySettings,
  type StudySettings,
} from "@/lib/study-settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck, TemplateDeck } from "@/lib/types";

type DashboardStats = {
  totalCards: number;
  streakDays: number;
};

type HskProgressLevel = {
  slug: string;
  name: string;
  level: string;
  totalCards: number;
  copiedCards: number;
  learnedCards: number;
  percent: number;
};

type HskProgress = {
  levels: HskProgressLevel[];
  totalLearned: number;
  totalCards: number;
  completedLevels: number;
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

type SharedDeckSummary = {
  token: string;
  name: string;
  cardCount: number;
  sentenceCount: number;
  isOwner: boolean;
  updatedAt: string;
};

const emptyStats: DashboardStats = {
  totalCards: 0,
  streakDays: 0,
};

const emptyProgress: HskProgress = {
  levels: [],
  totalLearned: 0,
  totalCards: 0,
  completedLevels: 0,
};

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
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
  const [sharedDecks, setSharedDecks] = useState<SharedDeckSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [progress, setProgress] = useState<HskProgress>(emptyProgress);
  const [progressLoading, setProgressLoading] = useState(configured);
  const [loading, setLoading] = useState(configured);
  const [copyingTemplateId, setCopyingTemplateId] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [studySettings, setStudySettings] =
    useState<StudySettings>(defaultStudySettings);
  const [weakItems, setWeakItems] = useState<WeakReviewItem[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) {
        return;
      }

      const metadata = data.user.user_metadata as Record<string, unknown>;
      const profileName = String(
        metadata.full_name || metadata.display_name || metadata.name || "",
      ).trim();
      const emailName = data.user.email?.split("@")[0] || "bạn";
      setAccountName(profileName || emailName);
    });

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
      fetchWithAuth("/api/deck-shares"),
      fetchWithAuth("/api/study-settings"),
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
        reviewedCardsResult,
        reviewedSentenceCardsResult,
        templatesResponse,
        sharedDecksResponse,
        settingsResponse,
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

        if (sharedDecksResponse.ok) {
          const sharedDecksData = await sharedDecksResponse.json();
          setSharedDecks(
            (sharedDecksData.shares || []) as SharedDeckSummary[],
          );
        } else {
          setSharedDecks([]);
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
          streakDays: calculateStreak(reviewDates),
        });
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
    ).catch((error) => {
      if (!active) {
        return;
      }

      console.error(error);
      setTemplates([]);
      setSharedDecks([]);
      setWeakItems([]);
      setLoading(false);
    });

    fetchWithAuth("/api/progress")
      .then(async (response) => {
        if (!active) {
          return;
        }

        if (response.ok) {
          const progressData = await response.json();
          setProgress((progressData || emptyProgress) as HskProgress);
          return;
        }

        setProgress(emptyProgress);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        console.error(error);
        setProgress(emptyProgress);
      })
      .finally(() => {
        if (active) {
          setProgressLoading(false);
        }
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
      ...studySettings,
      daily_new_card_limit: 10,
      daily_new_sentence_limit: 5,
    };

    setSavingSettings(true);
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
  const showOnboarding = !loading && decks.length === 0;
  const starterPlanReady =
    studySettings.daily_new_card_limit === 10 &&
    studySettings.daily_new_sentence_limit === 5;

  return (
    <AuthGuard>
      <AppShell>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Xin chào,</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {accountName || "bạn"}
            </h1>
          </div>
          <PrimaryLink href="/decks/new">Tạo bộ thẻ</PrimaryLink>
        </div>

        {showOnboarding ? (
          <section className="app-surface mt-6 rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Bắt đầu học trong 3 bước</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Tài khoản mới chưa có thẻ. Làm nhanh 3 bước này để có HSK1, mục tiêu học
                  mỗi ngày và chế độ pinyin/audio sẵn sàng.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-800 dark:text-teal-300">
                Gợi ý cho người mới
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <div className="app-surface-muted rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    1
                  </span>
                  <h3 className="font-semibold">Thêm HSK1 cơ bản</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
                    ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={15} />
                Đang thêm HSK1...
              </span>
            )
                    : hsk1Template?.already_added
                      ? "Mở bộ HSK1"
                      : "Thêm HSK1"}
                </button>
              </div>

              <div className="app-surface-muted rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    2
                  </span>
                  <h3 className="font-semibold">Học 10 thẻ mỗi ngày</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Đặt nhịp học nhẹ: 10 từ mới và 5 câu mới mỗi ngày. Thẻ cũ đến hạn vẫn
                  được ôn bình thường.
                </p>
                <button
                  className={`mt-4 min-h-10 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${ starterPlanReady ? "border border-teal-700 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300" : "bg-teal-700 text-white hover:bg-teal-800" }`}
                  disabled={savingSettings || starterPlanReady}
                  onClick={applyStarterStudyPlan}
                  type="button"
                >
                  {starterPlanReady ? "Đã đặt 10 thẻ/ngày" : "Đặt mục tiêu 10 thẻ"}
                </button>
              </div>

              <div className="app-surface-muted rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                    3
                  </span>
                  <h3 className="font-semibold">Bật pinyin và audio</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
                className={`mt-4 text-sm ${ onboardingMessage.startsWith("Đã") ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300" }`}
              >
                {onboardingMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-teal-100 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/15 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-teal-800 dark:text-teal-300">
                Cộng đồng học viên
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Vào nhóm Zalo Tiếng Trung Hihi
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                Hỏi bài, nhận gợi ý bộ thẻ và học cùng mọi người mỗi ngày.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-10 items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                href={communityJoinUrl}
                rel="noreferrer"
                target="_blank"
              >
                {hasZaloGroupUrl ? "Vào nhóm Zalo" : "Nhắn Zalo nhận link"}
              </a>
              <Link
                className="inline-flex min-h-10 items-center rounded-md border border-teal-200 dark:border-teal-500/40 bg-white dark:bg-[#171a19] px-4 py-2 text-sm font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/25"
                href="/community"
              >
                Xem giới thiệu
              </Link>
            </div>
          </div>
        </section>

        {false && (
        <section className="app-surface mt-6 rounded-xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-teal-800 dark:text-teal-300">
                Chứng chỉ & cấp độ
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {progressLoading
                  ? "Đang tính tiến độ HSK"
                  : `Đã học ${progress.totalLearned} từ HSK`}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Theo dõi tiến độ từng cấp để thấy mình đang đi tới đâu.
              </p>
            </div>
            <div className="rounded-md border border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 text-sm text-teal-900 dark:text-teal-200">
              Hoàn thành{" "}
              <span className="text-lg font-semibold">
                {progressLoading
                  ? "..."
                  : `${progress.completedLevels}/${progress.levels.length}`}
              </span>{" "}
              cấp
            </div>
          </div>

          {progressLoading ? (
            <HskProgressSkeleton />
          ) : progress.levels.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
              Chưa có dữ liệu HSK. Hãy thêm bộ HSK mẫu và ôn ít nhất một thẻ.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {progress.levels.map((level) => {
                const remainingCards = Math.max(
                  0,
                  level.totalCards - level.learnedCards,
                );
                const copiedButNotStudied = Math.max(
                  0,
                  level.copiedCards - level.learnedCards,
                );

                return (
                  <div
                    className="rounded-md border border-zinc-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4"
                    key={level.slug}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{level.level}</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {level.name}
                        </p>
                      </div>
                      <span className="text-2xl font-semibold text-teal-800 dark:text-teal-300">
                        {level.percent}%
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/15">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${level.percent}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {level.learnedCards}/{level.totalCards} từ đã học
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {remainingCards === 0
                        ? "Đã hoàn thành cấp này."
                        : `Còn ${remainingCards} từ để đạt 100%.`}
                    </p>
                    {copiedButNotStudied > 0 ? (
                      <p className="mt-1 text-xs text-teal-800 dark:text-teal-300">
                        {copiedButNotStudied} từ đã có trong bộ, chưa ôn.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {false && (
          <section className="app-surface mt-6 rounded-xl p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-teal-800 dark:text-teal-300">
                  Chứng chỉ & cấp độ
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Đã học {progress.totalLearned} từ HSK
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Theo dõi tiến độ từng cấp để thấy mình đang đi tới đâu.
                </p>
              </div>
              <div className="rounded-md border border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 text-sm text-teal-900 dark:text-teal-200">
                Hoàn thành{" "}
                <span className="text-lg font-semibold">
                  {progress.completedLevels}/{progress.levels.length}
                </span>{" "}
                cấp
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {progress.levels.map((level) => {
                const remainingCards = Math.max(
                  0,
                  level.totalCards - level.learnedCards,
                );
                const copiedButNotStudied = Math.max(
                  0,
                  level.copiedCards - level.learnedCards,
                );

                return (
                  <div
                    className="rounded-md border border-zinc-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4"
                    key={level.slug}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{level.level}</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {level.name}
                        </p>
                      </div>
                      <span className="text-2xl font-semibold text-teal-800 dark:text-teal-300">
                        {level.percent}%
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/15">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${level.percent}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {level.learnedCards}/{level.totalCards} từ đã học
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {remainingCards === 0
                        ? "Đã hoàn thành cấp này."
                        : `Còn ${remainingCards} từ để đạt 100%.`}
                    </p>
                    {copiedButNotStudied > 0 ? (
                      <p className="mt-1 text-xs text-teal-800 dark:text-teal-300">
                        {copiedButNotStudied} từ đã có trong bộ, chưa ôn.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="flex flex-col gap-4 border-y border-zinc-200 dark:border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-teal-800 dark:text-teal-300">
                Tủ học cá nhân
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Bộ thẻ của bạn</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Chọn một bộ thẻ để thêm nội dung, chỉnh sửa hoặc bắt đầu học.
              </p>
            </div>
            <div className="flex min-w-40 items-center justify-between gap-4 rounded-md border border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 sm:block sm:text-center">
              <div className="text-sm font-medium text-teal-900 dark:text-teal-200">Streak học</div>
              <div>
                <span className="text-3xl font-semibold text-teal-800 dark:text-teal-300">
                  {loading ? "..." : stats.streakDays}
                </span>
                <span className="ml-2 text-xs text-teal-800 dark:text-teal-300 sm:ml-0 sm:block">
                  ngày liên tiếp
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <DeckGridSkeleton />
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
                    className="app-surface rounded-xl p-5 hover:border-teal-700"
                    href={`/decks/${deck.id}`}
                    key={deck.id}
                  >
                    <h3 className="font-semibold">{deck.name}</h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Tạo ngày{" "}
                      {new Date(deck.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase text-teal-800 dark:text-teal-300">
                Chia sẻ từ học viên
              </p>
              <h2 className="mt-1 text-xl font-semibold">Bộ thẻ cộng đồng</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Xem trước và thêm bản sao riêng từ các bộ thẻ đang được chia sẻ.
              </p>
            </div>
          </div>

          {loading ? (
            <CommunityDeckSkeleton />
          ) : sharedDecks.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Chưa có học viên nào chia sẻ bộ thẻ.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sharedDecks.map((sharedDeck) => (
                <article
                  className="app-surface rounded-xl p-5"
                  key={sharedDeck.token}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{sharedDeck.name}</h3>
                    {sharedDeck.isOwner ? (
                      <span className="shrink-0 rounded-full bg-teal-50 dark:bg-teal-500/15 px-2 py-1 text-xs font-medium text-teal-800 dark:text-teal-300">
                        Bạn chia sẻ
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {sharedDeck.cardCount} từ vựng · {sharedDeck.sentenceCount} câu
                  </p>
                  <Link
                    className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
                    href={`/shared-decks/${sharedDeck.token}`}
                  >
                    Xem bộ thẻ
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="app-surface mt-6 rounded-xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Cần học lại</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
                href="/study-sentences?weak=1"
              >
                Ôn câu yếu
              </Link>
            </div>
          </div>

          {loading ? (
            <WeakItemsSkeleton />
          ) : weakItems.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Chưa có thẻ nào bị quên nhiều lần.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {weakItems.map((item) => (
                <div
                  className="app-surface-muted rounded-xl p-4"
                  key={`${item.type}-${item.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-red-50 dark:bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300">
                      {item.type === "word" ? "Từ vựng" : "Câu"}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Quên {item.lapseCount} lần
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">
                    {item.title}
                  </div>
                  {item.detail ? (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
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
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Thêm bộ mẫu vào tài khoản của bạn. Mỗi user sẽ có bản copy và
                tiến độ ôn riêng.
              </p>
            </div>
          </div>

          {templateMessage ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">{templateMessage}</p>
          ) : null}

          {templates.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const alreadyAdded = Boolean(template.already_added);

                return (
                <div
                  className="app-surface rounded-xl p-5"
                  key={template.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.level ? (
                        <p className="mt-1 text-xs font-medium uppercase text-teal-800 dark:text-teal-300">
                          {template.level}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {template.card_count} thẻ
                    </span>
                  </div>
                  {template.description ? (
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {template.description}
                    </p>
                  ) : null}
                  <button
                    className={`mt-4 min-h-10 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-70 ${ alreadyAdded ? "border border-zinc-300 dark:border-white/15 bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400" : "bg-teal-700 text-white hover:bg-teal-800" }`}
                    disabled={Boolean(copyingTemplateId) || alreadyAdded}
                    onClick={() => copyTemplate(template.id)}
                    type="button"
                  >
                    {alreadyAdded
                      ? "Đã thêm"
                      : copyingTemplateId === template.id
                      ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={15} />
                Đang thêm...
              </span>
            )
                      : "Thêm bộ này"}
                  </button>
                  {alreadyAdded && template.user_deck_id ? (
                    <Link
                      className="mt-2 inline-flex min-h-10 items-center rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
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
            <DeckGridSkeleton />
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Chưa có bộ thẻ mẫu. Hãy chạy migration template trong Supabase.
            </p>
          )}
        </section>

      </AppShell>
    </AuthGuard>
  );
}
