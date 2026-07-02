"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { fetchWithAuth } from "@/lib/fetch-auth";
import type { SentenceVocabItem } from "@/lib/types";

type ManualSentenceForm = {
  sentence_cn: string;
  sentence_pinyin: string;
  sentence_vi: string;
  vocab_text: string;
  sentence_audio_url: string;
};

const initialForm: ManualSentenceForm = {
  sentence_cn: "",
  sentence_pinyin: "",
  sentence_vi: "",
  vocab_text: "",
  sentence_audio_url: "",
};

function textToVocab(input: string): SentenceVocabItem[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [chinese = "", pinyin = "", meaningVi = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        chinese,
        pinyin,
        meaning_vi: meaningVi,
      };
    })
    .filter((item) => item.chinese && item.meaning_vi);
}

export default function NewManualSentencePage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ManualSentenceForm>(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(name: keyof ManualSentenceForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetchWithAuth("/api/manual-sentence", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        sentence_cn: form.sentence_cn,
        sentence_pinyin: form.sentence_pinyin,
        sentence_vi: form.sentence_vi,
        vocab_json: textToVocab(form.vocab_text),
        sentence_audio_url: form.sentence_audio_url,
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Không thể tạo câu luyện tập.");
      return;
    }

    router.push(`/decks/${params.deckId}`);
  }

  return (
    <AuthGuard>
      <AppShell>
        <form className="max-w-2xl" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Thêm câu thủ công</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Tự nhập câu luyện tập. Khi lưu, app sẽ tự tạo audio nếu bạn để
                trống ô audio.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/decks/${params.deckId}`}
            >
              Quay lại
            </Link>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block text-sm font-medium">
              Câu tiếng Trung
              <textarea
                className="mt-2 h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-lg outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("sentence_cn", event.target.value)
                }
                placeholder="我去过中国。"
                required
                value={form.sentence_cn}
              />
            </label>

            <label className="block text-sm font-medium">
              Pinyin
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("sentence_pinyin", event.target.value)
                }
                placeholder="Wǒ qù guò Zhōngguó."
                value={form.sentence_pinyin}
              />
            </label>

            <label className="block text-sm font-medium">
              Nghĩa tiếng Việt
              <textarea
                className="mt-2 h-24 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("sentence_vi", event.target.value)
                }
                placeholder="Tôi đã từng đi Trung Quốc."
                required
                value={form.sentence_vi}
              />
            </label>

            <label className="block text-sm font-medium">
              Từ vựng trong câu
              <textarea
                className="mt-2 h-40 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("vocab_text", event.target.value)
                }
                placeholder={
                  "我 | wǒ | tôi\n去过 | qù guò | đã từng đi\n中国 | Zhōngguó | Trung Quốc"
                }
                value={form.vocab_text}
              />
            </label>

            <label className="block text-sm font-medium">
              Audio câu URL
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("sentence_audio_url", event.target.value)
                }
                placeholder="Có thể để trống để app tự tạo"
                value={form.sentence_audio_url}
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <button
            className="mt-6 min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Đang lưu và tạo audio..." : "Lưu câu"}
          </button>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
