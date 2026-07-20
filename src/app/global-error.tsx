"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-stone-50 dark:bg-white/5 px-4 py-16 text-zinc-950 dark:text-zinc-50">
        <main className="mx-auto max-w-lg rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Đã xảy ra lỗi</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Hệ thống đã ghi nhận lỗi. Bạn có thể thử tải lại phần này.
          </p>
          <button
            className="mt-5 min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => unstable_retry()}
            type="button"
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
