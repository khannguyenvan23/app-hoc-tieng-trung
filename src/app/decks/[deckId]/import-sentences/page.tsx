"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { ToastList, useToast } from "@/components/ui-feedback";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { parseSentenceText } from "@/lib/parse-sentences";

const sample = `我去过中国。
这个菜很好吃。
他正在学习中文。`;

export default function ImportSentencesPage() {
  const params = useParams<{ deckId: string }>();
  const [text, setText] = useState(sample);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [loading, setLoading] = useState(false);
  const lastToastMessageRef = useRef("");
  const { dismissToast, showToast, toasts } = useToast();
  const items = useMemo(() => parseSentenceText(text), [text]);

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

    const response = await fetchWithAuth("/api/import-sentences", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        items,
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(getApiErrorMessage(data, "Import câu thất bại"));
      setMessageType("error");
      return;
    }

    setMessage(`Import thành công. Đã tạo ${data.created} câu luyện tập.`);
    setMessageType("success");
  }

  return (
    <AuthGuard>
      <AppShell>
        <ToastList dismissToast={dismissToast} toasts={toasts} />
        <form className="max-w-3xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Import câu</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Dán mỗi dòng một câu tiếng Trung. AI sẽ tạo nghĩa tiếng Việt,
                pinyin và tách từ vựng trong câu.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/decks/${params.deckId}`}
            >
              Quay lại bộ thẻ
            </Link>
            </div>

            <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
              Nên import 10-20 câu/lần để AI xử lý nhanh hơn. Audio sẽ tự
              tạo khi bạn vào luyện câu hoặc bấm phát âm. Tối đa 50 câu/lần.
            </div>

          <textarea
            className="mt-6 h-72 w-full rounded-lg border border-zinc-300 bg-white p-4 font-mono text-sm outline-none focus:border-teal-700"
            onChange={(event) => setText(event.target.value)}
            value={text}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {items.length} câu sẵn sàng gửi AI · dự kiến cần {items.length * 2}{" "}
              credit
            </p>
            <button
              className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={loading || items.length === 0}
              type="submit"
            >
              {loading ? "Đang tạo câu bằng AI..." : "Tạo bài luyện câu"}
            </button>
          </div>

          {message ? (
            <p
              className={`mt-4 text-sm ${
                messageType === "success"
                  ? "text-teal-700"
                  : "text-red-700"
              }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </AppShell>
    </AuthGuard>
  );
}
