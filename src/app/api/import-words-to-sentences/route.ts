import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSentenceFromWord } from "@/lib/ai";
import { mapWithConcurrency } from "@/lib/async";
import { getRequestUser } from "@/lib/auth";
import {
  createCreditErrorResponse,
  creditCosts,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  deckId: z.string().uuid(),
  items: z
    .array(
      z.object({
        chinese: z.string().min(1).max(30),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", body.data.deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ thẻ" },
      { status: 404 },
    );
  }

  let created = 0;
  let spentCredits = 0;
  const creditsRequired = body.data.items.length * creditCosts.sentenceAi;

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: creditsRequired,
      eventType: "import_words_to_sentences",
      metadata: {
        itemCount: body.data.items.length,
        creditsRequired,
      },
    });
    spentCredits = creditCharge.creditsUsed;

    const generatedCards = await mapWithConcurrency(
      body.data.items,
      4,
      (item) => generateSentenceFromWord(item.chinese.trim()),
    );

    const { data: sentenceCards, error: cardError } = await supabase
      .from("sentence_cards")
      .insert(
        generatedCards.map((generated) => ({
          user_id: user.id,
          deck_id: body.data.deckId,
          sentence_cn: generated.sentence_cn,
          sentence_pinyin: generated.sentence_pinyin,
          sentence_vi: generated.sentence_vi,
          vocab_json: generated.vocab_items,
        })),
      )
      .select("id");

    if (cardError || !sentenceCards) {
      throw cardError || new Error("Sentence card insert failed");
    }

    created = sentenceCards.length;

    const { error: reviewError } = await supabase
      .from("sentence_reviews")
      .insert(
        sentenceCards.map((sentenceCard) => ({
          user_id: user.id,
          sentence_card_id: sentenceCard.id,
        })),
      );

    if (reviewError) {
      throw reviewError;
    }

    return NextResponse.json({
      success: true,
      created,
      creditBalance: creditCharge.balance,
      creditsUsed: spentCredits,
    });
  } catch (error) {
    console.error(error);
    const creditResponse = createCreditErrorResponse(error);

    if (creditResponse) {
      return creditResponse;
    }

    if (spentCredits > 0 && created === 0) {
      await refundCredits({
        supabase,
        userId: user.id,
        credits: spentCredits,
        eventType: "refund_import_words_to_sentences",
        metadata: { reason: "import_failed" },
      }).catch(console.error);
    }

    const message =
      error instanceof Error ? error.message : "Import từ thành câu thất bại";
    const missingSentenceTables =
      message.includes("sentence_cards") ||
      message.includes("sentence_reviews") ||
      message.includes("schema cache");

    return NextResponse.json(
      {
        error: missingSentenceTables
          ? "Supabase chưa có bảng luyện câu. Hãy chạy migration 003_sentence_cards.sql trong SQL Editor rồi thử lại."
          : `Import từ thành câu thất bại: ${message}`,
        created,
      },
      { status: 500 },
    );
  }
}
