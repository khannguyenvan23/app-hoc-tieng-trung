"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-auth";

type AnalyticsReport = {
  daily: Array<{
    activeUsers: number;
    date: string;
    firstStudy: number;
    registrations: number;
    verified: number;
    visitors: number;
  }>;
  days: number;
  funnel: {
    firstStudy: number;
    registrations: number;
    returnedNextDay: number;
    verified: number;
    visitors: number;
  };
};

function percent(value: number, base: number) {
  if (!base) {
    return "0%";
  }

  return `${Math.round((value / base) * 100)}%`;
}

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;

    fetchWithAuth(`/api/analytics/report?days=${days}`)
      .then(async (response) => {
        const data = await response.json();

        if (response.status === 403 || response.status === 503) {
          if (active) {
            setHidden(true);
            setLoading(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Không thể tải Analytics.");
        }

        if (active) {
          setHidden(false);
          setReport(data as AnalyticsReport);
          setLoading(false);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Không thể tải Analytics.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [days]);

  const maxDaily = useMemo(
    () => Math.max(1, ...(report?.daily.map((item) => item.visitors) || [1])),
    [report],
  );

  if (hidden) {
    return null;
  }

  const stages = report
    ? [
        { label: "Khách truy cập", value: report.funnel.visitors, rate: "100%" },
        {
          label: "Đăng ký",
          value: report.funnel.registrations,
          rate: percent(report.funnel.registrations, report.funnel.visitors),
        },
        {
          label: "Xác minh email",
          value: report.funnel.verified,
          rate: percent(report.funnel.verified, report.funnel.registrations),
        },
        {
          label: "Học thẻ đầu tiên",
          value: report.funnel.firstStudy,
          rate: percent(report.funnel.firstStudy, report.funnel.verified),
        },
        {
          label: "Quay lại hôm sau",
          value: report.funnel.returnedNextDay,
          rate: percent(report.funnel.returnedNextDay, report.funnel.firstStudy),
        },
      ]
    : [];
  const displayStages = loading
    ? Array.from({ length: 5 }, (_, index) => ({
        label: `loading-${index}`,
        rate: "",
        value: 0,
      }))
    : stages;

  return (
    <section className="mb-8 rounded-lg border border-teal-200 dark:border-teal-500/40 bg-white dark:bg-[#171a19] dark:bg-white/5 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-teal-800 dark:text-teal-300">Dành cho quản trị</p>
          <h2 className="mt-1 text-xl font-semibold">Funnel khách hàng</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Theo dõi từ lượt truy cập đến khi người học quay lại vào ngày kế tiếp.
          </p>
        </div>
        <label className="text-sm font-medium">
          Khoảng thời gian
          <select
            className="ml-2 min-h-10 rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] dark:bg-white/5 px-3 outline-none focus:border-teal-700"
            onChange={(event) => {
              setError("");
              setLoading(true);
              setDays(Number(event.target.value));
            }}
            value={days}
          >
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/15 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {displayStages.map((stage) => (
          <div className="rounded-md border border-zinc-200 dark:border-white/10 p-4" key={stage.label}>
            {loading ? (
              <div className="h-16 animate-pulse rounded bg-zinc-100 dark:bg-white/10" />
            ) : (
              <>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{stage.label}</div>
                <div className="mt-2 text-3xl font-semibold text-teal-800 dark:text-teal-300">{stage.value}</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Chuyển đổi {stage.rate}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {report ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Khách truy cập theo ngày</h3>
          <div className="mt-3 flex h-36 items-end gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/10 pb-1">
            {report.daily.map((item) => (
              <div className="flex min-w-4 flex-1 flex-col items-center justify-end" key={item.date} title={`${item.date}: ${item.visitors} khách`}>
                <span className="mb-1 text-[10px] text-zinc-500 dark:text-zinc-400">{item.visitors || ""}</span>
                <div
                  className="w-full max-w-8 rounded-t bg-teal-700"
                  style={{ height: Math.max(3, Math.round((item.visitors / maxDaily) * 94)) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{report.daily[0]?.date}</span>
            <span>{report.daily.at(-1)?.date}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
