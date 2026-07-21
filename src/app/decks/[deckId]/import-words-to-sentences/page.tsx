"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { ToastList, useToast } from "@/components/ui-feedback";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { parseVocabularyText } from "@/lib/parse-vocabulary";

const sample = `过
好吃
聊天
认真`;

export default function ImportWordsToSentencesPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const [text, setText] = useState(sample);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [loading, setLoading] = useState(false);
  const lastToastMessageRef = useRef("");
  const { dismissToast, showToast, toasts } = useToast();
  const items = useMemo(() => parseVocabularyText(text), [text]);

  useEffect(() => {
    if (!message || !messageType || lastToastMessageRef.current === message) {
      return;
    }

    lastToastMessageRef.current = message;
    showToast({
      message,
      title: messageType === "success" ? "Thành công" : "Có lỗi",
      tone: messageType === "success" ? "success" : "error",
    });
  }, [message, messageType, showToast]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("");

    const response = await fetchWithAuth("/api/import-words-to-sentences", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        items,
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(getApiErrorMessage(data, "Import từ thành câu thất bại"));
      setMessageType("error");
      return;
    }

    setMessage(
      `Import thành công. Đã tạo ${data.created} câu luyện tập. Đang chuyển sang trang luyện câu...`,
    );
    setMessageType("success");
    window.setTimeout(() => router.push("/study-sentences"), 1500);
  }

  return (
    <AuthGuard>
      <AppShell>
        <ToastList dismissToast={dismissToast} toasts={toasts} />
        <form className="max-w-3xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Import từ thành câu</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Dán mỗi dòng một từ tiếng Trung. AI sẽ tạo câu ví dụ cho từng
                từ. Khi học, mặt trước là nghĩa tiếng Việt của câu, mặt sau là
                câu tiếng Trung.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
              href={`/decks/${params.deckId}`}
            >
              Quay lại bộ thẻ
            </Link>
            </div>

            <div className="mt-4 rounded-md border border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 px-4 py-3 text-sm leading-6 text-teal-950">
              Nên import 10-20 từ/lần để AI tạo câu nhanh hơn. Audio sẽ tự
              tạo khi bạn vào luyện câu hoặc bấm phát âm. Tối đa 50 từ/lần.
            </div>

          <textarea
            className="mt-6 h-72 w-full rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#171a19] p-4 font-mono text-sm outline-none focus:border-teal-700"
            onChange={(event) => setText(event.target.value)}
            value={text}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {items.length} từ sẵn sàng tạo câu · dự kiến cần {items.length * 2}{" "}
              credit
            </p>
            <button
              className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={loading || items.length === 0}
              type="submit"
            >
              {loading ? "Đang tạo câu bằng AI..." : "Tạo câu luyện tập"}
            </button>
          </div>

          {message ? (
            <p
              className={`mt-4 text-sm ${ messageType === "success" ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300" }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </AppShell>
    </AuthGuard>
  );
}
