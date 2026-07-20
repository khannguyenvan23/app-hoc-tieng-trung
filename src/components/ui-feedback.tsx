"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
};

type ToastInput = Omit<ToastMessage, "id">;

const toastToneClasses: Record<ToastTone, string> = {
  success: "border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 text-teal-950",
  error: "border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/15 text-red-950",
  info: "border-sky-200 bg-sky-50 dark:bg-sky-500/15 text-sky-950",
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const toastId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setToasts((currentToasts) => [
      ...currentToasts.slice(-2),
      { ...toast, id: toastId },
    ]);

    return toastId;
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 4200),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  return useMemo(
    () => ({ dismissToast, showToast, toasts }),
    [dismissToast, showToast, toasts],
  );
}

export function ToastList({
  dismissToast,
  toasts,
}: {
  dismissToast: (toastId: string) => void;
  toasts: ToastMessage[];
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed right-3 top-20 z-[70] grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 sm:right-5"
    >
      {toasts.map((toast) => (
        <div
          className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${toastToneClasses[toast.tone]}`}
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {toast.title ? (
                <div className="font-semibold">{toast.title}</div>
              ) : null}
              <div className={toast.title ? "mt-1" : ""}>{toast.message}</div>
            </div>
            <button
              aria-label="Đóng thông báo"
              className="rounded-md px-2 text-lg leading-none opacity-70 hover:bg-white/60 hover:opacity-100"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  body,
  cancelLabel = "Hủy",
  confirmLabel = "Xác nhận",
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/35 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="min-h-10 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-white/5 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-60"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              destructive
                ? "bg-red-700 hover:bg-red-800"
                : "bg-teal-700 hover:bg-teal-800"
            }`}
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
