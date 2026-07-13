"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, PrimaryLink } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { DeckGridSkeleton } from "@/components/loading-skeletons";
import { hasPublicEnv } from "@/lib/env";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Card, Deck, SentenceCard } from "@/lib/types";

type DeckAction =
  | "reset-progress"
  | "delete-vocabulary"
  | "delete-sentences"
  | "delete-deck";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

const selectPageSize = 1000;

async function fetchAllDeckCards(
  supabase: SupabaseBrowserClient,
  deckId: string,
) {
  const rows: Card[] = [];

  for (let from = 0; ; from += selectPageSize) {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId)
      .order("created_at", { ascending: false })
      .range(from, from + selectPageSize - 1);

    if (error) {
      return { data: null, error };
    }

    rows.push(...((data || []) as Card[]));

    if (!data || data.length < selectPageSize) {
      return { data: rows, error: null };
    }
  }
}

async function fetchAllDeckSentenceCards(
  supabase: SupabaseBrowserClient,
  deckId: string,
) {
  const rows: SentenceCard[] = [];

  for (let from = 0; ; from += selectPageSize) {
    const { data, error } = await supabase
      .from("sentence_cards")
      .select("*")
      .eq("deck_id", deckId)
      .order("created_at", { ascending: false })
      .range(from, from + selectPageSize - 1);

    if (error) {
      return { data: null, error };
    }

    rows.push(...((data || []) as SentenceCard[]));

    if (!data || data.length < selectPageSize) {
      return { data: rows, error: null };
    }
  }
}

