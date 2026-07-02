"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck, TemplateDeck } from "@/lib/types";

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
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();
    const todayStart = startOfLocalDay(new Date()).toISOString();
    const todayEnd = endOfLocalDay(new Date()).toISOString();

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
        setLoading(false);
      },
    );

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
              {templates.map((template) => (
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
                    className="mt-4 min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    disabled={Boolean(copyingTemplateId)}
                    onClick={() => copyTemplate(template.id)}
                    type="button"
                  >
                    {copyingTemplateId === template.id
                      ? "Đang thêm..."
                      : "Thêm bộ này"}
                  </button>
                </div>
              ))}
            </div>
          ) : loading ? (
            <p className="mt-3 text-sm text-zinc-600">Đang tải bộ mẫu...</p>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              Chưa có bộ thẻ mẫu. Hãy chạy migration template trong Supabase.
            </p>
          )}
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
      </AppShell>
    </AuthGuard>
  );
}
