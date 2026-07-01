"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { fetchWithAuth } from "@/lib/fetch-auth";
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
  const [loading, setLoading] = useState(false);
  const items = useMemo(() => parseVocabularyText(text), [text]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

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
      setMessage(data.error || "Import từ thành câu thất bại");
      return;
    }

    setMessage(`Đã tạo ${data.created} câu luyện tập.`);
    router.push("/study-sentences");
  }

  return (
    <AuthGuard>
      <AppShell>
        <form className="max-w-3xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Import từ thành câu</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Dán mỗi dòng một từ tiếng Trung. AI sẽ tạo câu ví dụ cho từng
                từ. Khi học, mặt trước là nghĩa tiếng Việt của câu, mặt sau là
                câu tiếng Trung.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/decks/${params.deckId}`}
            >
              Quay lại bộ thẻ
            </Link>
          </div>

          <textarea
            className="mt-6 h-72 w-full rounded-lg border border-zinc-300 bg-white p-4 font-mono text-sm outline-none focus:border-teal-700"
            onChange={(event) => setText(event.target.value)}
            value={text}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {items.length} từ sẵn sàng tạo câu
            </p>
            <button
              className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={loading || items.length === 0}
              type="submit"
            >
              {loading ? "Đang tạo câu bằng AI..." : "Tạo câu luyện tập"}
            </button>
          </div>

          {message ? <p className="mt-4 text-sm text-zinc-700">{message}</p> : null}
        </form>
      </AppShell>
    </AuthGuard>
  );
}