export default function DeckPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const configured = hasPublicEnv();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [sentenceCards, setSentenceCards] = useState<SentenceCard[]>([]);
  const [loading, setLoading] = useState(configured);
  const [actionLoading, setActionLoading] = useState<DeckAction | "">("");
  const [actionMessage, setActionMessage] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    Promise.all([
      supabase.from("decks").select("*").eq("id", params.deckId).single(),
      fetchAllDeckCards(supabase, params.deckId),
      fetchAllDeckSentenceCards(supabase, params.deckId),
    ]).then(([deckResult, cardsResult, sentenceCardsResult]) => {
      const loadedDeck = (deckResult.data as Deck) || null;
      setDeck(loadedDeck);
      setDeckName(loadedDeck?.name || "");
      setCards((cardsResult.data || []) as Card[]);
      setSentenceCards((sentenceCardsResult.data || []) as SentenceCard[]);
      setLoading(false);
    });
  }, [configured, params.deckId]);

  async function runDeckAction(action: DeckAction) {
    if (!deck) {
      return;
    }

    const confirmations: Record<DeckAction, string> = {
      "reset-progress":
        "Reset toàn bộ tiến độ ôn của bộ thẻ này? Nội dung thẻ vẫn được giữ lại.",
      "delete-vocabulary":
        "Xóa toàn bộ thẻ từ vựng trong bộ này? Câu luyện tập vẫn được giữ lại.",
      "delete-sentences":
        "Xóa toàn bộ câu luyện tập trong bộ này? Thẻ từ vựng vẫn được giữ lại.",
      "delete-deck":
        "Xóa toàn bộ bộ thẻ này, bao gồm tất cả thẻ, câu và lịch ôn?",
    };

    if (!window.confirm(confirmations[action])) {
      return;
    }

    setActionLoading(action);
    setActionMessage("");

    const response = await fetchWithAuth("/api/deck-actions", {
      method: "POST",
      body: JSON.stringify({ deckId: deck.id, action }),
    });
    const data = await response.json();
    setActionLoading("");

    if (!response.ok) {
      setActionMessage(data.error || "Không thể thực hiện thao tác.");
      return;
    }

    if (action === "delete-deck") {
      router.push("/dashboard");
      return;
    }

    if (action === "delete-vocabulary") {
      setCards([]);
      setActionMessage("Đã xóa toàn bộ thẻ từ vựng trong bộ này.");
      return;
    }

    if (action === "delete-sentences") {
      setSentenceCards([]);
      setActionMessage("Đã xóa toàn bộ câu luyện tập trong bộ này.");
      return;
    }

    setActionMessage("Đã reset tiến độ học của bộ thẻ.");
  }

  async function saveDeckName() {
    const nextName = deckName.trim();

    if (!deck || !nextName) {
      setNameMessage("Tên bộ thẻ không được để trống.");
      return;
    }

    if (nextName === deck.name) {
      setEditingName(false);
      setNameMessage("");
      return;
    }

    setSavingName(true);
    setNameMessage("");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("decks")
      .update({ name: nextName })
      .eq("id", deck.id)
      .select("*")
      .single();
    setSavingName(false);

    if (error || !data) {
      setNameMessage("Không thể đổi tên bộ thẻ.");
      return;
    }

    setDeck(data as Deck);
    setDeckName(data.name);
    setEditingName(false);
    setNameMessage("Đã đổi tên bộ thẻ.");
  }

  function cancelEditingName() {
    setDeckName(deck?.name || "");
    setEditingName(false);
    setNameMessage("");
  }

  async function createShareLink() {
    if (!deck) {
      return;
    }

    setShareLoading(true);
    setShareMessage("");
    const response = await fetchWithAuth("/api/deck-shares", {
      method: "POST",
      body: JSON.stringify({ action: "create", deckId: deck.id }),
    });
    const data = await response.json().catch(() => null);
    setShareLoading(false);

    if (!response.ok || !data?.token) {
      setShareMessage(data?.error || "Không thể tạo liên kết chia sẻ.");
      return;
    }

    setShareToken(data.token);
    setShareMessage("Liên kết đã sẵn sàng.");
  }

  async function copyShareLink() {
    if (!shareToken) {
      return;
    }

    const shareUrl = `${window.location.origin}/shared-decks/${shareToken}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Đã sao chép liên kết.");
    } catch {
      setShareMessage("Không thể tự sao chép. Hãy chọn và sao chép liên kết bên dưới.");
    }
  }

  async function disableShareLink() {
    if (!deck) {
      return;
    }

    setShareLoading(true);
    setShareMessage("");
    const response = await fetchWithAuth("/api/deck-shares", {
      method: "POST",
      body: JSON.stringify({ action: "disable", deckId: deck.id }),
    });
    const data = await response.json().catch(() => null);
    setShareLoading(false);

    if (!response.ok) {
      setShareMessage(data?.error || "Không thể tắt liên kết chia sẻ.");
      return;
    }

    setShareToken("");
    setShareMessage("Đã tắt liên kết chia sẻ.");
  }

  return (
    <AuthGuard>
      <AppShell>
        {loading ? (
          <div className="space-y-6">
            <div>
              <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-200/80" />
              <div className="mt-3 h-4 w-40 animate-pulse rounded-md bg-zinc-200/80" />
            </div>
            <DeckGridSkeleton count={3} />
            <DeckGridSkeleton count={3} />
          </div>
        ) : !deck ? (
          <EmptyState
            body="Không tìm thấy bộ thẻ này hoặc bạn không có quyền truy cập."
            title="Không tìm thấy bộ thẻ"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {editingName ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      autoFocus
                      className="min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-lg font-semibold outline-none focus:border-teal-700 sm:w-72"
                      maxLength={100}
                      onChange={(event) => setDeckName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveDeckName();
                        }
                        if (event.key === "Escape") {
                          cancelEditingName();
                        }
                      }}
                      value={deckName}
                    />
                    <div className="flex gap-2">
                      <button
                        className="min-h-10 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                        disabled={savingName}
                        onClick={() => void saveDeckName()}
                        type="button"
                      >
                        {savingName ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
                        disabled={savingName}
                        onClick={cancelEditingName}
                        type="button"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold">{deck.name}</h1>
                    <button
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      onClick={() => {
                        setDeckName(deck.name);
                        setEditingName(true);
                        setNameMessage("");
                      }}
                      type="button"
                    >
                      Đổi tên
                    </button>
                  </div>
                )}
                <p className="mt-1 text-sm text-zinc-600">
                  {cards.length} thẻ từ vựng · {sentenceCards.length} câu luyện tập
                </p>
                {nameMessage ? (
                  <p
                    className={`mt-2 text-sm ${
                      nameMessage.startsWith("Đã")
                        ? "text-teal-700"
                        : "text-red-700"
                    }`}
                  >
                    {nameMessage}
                  </p>
                ) : null}
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
                <button
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
                  disabled={shareLoading}
                  onClick={createShareLink}
                  type="button"
                >
                  {shareLoading ? "Đang tạo..." : "Chia sẻ"}
                </button>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/cards/new`}
                  prefetch={false}
                >
                  Thêm thẻ
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/sentences/new`}
                  prefetch={false}
                >
                  Tạo câu từ từ vựng
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  href={`/decks/${deck.id}/sentences/manual/new`}
                  prefetch={false}
                >
                  Thêm câu thủ công
                </Link>
                <PrimaryLink href={`/decks/${deck.id}/import`} prefetch={false}>
                  Import từ vựng
                </PrimaryLink>
                <PrimaryLink
                  href={`/decks/${deck.id}/import-words-to-sentences`}
                  prefetch={false}
                >
                  Import từ thành câu
                </PrimaryLink>
                <PrimaryLink
                  href={`/decks/${deck.id}/import-sentences`}
                  prefetch={false}
                >
                  Import câu
                </PrimaryLink>
              </div>
            </div>

            {shareToken || shareMessage ? (
              <section className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-teal-950">Chia sẻ bộ thẻ</h2>
                    <p className="mt-1 text-sm leading-6 text-teal-900">
                      Người nhận sẽ có bản sao và tiến độ học riêng.
                    </p>
                  </div>
                  {shareToken ? (
                    <button
                      className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
                      disabled={shareLoading}
                      onClick={disableShareLink}
                      type="button"
                    >
                      Tắt chia sẻ
                    </button>
                  ) : null}
                </div>

                {shareToken ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label="Liên kết chia sẻ bộ thẻ"
                      className="min-h-10 min-w-0 flex-1 rounded-md border border-teal-300 bg-white px-3 text-sm"
                      onFocus={(event) => event.currentTarget.select()}
                      readOnly
                      value={`${window.location.origin}/shared-decks/${shareToken}`}
                    />
                    <button
                      className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                      onClick={copyShareLink}
                      type="button"
                    >
                      Sao chép liên kết
                    </button>
                  </div>
                ) : null}

                {shareMessage ? (
                  <p className="mt-3 text-sm text-teal-900">{shareMessage}</p>
                ) : null}
              </section>
            ) : null}

            <section className="mt-6">
              {cards.length === 0 && sentenceCards.length === 0 ? (
                <EmptyState
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <PrimaryLink
                        href={`/decks/${deck.id}/cards/new`}
                        prefetch={false}
                      >
                        Thêm thẻ thủ công
                      </PrimaryLink>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/sentences/new`}
                        prefetch={false}
                      >
                        Tạo câu từ từ vựng
                      </Link>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/sentences/manual/new`}
                        prefetch={false}
                      >
                        Thêm câu thủ công
                      </Link>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                        href={`/decks/${deck.id}/import-words-to-sentences`}
                        prefetch={false}
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
                              prefetch={false}
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
                              prefetch={false}
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

            <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5">
              <h2 className="text-lg font-semibold text-red-900">
                Quản lý bộ thẻ
              </h2>
              <p className="mt-1 text-sm text-red-800">
                Các thao tác này ảnh hưởng trực tiếp đến nội dung hoặc tiến độ
                học của bộ thẻ hiện tại.
              </p>

              {actionMessage ? (
                <p
                  className={`mt-3 text-sm ${
                    actionMessage.startsWith("Đã")
                      ? "text-teal-800"
                      : "text-red-700"
                  }`}
                >
                  {actionMessage}
                </p>
              ) : null}

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
                  disabled={Boolean(actionLoading)}
                  onClick={() => runDeckAction("reset-progress")}
                  type="button"
                >
                  {actionLoading === "reset-progress"
                    ? "Đang reset..."
                    : "Reset tiến độ"}
                </button>
                <button
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
                  disabled={Boolean(actionLoading) || cards.length === 0}
                  onClick={() => runDeckAction("delete-vocabulary")}
                  type="button"
                >
                  {actionLoading === "delete-vocabulary"
                    ? "Đang xóa..."
                    : "Xóa thẻ từ"}
                </button>
                <button
                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
                  disabled={Boolean(actionLoading) || sentenceCards.length === 0}
                  onClick={() => runDeckAction("delete-sentences")}
                  type="button"
                >
                  {actionLoading === "delete-sentences"
                    ? "Đang xóa..."
                    : "Xóa câu"}
                </button>
                <button
                  className="min-h-10 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                  disabled={Boolean(actionLoading)}
                  onClick={() => runDeckAction("delete-deck")}
                  type="button"
                >
                  {actionLoading === "delete-deck"
                    ? "Đang xóa..."
                    : "Xóa toàn bộ deck"}
                </button>
              </div>
            </section>
          </>
        )}
      </AppShell>
    </AuthGuard>
  );
}
