"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import {
  defaultStudySettings,
  isValidLearningSteps,
  normalizeStudySettings,
  type StudySettings,
} from "@/lib/study-settings";

type NumberSetting = {
  key: keyof Pick<
    StudySettings,
    | "daily_new_card_limit"
    | "daily_new_sentence_limit"
    | "graduating_interval_days"
    | "easy_interval_days"
    | "review_again_interval_minutes"
    | "hard_interval_multiplier"
    | "easy_bonus"
    | "interval_modifier"
    | "new_interval_percentage"
    | "minimum_lapse_interval_days"
    | "starting_ease_factor"
    | "minimum_ease_factor"
    | "maximum_interval_days"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const dailySettings: NumberSetting[] = [
  {
    key: "daily_new_card_limit",
    label: "Từ mới mỗi ngày",
    min: 0,
    max: 100,
    step: 1,
    suffix: "từ",
  },
  {
    key: "daily_new_sentence_limit",
    label: "Câu mới mỗi ngày",
    min: 0,
    max: 100,
    step: 1,
    suffix: "câu",
  },
];

const newCardSettings: NumberSetting[] = [
  {
    key: "graduating_interval_days",
    label: "Graduating interval",
    min: 1,
    max: 365,
    step: 1,
    suffix: "ngày",
  },
  {
    key: "easy_interval_days",
    label: "Easy interval",
    min: 1,
    max: 365,
    step: 1,
    suffix: "ngày",
  },
];

const reviewSettings: NumberSetting[] = [
  {
    key: "hard_interval_multiplier",
    label: "Hard multiplier",
    min: 1,
    max: 5,
    step: 0.05,
    suffix: "x",
  },
  {
    key: "easy_bonus",
    label: "Easy bonus",
    min: 1,
    max: 5,
    step: 0.05,
    suffix: "x",
  },
  {
    key: "interval_modifier",
    label: "Interval modifier",
    min: 0.1,
    max: 5,
    step: 0.05,
    suffix: "x",
  },
  {
    key: "starting_ease_factor",
    label: "Starting ease",
    min: 1.3,
    max: 5,
    step: 0.05,
    suffix: "x",
  },
  {
    key: "minimum_ease_factor",
    label: "Minimum ease",
    min: 1.1,
    max: 5,
    step: 0.05,
    suffix: "x",
  },
  {
    key: "maximum_interval_days",
    label: "Maximum interval",
    min: 1,
    max: 3650,
    step: 1,
    suffix: "ngày",
  },
];

const lapseSettings: NumberSetting[] = [
  {
    key: "new_interval_percentage",
    label: "New interval",
    min: 0,
    max: 100,
    step: 1,
    suffix: "%",
  },
  {
    key: "minimum_lapse_interval_days",
    label: "Minimum interval",
    min: 1,
    max: 365,
    step: 1,
    suffix: "ngày",
  },
  {
    key: "review_again_interval_minutes",
    label: "Again fallback",
    min: 1,
    max: 1440,
    step: 1,
    suffix: "phút",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function OptionsPage() {
  const configured = hasPublicEnv();
  const [settings, setSettings] = useState<StudySettings>(defaultStudySettings);
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;

    fetchWithAuth("/api/study-settings").then(async (response) => {
      const data = await response.json().catch(() => null);

      if (!active) {
        return;
      }

      if (response.ok) {
        setSettings(normalizeStudySettings(data?.settings));
        setMessage("");
      } else {
        setMessage(data?.error || "Không thể tải cài đặt học.");
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [configured]);

  function updateNumberSetting(setting: NumberSetting, value: string) {
    const numericValue = Number(value);
    setSettings((current) => ({
      ...current,
      [setting.key]: clamp(
        Number.isFinite(numericValue) ? numericValue : setting.min,
        setting.min,
        setting.max,
      ),
    }));
    setMessage("");
  }

  function updateLearningSteps(value: string) {
    setSettings((current) => ({ ...current, learning_steps: value }));
    setMessage("");
  }

  function updateRelearningSteps(value: string) {
    setSettings((current) => ({ ...current, relearning_steps: value }));
    setMessage("");
  }

  function resetDefaults() {
    setSettings(defaultStudySettings);
    setMessage("");
  }

  async function saveSettings() {
    if (!isValidLearningSteps(settings.learning_steps)) {
      setMessage("Learning steps phải có dạng như 10m hoặc 3m 8m.");
      return;
    }

    if (!isValidLearningSteps(settings.relearning_steps)) {
      setMessage("Relearning steps phải có dạng như 10m hoặc 3m 8m.");
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetchWithAuth("/api/study-settings", {
      method: "PUT",
      body: JSON.stringify(normalizeStudySettings(settings)),
    });
    const data = await response.json().catch(() => null);

    setSaving(false);

    if (!response.ok) {
      setMessage(data?.error || "Không thể lưu cài đặt học.");
      return;
    }

    setSettings(normalizeStudySettings(data?.settings));
    setMessage("Đã lưu cài đặt ôn tập.");
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Cài đặt ôn tập</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Điều chỉnh giới hạn học mỗi ngày và lịch lặp lại cho từ vựng,
                câu luyện tập.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-white/5"
                onClick={resetDefaults}
                type="button"
              >
                Mặc định
              </button>
              <button
                className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={saving || loading}
                onClick={saveSettings}
                type="button"
              >
                {saving ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </div>
          </div>

          {message ? (
            <p
              className={`mt-4 text-sm ${ message.startsWith("Đã") ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300" }`}
            >
              {message}
            </p>
          ) : null}

          <section className="mt-6 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Giới hạn học mỗi ngày</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {dailySettings.map((setting) => (
                <label className="block text-sm font-medium" key={setting.key}>
                  {setting.label}
                  <div className="mt-2 flex overflow-hidden rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] focus-within:border-teal-700">
                    <input
                      className="min-h-10 w-full px-3 py-2 outline-none"
                      disabled={loading}
                      max={setting.max}
                      min={setting.min}
                      onChange={(event) =>
                        updateNumberSetting(setting, event.target.value)
                      }
                      step={setting.step}
                      type="number"
                      value={settings[setting.key]}
                    />
                    <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {setting.suffix}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/10 pb-3">
              <h2 className="text-xl font-semibold">New Cards</h2>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 dark:border-white/15 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                ?
              </span>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block text-sm font-medium">
                Learning steps
                <input
                  className={`mt-2 w-full rounded-md border px-3 py-2 outline-none focus:border-teal-700 ${ isValidLearningSteps(settings.learning_steps) ? "border-zinc-300 dark:border-white/15" : "border-red-400" }`}
                  disabled={loading}
                  onChange={(event) => updateLearningSteps(event.target.value)}
                  placeholder="10m hoặc 3m 8m"
                  value={settings.learning_steps}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {newCardSettings.map((setting) => (
                  <label className="block text-sm font-medium" key={setting.key}>
                    {setting.label}
                    <div className="mt-2 flex overflow-hidden rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] focus-within:border-teal-700">
                      <input
                        className="min-h-10 w-full px-3 py-2 outline-none"
                        disabled={loading}
                        max={setting.max}
                        min={setting.min}
                        onChange={(event) =>
                          updateNumberSetting(setting, event.target.value)
                        }
                        step={setting.step}
                        type="number"
                        value={settings[setting.key]}
                      />
                      <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {setting.suffix}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <label className="block text-sm font-medium">
                Insertion order
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] px-3 py-2 outline-none focus:border-teal-700"
                  disabled={loading}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      insertion_order:
                        event.target.value === "random"
                          ? "random"
                          : "sequential",
                    }))
                  }
                  value={settings.insertion_order}
                >
                  <option value="sequential">
                    Sequential - thẻ cũ trước
                  </option>
                  <option value="random">Random - trộn thẻ mới</option>
                </select>
              </label>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Review Cards</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {reviewSettings.map((setting) => (
                <label className="block text-sm font-medium" key={setting.key}>
                  {setting.label}
                  <div className="mt-2 flex overflow-hidden rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] focus-within:border-teal-700">
                    <input
                      className="min-h-10 w-full px-3 py-2 outline-none"
                      disabled={loading}
                      max={setting.max}
                      min={setting.min}
                      onChange={(event) =>
                        updateNumberSetting(setting, event.target.value)
                      }
                      step={setting.step}
                      type="number"
                      value={settings[setting.key]}
                    />
                    <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {setting.suffix}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Lapses</h2>
            <div className="mt-4 grid gap-4">
              <label className="block text-sm font-medium">
                Relearning steps
                <input
                  className={`mt-2 w-full rounded-md border px-3 py-2 outline-none focus:border-teal-700 ${ isValidLearningSteps(settings.relearning_steps) ? "border-zinc-300 dark:border-white/15" : "border-red-400" }`}
                  disabled={loading}
                  onChange={(event) =>
                    updateRelearningSteps(event.target.value)
                  }
                  placeholder="10m hoặc 3m 10m"
                  value={settings.relearning_steps}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {lapseSettings.map((setting) => (
                  <label className="block text-sm font-medium" key={setting.key}>
                    {setting.label}
                    <div className="mt-2 flex overflow-hidden rounded-md border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] focus-within:border-teal-700">
                      <input
                        className="min-h-10 w-full px-3 py-2 outline-none"
                        disabled={loading}
                        max={setting.max}
                        min={setting.min}
                        onChange={(event) =>
                          updateNumberSetting(setting, event.target.value)
                        }
                        step={setting.step}
                        type="number"
                        value={settings[setting.key]}
                      />
                      <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {setting.suffix}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
