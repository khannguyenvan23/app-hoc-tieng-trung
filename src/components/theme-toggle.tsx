"use client";

import { useEffect, useSyncExternalStore } from "react";

type ThemePreference = "light" | "dark" | "system";

const storageKey = "hanzi-theme";
const order: ThemePreference[] = ["light", "dark", "system"];
const labels: Record<ThemePreference, string> = {
  light: "Sáng",
  dark: "Tối",
  system: "Hệ thống",
};

// The preference lives in localStorage, so it is external state as far as
// React is concerned — useSyncExternalStore keeps SSR and hydration honest.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(
      storageKey,
    ) as ThemePreference | null;

    return stored && order.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function readServerPreference(): ThemePreference {
  return "system";
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === "dark" || (preference === "system" && prefersDark());
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light",
  );
}

function writePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(storageKey, preference);
  } catch {
    // Private mode or blocked storage: still apply for this session.
  }

  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 16,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 16,
  };

  if (preference === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (preference === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect height="14" rx="2" width="18" x="3" y="4" />
      <path d="M8 20h8M12 18v2" />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    readServerPreference,
  );

  // While following the system, track OS changes live.
  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  return (
    <button
      aria-label={`Giao diện: ${labels[preference]}. Bấm để đổi.`}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10 ${className}`}
      onClick={() =>
        writePreference(order[(order.indexOf(preference) + 1) % order.length])
      }
      title={`Giao diện: ${labels[preference]}`}
      type="button"
    >
      <ThemeIcon preference={preference} />
      <span>{labels[preference]}</span>
    </button>
  );
}
