"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AdminAnalytics } from "@/components/admin-analytics";
import { AuthGuard } from "@/components/auth-guard";
import { Icon } from "@/components/icons";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";

type ChartPoint = {
  key: string;
  label: string;
  count: number;
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

const emptyProgress: HskProgress = {
  levels: [],
  totalLearned: 0,
  totalCards: 0,
  completedLevels: 0,
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dayMs() {
  return 86_400_000;
}

// Consecutive days (ending today, or yesterday if today has nothing yet) with
// at least one new word, plus the longest such run on record.
function computeStreaks(activeDayKeys: Set<string>) {
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!activeDayKeys.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (activeDayKeys.has(toDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sortedTimes = Array.from(activeDayKeys)
    .map((key) => new Date(`${key}T00:00:00`).getTime())
    .sort((left, right) => left - right);

  let longest = 0;
  let run = 0;
  let previous: number | null = null;

  for (const time of sortedTimes) {
    run = previous !== null && time - previous === dayMs() ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }

  return { current, longest };
}

function getMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    date.setMonth(date.getMonth() - index);

    return {
      key: toMonthKey(date),
      label: date.toLocaleDateString("vi-VN", {
        month: "long",
        year: "numeric",
      }),
      shortLabel: date.toLocaleDateString("vi-VN", {
        month: "2-digit",
        year: "2-digit",
      }),
      start: date,
    };
  });
}

function getErrorMessage(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";

  if (message.includes("first_reviewed_at")) {
    return "Thiếu dữ liệu ngày học đầu tiên. Hãy chạy migration 015_first_reviewed_at.sql trong Supabase.";
  }

  return "Không thể tải thống kê học tập. Vui lòng thử lại.";
}

async function fetchLearnedReviewDates(startIso: string) {
  const startTime = new Date(startIso).getTime();
  const response = await fetchWithAuth("/api/statistics");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Không thể tải thống kê học tập.");
  }

  return ((data.learnedDates || []) as string[]).filter(
    (value) => new Date(value).getTime() >= startTime,
  );
}

