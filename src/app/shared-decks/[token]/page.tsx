"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-auth";

type SharedDeckPreview = {
  deck: { id: string; name: string };
  cardCount: number;
  sentenceCount: number;
  cards: Array<{
    chinese: string;
    pinyin: string | null;
    meaning_vi: string | null;
  }>;
  sentences: Array<{
    sentence_cn: string;
    sentence_pinyin: string | null;
    sentence_vi: string | null;
  }>;
};

export default function SharedDeckPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<SharedDeckPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/deck-shares?token=${encodeURIComponent(params.token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (!response.ok) {
          setMessage(data?.error || "Không thể mở liên kết chia sẻ.");
          setLoading(false);
          return;
        }

        setPreview(data as SharedDeckPreview);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setMessage("Không thể mở liên kết chia sẻ.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.token]);

  async function copyDeck() {
    setCopying(true);
    setMessage("");
    const response = await fetchWithAuth("/api/deck-shares", {
      method: "POST",
      body: JSON.stringify({ action: "copy", token: params.token }),
    });
    const data = await response.json().catch(() => null);
    setCopying(false);

    if (response.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/shared-decks/${params.token}`)}`);
      return;
    }

    if (!response.ok) {
      if (data?.deckId) {
        router.push(`/decks/${data.deckId}`);
        return;
      }

      setMessage(data?.error || "Không thể thêm bộ thẻ.");
      return;
    }

    router.push(`/decks/${data.deckId}`);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link className="font-semibold" href="/">
            Tiếng Trung Hihi
          </Link>
          <Link className="text-sm font-medium text-teal-800 hover:underline" href="/login">
            Đăng nhập
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {loading ? (
          <p className="text-sm text-zinc-600">Đang tải bộ thẻ được chia sẻ...</p>
        ) : !preview ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center">
            <h1 className="text-xl font-semibold">Không thể mở bộ thẻ</h1>
            <p className="mt-2 text-sm text-red-700">{message}</p>
          </div>
        ) : (
          <>
            <section className="border-b border-zinc-200 pb-7">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                Bộ thẻ được chia sẻ
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{preview.deck.name}</h1>
              <p className="mt-3 text-sm text-zinc-600">
                {preview.cardCount} thẻ từ vựng · {preview.sentenceCount} câu luyện tập
              </p>
              <button
                className="mt-6 min-h-11 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={copying}
                onClick={copyDeck}
                type="button"
              >
                {copying ? "Đang thêm..." : "Thêm vào tài khoản"}
              </button>
              {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
            </section>

            {preview.cards.length > 0 ? (
              <section className="mt-7">
                <h2 className="text-lg font-semibold">Xem trước từ vựng</h2>
                <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">
                  {preview.cards.map((card, index) => (
                    <div
                      className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr_2fr] sm:items-center"
                      key={`${card.chinese}-${index}`}
                    >
                      <div className="text-xl font-semibold">{card.chinese}</div>
                      <div className="text-sm text-teal-800">{card.pinyin}</div>
                      <div className="text-sm text-zinc-700">{card.meaning_vi}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {preview.sentences.length > 0 ? (
              <section className="mt-8">
                <h2 className="text-lg font-semibold">Xem trước câu luyện tập</h2>
                <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">
                  {preview.sentences.map((sentence, index) => (
                    <div className="py-3" key={`${sentence.sentence_cn}-${index}`}>
                      <div className="font-medium">{sentence.sentence_vi}</div>
                      <div className="mt-1 text-lg">{sentence.sentence_cn}</div>
                      <div className="text-sm text-teal-800">{sentence.sentence_pinyin}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="mt-8 text-sm leading-6 text-zinc-600">
              Khi thêm bộ này, bạn nhận một bản sao riêng. Mọi chỉnh sửa và tiến độ SRS của bạn không ảnh hưởng người chia sẻ.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
