"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Card } from "@/lib/types";

type CardForm = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
  word_audio_url: string;
  sentence_audio_url: string;
};

const emptyForm: CardForm = {
  chinese: "",
  pinyin: "",
  meaning_vi: "",
  example_cn: "",
  example_pinyin: "",
  example_vi: "",
  word_audio_url: "",
  sentence_audio_url: "",
};

export default function EditCardPage() {
  const params = useParams<{ deckId: string; cardId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("cards")
      .select("*")
      .eq("id", params.cardId)
      .eq("deck_id", params.deckId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setMessage(error?.message || "Không tìm thấy thẻ.");
          setLoading(false);
          return;
        }

        const card = data as Card;
        setForm({
          chinese: card.chinese || "",
          pinyin: card.pinyin || "",
          meaning_vi: card.meaning_vi || "",
          example_cn: card.example_cn || "",
          example_pinyin: card.example_pinyin || "",
          example_vi: card.example_vi || "",
          word_audio_url: card.word_audio_url || "",
          sentence_audio_url: card.sentence_audio_url || "",
        });
        setLoading(false);
      });
  }, [params.cardId, params.deckId]);

  function updateField(name: keyof CardForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("cards")
      .update({
        chinese: form.chinese.trim(),
        pinyin: form.pinyin.trim() || null,
        meaning_vi: form.meaning_vi.trim(),
        example_cn: form.example_cn.trim() || null,
        example_pinyin: form.example_pinyin.trim() || null,
        example_vi: form.example_vi.trim() || null,
        word_audio_url: form.word_audio_url.trim() || null,
        sentence_audio_url: form.sentence_audio_url.trim() || null,
      })
      .eq("id", params.cardId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/decks/${params.deckId}`);
  }

  async function deleteCard() {
    if (!window.confirm("Xóa thẻ này? Lịch ôn liên quan cũng sẽ bị xóa.")) {
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("cards").delete().eq("id", params.cardId);
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/decks/${params.deckId}`);
  }

  async function regenerateAudio() {
    setSaving(true);
    setMessage("");

    const response = await fetchWithAuth("/api/regenerate-card-audio", {
      method: "POST",
      body: JSON.stringify({ cardId: params.cardId }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(getApiErrorMessage(data, "Không thể tạo lại audio."));
      return;
    }

    setForm((current) => ({
      ...current,
      word_audio_url: data.wordAudioUrl || "",
      sentence_audio_url: data.sentenceAudioUrl || "",
    }));
    setMessage("Đã tạo lại audio.");
  }

  return (
    <AuthGuard>
      <AppShell>
        <form className="max-w-2xl" onSubmit={save}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Sửa thẻ từ vựng</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Cập nhật nội dung, audio hoặc xóa thẻ.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              href={`/decks/${params.deckId}`}
            >
              Quay lại
            </Link>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-600">Đang tải thẻ...</p>
          ) : (
            <div className="mt-6 grid gap-4">
              {(
                [
                  ["chinese", "Chữ Hán", "过"],
                  ["pinyin", "Pinyin", "guò"],
                  ["meaning_vi", "Nghĩa tiếng Việt", "qua, trải qua, từng"],
                  ["example_cn", "Câu ví dụ tiếng Trung", "我去过中国。"],
                  ["example_pinyin", "Pinyin câu ví dụ", "Wǒ qù guò Zhōngguó."],
                  ["example_vi", "Dịch câu ví dụ", "Tôi đã từng đi Trung Quốc."],
                  ["word_audio_url", "Audio từ vựng URL", ""],
                  ["sentence_audio_url", "Audio câu ví dụ URL", ""],
                ] as Array<[keyof CardForm, string, string]>
              ).map(([name, label, placeholder]) => (
                <label className="block text-sm font-medium" key={name}>
                  {label}
                  <input
                    className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
                    onChange={(event) => updateField(name, event.target.value)}
                    placeholder={placeholder}
                    required={name === "chinese" || name === "meaning_vi"}
                    value={form[name]}
                  />
                </label>
              ))}
            </div>
          )}

          {message ? <p className="mt-4 text-sm text-zinc-700">{message}</p> : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={saving || loading}
              type="submit"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
              disabled={saving || loading}
              onClick={regenerateAudio}
              type="button"
            >
              Tạo lại audio (1-2 credit)
            </button>
            <button
              className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              disabled={saving || loading}
              onClick={deleteCard}
              type="button"
            >
              Xóa thẻ
            </button>
          </div>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
