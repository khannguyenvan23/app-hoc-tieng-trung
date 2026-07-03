"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { fetchWithAuth } from "@/lib/fetch-auth";
import { parseVocabularyText } from "@/lib/parse-vocabulary";
import type { GeneratedCard } from "@/lib/types";

type PreviewCard = GeneratedCard;

const sample = `好吃
味道
北方
聊天
认真`;

const previewFields: {
  key: keyof PreviewCard;
  label: string;
  multiline?: boolean;
}[] = [
  { key: "chinese", label: "Chữ Hán" },
  { key: "pinyin", label: "Pinyin" },
  { key: "meaning_vi", label: "Nghĩa" },
  { key: "example_cn", label: "Câu ví dụ", multiline: true },
  { key: "example_pinyin", label: "Pinyin câu", multiline: true },
  { key: "example_vi", label: "Dịch câu", multiline: true },
];

export default function ImportPage() {
  const params = useParams<{ deckId: string }>();
  const [text, setText] = useState(sample);
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([]);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const items = useMemo(() => parseVocabularyText(text), [text]);

  function updatePreviewCard(
    cardIndex: number,
    key: keyof PreviewCard,
    value: string,
  ) {
    setPreviewCards((current) =>
      current.map((card, index) =>
        index === cardIndex ? { ...card, [key]: value } : card,
      ),
    );
  }

  function removePreviewCard(cardIndex: number) {
    setPreviewCards((current) =>
      current.filter((_, index) => index !== cardIndex),
    );
  }

  async function createPreview(event: FormEvent) {
    event.preventDefault();
    setGenerating(true);
    setMessage("");
    setPreviewCards([]);

    const response = await fetchWithAuth("/api/preview-vocabulary", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        items,
      }),
    });
    const data = await response.json();
    setGenerating(false);

    if (!response.ok) {
      setMessage(data.error || "Tạo preview thất bại");
      return;
    }

    setPreviewCards((data.cards || []) as PreviewCard[]);
    setMessage("Đã tạo preview. Bạn có thể sửa trước khi lưu.");
  }

  async function saveCards() {
    const validCards = previewCards.filter(
      (card) =>
        card.chinese.trim() &&
        card.pinyin.trim() &&
        card.meaning_vi.trim() &&
        card.example_cn.trim() &&
        card.example_pinyin.trim() &&
        card.example_vi.trim(),
    );

    if (validCards.length === 0) {
      setMessage("Preview chưa có thẻ hợp lệ để lưu.");
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetchWithAuth("/api/import-vocabulary", {
      method: "POST",
      body: JSON.stringify({
        deckId: params.deckId,
        items: validCards,
      }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Import thất bại");
      return;
    }

    setMessage(`Đã lưu ${data.created} thẻ.`);
    setPreviewCards([]);
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="max-w-6xl">
          <form onSubmit={createPreview}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Import từ vựng</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Dán từ tiếng Trung, tạo preview bằng AI, sửa lại nội dung rồi
                  mới lưu thẻ.
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
              className="mt-6 h-56 w-full rounded-lg border border-zinc-300 bg-white p-4 font-mono text-sm outline-none focus:border-teal-700"
              onChange={(event) => setText(event.target.value)}
              value={text}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600">
                {items.length} từ sẵn sàng gửi AI · tạo preview cần{" "}
                {items.length} credit
              </p>
              <button
                className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={generating || saving || items.length === 0}
                type="submit"
              >
                {generating ? "Đang tạo preview..." : "Tạo preview"}
              </button>
            </div>
          </form>

          {previewCards.length > 0 ? (
            <section className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Preview trước khi lưu</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Sửa nghĩa, pinyin hoặc câu ví dụ trực tiếp trong bảng. Khi lưu,
                    app tạo audio và cần {previewCards.length * 2} credit.
                  </p>
                </div>
                <button
                  className="min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  disabled={saving || generating}
                  onClick={saveCards}
                  type="button"
                >
                  {saving ? "Đang lưu..." : `Lưu ${previewCards.length} thẻ`}
                </button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-[1100px] divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                    <tr>
                      {previewFields.map((field) => (
                        <th className="px-3 py-3" key={field.key}>
                          {field.label}
                        </th>
                      ))}
                      <th className="w-20 px-3 py-3">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {previewCards.map((card, cardIndex) => (
                      <tr key={`${card.chinese}-${cardIndex}`}>
                        {previewFields.map((field) => (
                          <td className="min-w-36 align-top" key={field.key}>
                            {field.multiline ? (
                              <textarea
                                className="h-24 w-full resize-y border-0 bg-transparent px-3 py-3 outline-none focus:bg-teal-50"
                                onChange={(event) =>
                                  updatePreviewCard(
                                    cardIndex,
                                    field.key,
                                    event.target.value,
                                  )
                                }
                                value={card[field.key]}
                              />
                            ) : (
                              <input
                                className="w-full border-0 bg-transparent px-3 py-3 outline-none focus:bg-teal-50"
                                onChange={(event) =>
                                  updatePreviewCard(
                                    cardIndex,
                                    field.key,
                                    event.target.value,
                                  )
                                }
                                value={card[field.key]}
                              />
                            )}
                          </td>
                        ))}
                        <td className="align-top">
                          <button
                            className="m-2 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
                            onClick={() => removePreviewCard(cardIndex)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {message ? (
            <p className="mt-4 text-sm text-zinc-700">{message}</p>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
