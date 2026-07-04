"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";

export default function NewSentenceFromWordPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const [word, setWord] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetchWithAuth("/api/sentence-from-word", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        word: word.trim(),
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(getApiErrorMessage(data, "Không thể tạo câu."));
      return;
    }

    router.push("/study-sentences");
  }

  return (
    <AuthGuard>
      <AppShell>
        <form className="max-w-xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Tạo câu từ từ vựng</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Nhập một từ tiếng Trung. AI sẽ tự tạo câu ví dụ, nghĩa tiếng
                Việt, pinyin, từ vựng trong câu và audio. Dự kiến cần 3 credit.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/decks/${params.deckId}`}
            >
              Quay lại
            </Link>
          </div>

          <label className="mt-6 block text-sm font-medium" htmlFor="word">
            Từ tiếng Trung
          </label>
          <input
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-3 text-3xl outline-none focus:border-teal-700"
            id="word"
            onChange={(event) => setWord(event.target.value)}
            placeholder="过"
            required
            value={word}
          />

          {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}

          <button
            className="mt-6 min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={loading || !word.trim()}
            type="submit"
          >
            {loading ? "Đang tạo bằng AI..." : "Tạo câu luyện tập"}
          </button>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
