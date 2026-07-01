"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { hasPublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Card, Deck, SentenceCard } from "@/lib/types";

export default function DeckPage() {
  const params = useParams<{ deckId: string }>();
  const configured = hasPublicEnv();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [sentenceCards, setSentenceCards] = useState<SentenceCard[]>([]);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    Promise.all([
      supabase.from("decks").select("*").eq("id", params.deckId).single(),
      supabase
        .from("cards")
        .select("*")
        .eq("deck_id", params.deckId)
        .order("created_at", { ascending: false }),
      supabase
        .from("sentence_cards")
        .select("*")
        .eq("deck_id", params.deckId)
        .order("created_at", { ascending: false }),
    ]).then(([deckResult, cardsResult, sentenceCardsResult]) => {
      setDeck((deckResult.data as Deck) || null);
      setCards((cardsResult.data || []) as Card[]);
      setSentenceCards((sentenceCardsResult.data || []) as SentenceCard[]);
      setLoading(false);
    });
  }, [configured, params.deckId]);

  return (
    <AuthGuard>
      <AppShell>
        {loading ? (
          <p className="text-sm text-zinc-600">Đang tải bộ thẻ...</p>
        ) : !deck ? (
          <EmptyState
            body="Không tìm thấy bộ thẻ này hoặc bạn không có quyền truy cập."
            title="Không tìm thấy bộ thẻ"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{deck.name}</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {cards.length} thẻ từ vựng · {sentenceCards.length} câu luyện tập
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href="/study"
                >
                  Ôn tập
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href="/study-sentences"
                >
                  Luyện câu
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/cards/new`}
                >
                  Thêm thẻ
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/sentences/new`}
                >
                  Tạo câu từ từ vựng
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/sentences/manual/new`}
                >
                  Thêm câu thủ công
                </Link>
                <PrimaryLink href={`/decks/${deck.id}/import`}>
                  Import từ vựng
                </PrimaryLink>
                <PrimaryLink href={`/decks/${deck.id}/import-words-to-sentences`}>
                  Import từ thành câu
                </PrimaryLink>
                <PrimaryLink href={`/decks/${deck.id}/import-sentences`}>
                  Import câu
                </PrimaryLink>
              </div>
            </div>

            <section className="mt-6">
              {cards.length === 0 && sentenceCards.length === 0 ? (
                <EmptyState
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <PrimaryLink href={`/decks/${deck.id}/cards/new`}>
                        Thêm thẻ thủ công
                      </PrimaryLink>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/sentences/new`}
                      >
                        Tạo câu từ từ vựng
                      </Link>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/sentences/manual/new`}
                      >
                        Thêm câu thủ công
                      </Link>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/import-words-to-sentences`}
                      >
                        Import từ thành câu
                      </Link>
                    </div>
                  }
                  body="Bạn có thể tự thêm từng thẻ, tạo câu từ một từ, hoặc dán danh sách để AI tạo hàng loạt."
                  title="Bộ thẻ chưa có nội dung"
                />
              ) : (
                <div className="space-y-6">
                  {cards.length > 0 ? (
                    <div>
                      <h2 className="mb-3 text-lg font-semibold">Thẻ từ vựng</h2>
                      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {cards.map((card) => (
                          <div
                            className="grid gap-2 border-b border-zinc-100 p-4 last:border-b-0 lg:grid-cols-[1fr_1fr_2fr_auto]"
                            key={card.id}
                          >
                            <div className="text-2xl font-semibold">
                              {card.chinese}
                            </div>
                            <div className="text-sm text-zinc-600">
                              {card.pinyin}
                            </div>
                            <div className="text-sm">
                              <p className="font-medium">{card.meaning_vi}</p>
                              <p className="mt-1 text-zinc-600">
                                {card.example_cn}
                              </p>
                              {card.example_pinyin ? (
                                <p className="text-teal-800">
                                  {card.example_pinyin}
                                </p>
                              ) : null}
                              <p className="text-zinc-500">{card.example_vi}</p>
                            </div>
                            <Link
                              className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
                              href={`/decks/${deck.id}/cards/${card.id}/edit`}
                            >
                              Sửa
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sentenceCards.length > 0 ? (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold">Câu luyện tập</h2>
                        <Link
                          className="text-sm font-medium text-teal-700 hover:text-teal-900"
                          href="/study-sentences"
                        >
                          Vào luyện câu
                        </Link>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {sentenceCards.map((sentenceCard) => (
                          <div
                            className="grid gap-2 border-b border-zinc-100 p-4 last:border-b-0 lg:grid-cols-[2fr_2fr_3fr_auto]"
                            key={sentenceCard.id}
                          >
                            <div className="font-medium">
                              {sentenceCard.sentence_vi}
                            </div>
                            <div>
                              <p className="text-lg font-semibold">
                                {sentenceCard.sentence_cn}
                              </p>
                              <p className="text-sm text-teal-800">
                                {sentenceCard.sentence_pinyin}
                              </p>
                            </div>
                            <div className="text-sm text-zinc-600">
                              {Array.isArray(sentenceCard.vocab_json)
                                ? sentenceCard.vocab_json
                                    .map((item) => `${item.chinese}: ${item.meaning_vi}`)
                                    .join(" · ")
                                : null}
                            </div>
                            <Link
                              className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
                              href={`/decks/${deck.id}/sentences/${sentenceCard.id}/edit`}
                            >
                              Sửa
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </>
        )}
      </AppShell>
    </AuthGuard>
  );
}
