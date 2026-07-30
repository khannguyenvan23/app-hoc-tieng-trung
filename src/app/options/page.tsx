"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { ButtonLabel } from "@/components/icons";
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
    | "learn_ahead_limit_minutes"
    | "graduating_interval_days"
    | "easy_interval_days"
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

const learnAheadSetting: NumberSetting = {
  key: "learn_ahead_limit_minutes",
  label: "Learn ahead limit",
  min: 0,
  max: 1440,
  step: 1,
  suffix: "phút",
};

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
  // Raw text being typed per field. A number input bound straight to a number
  // leaves stray input like "02" stuck, because React won't re-sync the DOM
  // when the parsed number is unchanged. Holding the raw string fixes that; it
  // is normalized back to a clean number on blur.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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
    setDrafts((current) => ({ ...current, [setting.key]: value }));

    const numericValue = Number(value);
    if (value.trim() !== "" && Number.isFinite(numericValue)) {
      setSettings((current) => ({
        ...current,
        [setting.key]: clamp(numericValue, setting.min, setting.max),
      }));
    }
    setMessage("");
  }

  // On blur, snap the field back to the clamped number and drop the draft, so
  // stray input like "02" or an empty box becomes a clean, valid value.
  function commitNumberSetting(setting: NumberSetting) {
    const raw = drafts[setting.key];
    setDrafts((current) => {
      const next = { ...current };
      delete next[setting.key];
      return next;
    });

    if (raw === undefined) {
      return;
    }

    const numericValue = Number(raw);
    setSettings((current) => ({
      ...current,
      [setting.key]: clamp(
        raw.trim() !== "" && Number.isFinite(numericValue)
          ? numericValue
          : setting.min,
        setting.min,
        setting.max,
      ),
    }));
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
    setDrafts({});
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
                <ButtonLabel busy="Đang lưu..." idle="Lưu cài đặt" loading={saving} />
              </button>
            </div>
          </div>

          {message ? (
            <div
              className={`mt-4 inline-flex animate-[fade-in_200ms_ease-out] items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                message.startsWith("Đã")
                  ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200"
              }`}
              role="status"
            >
              {message.startsWith("Đã") ? (
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white dark:bg-teal-400 dark:text-teal-950">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="12"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    width="12"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : null}
              {message}
            </div>
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
                      onBlur={() => commitNumberSetting(setting)}
                      onChange={(event) =>
                        updateNumberSetting(setting, event.target.value)
                      }
                      step={setting.step}
                      type="number"
                      value={drafts[setting.key] ?? String(settings[setting.key])}
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

              <label className="block text-sm font-medium">
                {learnAheadSetting.label}
                <div className="mt-2 flex overflow-hidden rounded-md border border-zinc-300 bg-white focus-within:border-teal-700 dark:border-white/15 dark:bg-[#171a19]">
                  <input
                    className="min-h-10 w-full px-3 py-2 outline-none"
                    disabled={loading}
                    max={learnAheadSetting.max}
                    min={learnAheadSetting.min}
                    onBlur={() => commitNumberSetting(learnAheadSetting)}
                    onChange={(event) =>
                      updateNumberSetting(learnAheadSetting, event.target.value)
                    }
                    step={learnAheadSetting.step}
                    type="number"
                    value={
                      drafts[learnAheadSetting.key] ??
                      String(settings[learnAheadSetting.key])
                    }
                  />
                  <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                    {learnAheadSetting.suffix}
                  </span>
                </div>
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Đặt 0 để chờ đúng thời gian hiển thị trên nút. Giá trị lớn hơn
                  0 sẽ cho phép học sớm thẻ đang học khi hàng chờ đã hết.
                </span>
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
                        onBlur={() => commitNumberSetting(setting)}
                        onChange={(event) =>
                          updateNumberSetting(setting, event.target.value)
                        }
                        step={setting.step}
                        type="number"
                        value={drafts[setting.key] ?? String(settings[setting.key])}
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
                      onBlur={() => commitNumberSetting(setting)}
                      onChange={(event) =>
                        updateNumberSetting(setting, event.target.value)
                      }
                      step={setting.step}
                      type="number"
                      value={drafts[setting.key] ?? String(settings[setting.key])}
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
                        onBlur={() => commitNumberSetting(setting)}
                        onChange={(event) =>
                          updateNumberSetting(setting, event.target.value)
                        }
                        step={setting.step}
                        type="number"
                        value={drafts[setting.key] ?? String(settings[setting.key])}
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