function BarChart({
  data,
  minWidth,
}: {
  data: ChartPoint[];
  minWidth: number;
}) {
  const maxCount = Math.max(1, ...data.map((item) => item.count));

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid h-64 grid-flow-col auto-cols-fr items-end gap-2 border-b border-zinc-200 dark:border-white/10 px-2 pt-3"
        style={{ minWidth }}
      >
        {data.map((item) => {
          const barHeight =
            item.count === 0
              ? 4
              : Math.max(10, Math.round((item.count / maxCount) * 164));
          const isPeak = item.count > 0 && item.count === maxCount;

          return (
            <div
              aria-label={`${item.label}: ${item.count} từ`}
              className="group flex h-full min-w-0 flex-col justify-end text-center"
              key={item.key}
              title={`${item.label}: ${item.count} từ`}
            >
              <span className="mb-1 h-5 text-xs font-medium text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-400">
                {item.count}
              </span>
              <div className="flex h-44 items-end justify-center">
                <div
                  className={`w-3/4 min-w-2 max-w-10 rounded-t-md transition-colors ${
                    item.count > 0
                      ? isPeak
                        ? "bg-gradient-to-t from-teal-600 to-teal-400 dark:from-teal-500 dark:to-teal-300"
                        : "bg-teal-600 group-hover:bg-teal-500 dark:bg-teal-500/80 dark:group-hover:bg-teal-400"
                      : "bg-zinc-200 dark:bg-white/10"
                  }`}
                  style={{ height: barHeight }}
                />
              </div>
              <span className="mt-2 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function heatmapTone(count: number) {
  if (count <= 0) {
    return "bg-zinc-100 dark:bg-white/[0.06]";
  }
  if (count < 3) {
    return "bg-teal-200 dark:bg-teal-500/30";
  }
  if (count < 6) {
    return "bg-teal-400 dark:bg-teal-500/60";
  }
  if (count < 12) {
    return "bg-teal-600 dark:bg-teal-400/80";
  }
  return "bg-teal-800 dark:bg-teal-300";
}

function ActivityHeatmap({ days }: { days: ChartPoint[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid grid-flow-col grid-rows-7 gap-1"
        style={{ minWidth: Math.ceil(days.length / 7) * 15 }}
      >
        {days.map((day) => (
          <div
            aria-label={`${day.label}: ${day.count} từ`}
            className={`size-3 rounded-[3px] ${heatmapTone(day.count)}`}
            key={day.key}
            title={`${day.label}: ${day.count} từ mới`}
          />
        ))}
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const configured = hasPublicEnv();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const [learnedDates, setLearnedDates] = useState<string[]>([]);
  const [progress, setProgress] = useState<HskProgress>(emptyProgress);
  const [progressLoading, setProgressLoading] = useState(configured);
  const [loading, setLoading] = useState(configured);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const oldestMonth = monthOptions[monthOptions.length - 1].start;

    fetchLearnedReviewDates(oldestMonth.toISOString())
      .then((dates) => {
        if (!active) {
          return;
        }

        setLearnedDates(dates);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
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
      .catch(() => {
        if (!active) {
          return;
        }

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
  }, [configured, monthOptions]);

  const statistics = useMemo(() => {
    const dailyCounts = new Map<string, number>();
    const monthlyCounts = new Map<string, number>();

    learnedDates.forEach((value) => {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const dateKey = toDateKey(date);
      const monthKey = toMonthKey(date);
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
      monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
    });

    const [selectedYear, selectedMonthNumber] = selectedMonth
      .split("-")
      .map(Number);
    const daysInSelectedMonth = new Date(
      selectedYear,
      selectedMonthNumber,
      0,
    ).getDate();
    const dailyData = Array.from(
      { length: daysInSelectedMonth },
      (_, index): ChartPoint => {
        const day = index + 1;
        const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;

        return {
          key,
          label: String(day),
          count: dailyCounts.get(key) || 0,
        };
      },
    );
    const monthlyData = monthOptions
      .slice()
      .reverse()
      .map(
        (month): ChartPoint => ({
          key: month.key,
          label: month.shortLabel,
          count: monthlyCounts.get(month.key) || 0,
        }),
      );
    const todayCount = dailyCounts.get(toDateKey(new Date())) || 0;
    const currentMonthCount = monthlyCounts.get(monthOptions[0].key) || 0;
    const bestDay = Array.from(dailyCounts.entries()).sort(
      (left, right) => right[1] - left[1],
    )[0];

    const activeDayKeys = new Set(
      Array.from(dailyCounts.entries())
        .filter(([, count]) => count > 0)
        .map(([key]) => key),
    );
    const { current: currentStreak, longest: longestStreak } =
      computeStreaks(activeDayKeys);

    // Last 18 weeks of daily counts, oldest first, for the activity heatmap.
    const heatmapWeeks = 18;
    const heatmapDays: ChartPoint[] = [];
    const heatmapStart = new Date();
    heatmapStart.setHours(0, 0, 0, 0);
    heatmapStart.setDate(heatmapStart.getDate() - (heatmapWeeks * 7 - 1));

    for (let index = 0; index < heatmapWeeks * 7; index += 1) {
      const date = new Date(heatmapStart);
      date.setDate(date.getDate() + index);
      const key = toDateKey(date);

      heatmapDays.push({
        key,
        label: date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        count: dailyCounts.get(key) || 0,
      });
    }

    return {
      activeDayCount: activeDayKeys.size,
      bestDayCount: bestDay?.[1] || 0,
      currentMonthCount,
      currentStreak,
      dailyData,
      heatmapDays,
      longestStreak,
      monthlyData,
      selectedMonthCount: monthlyCounts.get(selectedMonth) || 0,
      todayCount,
      totalCount: learnedDates.length,
    };
  }, [learnedDates, monthOptions, selectedMonth]);

  const selectedMonthLabel =
    monthOptions.find((month) => month.key === selectedMonth)?.label || "Tháng";

  return (
    <AuthGuard>
      <AppShell>
        <AdminAnalytics />
        <div>
          <h1 className="text-2xl font-semibold">Thống kê học từ vựng</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Mỗi từ chỉ được tính một lần vào ngày bạn học lần đầu.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Với thẻ cũ chưa lưu ngày học đầu tiên, app dùng ngày ôn gần nhất.
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-md border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/15 px-4 py-3 text-sm leading-6 text-red-800 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <section className="mt-6 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm">
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
                Theo dõi HSK1 đến HSK5 theo số từ đã ôn ít nhất một lần.
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
            <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
              Đang tải tiến độ HSK...
            </p>
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

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              icon: "flame",
              label: "Chuỗi ngày học",
              value: statistics.currentStreak,
              note: `Dài nhất ${statistics.longestStreak} ngày`,
            },
            {
              icon: "calendar",
              label: "Ngày có học",
              value: statistics.activeDayCount,
              note: "trong 12 tháng",
            },
            {
              icon: "plus",
              label: "Hôm nay",
              value: statistics.todayCount,
              note: "từ mới",
            },
            {
              icon: "trophy",
              label: "Kỷ lục một ngày",
              value: statistics.bestDayCount,
              note: "từ mới",
            },
          ].map((item) => (
            <div
              className="rounded-[var(--radius-lg)] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-4 shadow-[var(--shadow-sm)]"
              key={item.label}
            >
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                  <Icon name={item.icon} size={16} />
                </span>
                {item.label}
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums text-teal-800 dark:text-teal-200">
                {loading ? "..." : item.value}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {item.note}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[var(--radius-lg)] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Lịch học từ mới</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                18 tuần gần nhất — ô càng đậm là ngày học càng nhiều từ.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Ít
              <span className="size-3 rounded-[3px] bg-zinc-100 dark:bg-white/[0.06]" />
              <span className="size-3 rounded-[3px] bg-teal-200 dark:bg-teal-500/30" />
              <span className="size-3 rounded-[3px] bg-teal-400 dark:bg-teal-500/60" />
              <span className="size-3 rounded-[3px] bg-teal-600 dark:bg-teal-400/80" />
              <span className="size-3 rounded-[3px] bg-teal-800 dark:bg-teal-300" />
              Nhiều
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Đang tải...
              </p>
            ) : (
              <ActivityHeatmap days={statistics.heatmapDays} />
            )}
          </div>
        </section>

        <section className="mt-8 border-t border-zinc-200 dark:border-white/10 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Từ đã học theo ngày</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {loading
                  ? "Đang tải dữ liệu..."
                  : `${statistics.selectedMonthCount} từ trong ${selectedMonthLabel}.`}
              </p>
            </div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Xem tháng
              <select
                className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-3 text-sm outline-none focus:border-teal-700 sm:w-48"
                onChange={(event) => setSelectedMonth(event.target.value)}
                value={selectedMonth}
              >
                {monthOptions.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5">
            <BarChart data={statistics.dailyData} minWidth={760} />
          </div>
        </section>

        <section className="mt-8 border-t border-zinc-200 dark:border-white/10 pt-6">
          <h2 className="text-xl font-semibold">Từ đã học theo tháng</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tổng số từ học lần đầu trong 12 tháng gần nhất.
          </p>
          <div className="mt-5">
            <BarChart data={statistics.monthlyData} minWidth={680} />
          </div>
        </section>
      </AppShell>
    </AuthGuard>
  );
}
