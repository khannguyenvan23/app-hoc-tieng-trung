import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import {
  createCreditErrorResponse,
  creditCosts,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAndUploadSpeech } from "@/lib/tts";

const schema = z.object({
  deckId: z.string().uuid(),
  sentence_cn: z.string().min(1),
  sentence_pinyin: z.string().optional(),
  sentence_vi: z.string().min(1),
  vocab_json: z
    .array(
      z.object({
        chinese: z.string().min(1),
        pinyin: z.string(),
        meaning_vi: z.string().min(1),
      }),
    )
    .default([]),
  sentence_audio_url: z.string().optional(),
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

  const shouldCreateAudio = !body.data.sentence_audio_url?.trim();
  let spentCredits = 0;

  try {
    if (shouldCreateAudio) {
      const creditCharge = await spendCredits({
        supabase,
        userId: user.id,
        credits: creditCosts.ttsAudio,
        eventType: "manual_sentence_audio",
        metadata: { deckId: body.data.deckId },
      });
      spentCredits = creditCharge.creditsUsed;
    }

    const { data: sentenceCard, error: cardError } = await supabase
      .from("sentence_cards")
      .insert({
        user_id: user.id,
        deck_id: body.data.deckId,
        sentence_cn: body.data.sentence_cn.trim(),
        sentence_pinyin: body.data.sentence_pinyin?.trim() || null,
        sentence_vi: body.data.sentence_vi.trim(),
        vocab_json: body.data.vocab_json,
        sentence_audio_url: body.data.sentence_audio_url?.trim() || null,
      })
      .select("id")
      .single();

    if (cardError || !sentenceCard) {
      throw cardError || new Error("Sentence card insert failed");
    }

    if (shouldCreateAudio) {
      const sentenceAudioUrl = await createAndUploadSpeech(
        user.id,
        sentenceCard.id,
        "sentence",
        body.data.sentence_cn,
      );

      if (sentenceAudioUrl) {
        const { error: audioError } = await supabase
          .from("sentence_cards")
          .update({ sentence_audio_url: sentenceAudioUrl })
          .eq("id", sentenceCard.id)
          .eq("user_id", user.id);

        if (audioError) {
          throw audioError;
        }
      }
    }

    const { error: reviewError } = await supabase
      .from("sentence_reviews")
      .insert({
        user_id: user.id,
        sentence_card_id: sentenceCard.id,
        next_review_at: new Date(Date.now() - 60_000).toISOString(),
      });

    if (reviewError) {
      throw reviewError;
    }

    return NextResponse.json({
      success: true,
      sentenceCardId: sentenceCard.id,
      creditsUsed: spentCredits,
    });
  } catch (error) {
    console.error(error);
    const creditResponse = createCreditErrorResponse(error);

    if (creditResponse) {
      return creditResponse;
    }

    if (spentCredits > 0) {
      await refundCredits({
        supabase,
        userId: user.id,
        credits: spentCredits,
        eventType: "refund_manual_sentence_audio",
        metadata: { reason: "manual_sentence_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Không thể tạo câu thủ công" },
      { status: 500 },
    );
  }
}
