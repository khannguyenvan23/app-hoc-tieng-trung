"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Deck } from "@/lib/types";

type DashboardStats = {
  totalCards: number;
  dueToday: number;
  newToday: number;
  streakDays: number;
};

const emptyStats: DashboardStats = {
  totalCards: 0,
  dueToday: 0,
  newToday: 0,
  streakDays: 0,
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
  const configured = hasPublicEnv();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(configured);

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
    ]).then(
      ([
        decksResult,
        cardsCountResult,
        sentenceCardsCountResult,
        dueCardsResult,
        dueSentenceCardsResult,
        newCardsResult,
        newSentenceCardsResult,
        reviewedCardsResult,
        reviewedSentenceCardsResult,
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

        <section className="mt-6">
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
                  <h2 className="font-semibold">{deck.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Tạo ngày{" "}
                    {new Date(deck.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </AppShell>
    </AuthGuard>
  );
}
