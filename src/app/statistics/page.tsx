"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";

type ChartPoint = {
  key: string;
  label: string;
  count: number;
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
        className="grid h-64 grid-flow-col auto-cols-fr items-end gap-2 border-b border-zinc-200 px-2 pt-3"
        style={{ minWidth }}
      >
        {data.map((item) => {
          const barHeight =
            item.count === 0
              ? 4
              : Math.max(10, Math.round((item.count / maxCount) * 164));

          return (
            <div
              aria-label={`${item.label}: ${item.count} từ`}
              className="flex h-full min-w-0 flex-col justify-end text-center"
              key={item.key}
              title={`${item.label}: ${item.count} từ`}
            >
              <span className="mb-1 h-5 text-xs font-medium text-zinc-600">
                {item.count}
              </span>
              <div className="flex h-44 items-end justify-center">
                <div
                  className={`w-3/4 min-w-2 max-w-10 rounded-t ${
                    item.count > 0 ? "bg-teal-700" : "bg-zinc-200"
                  }`}
                  style={{ height: barHeight }}
                />
              </div>
              <span className="mt-2 truncate text-[11px] text-zinc-500">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const configured = hasPublicEnv();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const [learnedDates, setLearnedDates] = useState<string[]>([]);
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

    return {
      bestDayCount: bestDay?.[1] || 0,
      currentMonthCount,
      dailyData,
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
        <div>
          <h1 className="text-2xl font-semibold">Thống kê học từ vựng</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Mỗi từ chỉ được tính một lần vào ngày bạn học lần đầu.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Với thẻ cũ chưa lưu ngày học đầu tiên, app dùng ngày ôn gần nhất.
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Hôm nay", value: statistics.todayCount, note: "từ mới" },
            {
              label: "Tháng này",
              value: statistics.currentMonthCount,
              note: "từ đã học",
            },
            {
              label: "12 tháng qua",
              value: statistics.totalCount,
              note: "từ đã học",
            },
            {
              label: "Kỷ lục một ngày",
              value: statistics.bestDayCount,
              note: "từ mới",
            },
          ].map((item) => (
            <div
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
              key={item.label}
            >
              <div className="text-sm text-zinc-500">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-teal-800">
                {loading ? "..." : item.value}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{item.note}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 border-t border-zinc-200 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Từ đã học theo ngày</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {loading
                  ? "Đang tải dữ liệu..."
                  : `${statistics.selectedMonthCount} từ trong ${selectedMonthLabel}.`}
              </p>
            </div>
            <label className="text-sm font-medium text-zinc-700">
              Xem tháng
              <select
                className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-700 sm:w-48"
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

        <section className="mt-8 border-t border-zinc-200 pt-6">
          <h2 className="text-xl font-semibold">Từ đã học theo tháng</h2>
          <p className="mt-1 text-sm text-zinc-600">
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
