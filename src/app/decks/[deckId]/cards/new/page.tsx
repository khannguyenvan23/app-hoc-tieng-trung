"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ManualCardForm = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
};

const initialForm: ManualCardForm = {
  chinese: "",
  pinyin: "",
  meaning_vi: "",
  example_cn: "",
  example_pinyin: "",
  example_vi: "",
};

export default function NewCardPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(name: keyof ManualCardForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        deck_id: params.deckId,
        chinese: form.chinese.trim(),
        pinyin: form.pinyin.trim() || null,
        meaning_vi: form.meaning_vi.trim(),
        example_cn: form.example_cn.trim() || null,
        example_pinyin: form.example_pinyin.trim() || null,
        example_vi: form.example_vi.trim() || null,
      })
      .select("id")
      .single();

    if (cardError || !card) {
      setLoading(false);
      setError(cardError?.message || "Không thể tạo thẻ.");
      return;
    }

    const { error: reviewError } = await supabase.from("reviews").insert({
      user_id: user.id,
      card_id: card.id,
    });

    setLoading(false);

    if (reviewError) {
      setError(reviewError.message);
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
              <h1 className="text-2xl font-semibold">Thêm thẻ thủ công</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Tự nhập nội dung flashcard. Thẻ mới sẽ được ôn ngay.
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
              Chữ Hán
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-lg outline-none focus:border-teal-700"
                onChange={(event) => updateField("chinese", event.target.value)}
                placeholder="过"
                required
                value={form.chinese}
              />
            </label>

            <label className="block text-sm font-medium">
              Pinyin
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) => updateField("pinyin", event.target.value)}
                placeholder="guò"
                value={form.pinyin}
              />
            </label>

            <label className="block text-sm font-medium">
              Nghĩa tiếng Việt
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("meaning_vi", event.target.value)
                }
                placeholder="qua, trải qua, từng"
                required
                value={form.meaning_vi}
              />
            </label>

            <label className="block text-sm font-medium">
              Câu ví dụ tiếng Trung
              <textarea
                className="mt-2 h-24 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("example_cn", event.target.value)
                }
                placeholder="我去过中国。"
                value={form.example_cn}
              />
            </label>

            <label className="block text-sm font-medium">
              Pinyin câu ví dụ
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("example_pinyin", event.target.value)
                }
                placeholder="Wǒ qù guò Zhōngguó."
                value={form.example_pinyin}
              />
            </label>

            <label className="block text-sm font-medium">
              Dịch câu ví dụ
              <textarea
                className="mt-2 h-24 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                onChange={(event) =>
                  updateField("example_vi", event.target.value)
                }
                placeholder="Tôi đã từng đi Trung Quốc."
                value={form.example_vi}
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <button
            className="mt-6 min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Đang lưu..." : "Lưu thẻ"}
          </button>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
