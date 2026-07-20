"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { ConfirmDialog } from "@/components/ui-feedback";
import { fetchWithAuth, getApiErrorMessage } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SentenceCard, SentenceVocabItem } from "@/lib/types";

type SentenceForm = {
  sentence_cn: string;
  sentence_pinyin: string;
  sentence_vi: string;
  vocab_text: string;
  sentence_audio_url: string;
};

const emptyForm: SentenceForm = {
  sentence_cn: "",
  sentence_pinyin: "",
  sentence_vi: "",
  vocab_text: "",
  sentence_audio_url: "",
};

function vocabToText(vocab: SentenceVocabItem[] | null) {
  if (!Array.isArray(vocab)) {
    return "";
  }

  return vocab
    .map((item) => `${item.chinese} | ${item.pinyin} | ${item.meaning_vi}`)
    .join("\n");
}

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

export default function EditSentencePage() {
  const params = useParams<{ deckId: string; sentenceCardId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<SentenceForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("sentence_cards")
      .select("*")
      .eq("id", params.sentenceCardId)
      .eq("deck_id", params.deckId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setMessage(error?.message || "Không tìm thấy câu luyện tập.");
          setLoading(false);
          return;
        }

        const sentenceCard = data as SentenceCard;
        setForm({
          sentence_cn: sentenceCard.sentence_cn || "",
          sentence_pinyin: sentenceCard.sentence_pinyin || "",
          sentence_vi: sentenceCard.sentence_vi || "",
          vocab_text: vocabToText(sentenceCard.vocab_json),
          sentence_audio_url: sentenceCard.sentence_audio_url || "",
        });
        setLoading(false);
      });
  }, [params.deckId, params.sentenceCardId]);

  function updateField(name: keyof SentenceForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("sentence_cards")
      .update({
        sentence_cn: form.sentence_cn.trim(),
        sentence_pinyin: form.sentence_pinyin.trim() || null,
        sentence_vi: form.sentence_vi.trim(),
        vocab_json: textToVocab(form.vocab_text),
        sentence_audio_url: form.sentence_audio_url.trim() || null,
      })
      .eq("id", params.sentenceCardId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/decks/${params.deckId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function deleteSentence() {
    if (
      !window.confirm("Xóa câu luyện tập này? Lịch ôn liên quan cũng sẽ bị xóa.")
    ) {
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("sentence_cards")
      .delete()
      .eq("id", params.sentenceCardId);
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/decks/${params.deckId}`);
  }

  async function deleteSentenceAfterConfirm() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("sentence_cards")
      .delete()
      .eq("id", params.sentenceCardId);
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

    const response = await fetchWithAuth("/api/regenerate-sentence-audio", {
      method: "POST",
      body: JSON.stringify({ sentenceCardId: params.sentenceCardId }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(getApiErrorMessage(data, "Không thể tạo lại audio."));
      return;
    }

    setForm((current) => ({
      ...current,
      sentence_audio_url: data.sentenceAudioUrl || "",
    }));
    setMessage("Đã tạo lại audio.");
  }

  return (
    <AuthGuard>
      <AppShell>
        <ConfirmDialog
          body="Xóa câu luyện tập này? Lịch ôn liên quan cũng sẽ bị xóa."
          confirmLabel="Xóa"
          destructive
          loading={saving}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            setConfirmDeleteOpen(false);
            void deleteSentenceAfterConfirm();
          }}
          open={confirmDeleteOpen}
          title="Xóa câu luyện tập?"
        />
        <form className="max-w-2xl" onSubmit={save}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Sửa câu luyện tập</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Mỗi dòng từ vựng dùng mẫu: chữ Hán | pinyin | nghĩa.
              </p>
            </div>
            <Link
              className="rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
              href={`/decks/${params.deckId}`}
            >
              Quay lại
            </Link>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">Đang tải câu...</p>
          ) : (
            <div className="mt-6 grid gap-4">
              <label className="block text-sm font-medium">
                Câu tiếng Trung
                <textarea
                  className="mt-2 h-24 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 outline-none focus:border-teal-700"
                  onChange={(event) =>
                    updateField("sentence_cn", event.target.value)
                  }
                  required
                  value={form.sentence_cn}
                />
              </label>

              <label className="block text-sm font-medium">
                Pinyin
                <input
                  className="mt-2 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 outline-none focus:border-teal-700"
                  onChange={(event) =>
                    updateField("sentence_pinyin", event.target.value)
                  }
                  value={form.sentence_pinyin}
                />
              </label>

              <label className="block text-sm font-medium">
                Nghĩa tiếng Việt
                <textarea
                  className="mt-2 h-24 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 outline-none focus:border-teal-700"
                  onChange={(event) =>
                    updateField("sentence_vi", event.target.value)
                  }
                  required
                  value={form.sentence_vi}
                />
              </label>

              <label className="block text-sm font-medium">
                Từ vựng trong câu
                <textarea
                  className="mt-2 h-40 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-sm outline-none focus:border-teal-700"
                  onChange={(event) =>
                    updateField("vocab_text", event.target.value)
                  }
                  placeholder={"我 | wǒ | tôi\n中国 | Zhōngguó | Trung Quốc"}
                  value={form.vocab_text}
                />
              </label>

              <label className="block text-sm font-medium">
                Audio câu URL
                <input
                  className="mt-2 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 outline-none focus:border-teal-700"
                  onChange={(event) =>
                    updateField("sentence_audio_url", event.target.value)
                  }
                  value={form.sentence_audio_url}
                />
              </label>
            </div>
          )}

          {message ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              disabled={saving || loading}
              type="submit"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button
              className="min-h-11 rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-60"
              disabled={saving || loading}
              onClick={regenerateAudio}
              type="button"
            >
              Tạo lại audio (1 credit)
            </button>
            <button
              className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-60"
              disabled={saving || loading}
              onClick={() => setConfirmDeleteOpen(true)}
              type="button"
            >
              Xóa câu
            </button>
          </div>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
