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
  cardId: z.string().uuid(),
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
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, chinese, example_cn, word_audio_url, sentence_audio_url")
    .eq("id", body.data.cardId)
    .eq("user_id", user.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json(
      { error: "Không tìm thấy thẻ" },
      { status: 404 },
    );
  }

  const missingAudioCount =
    (card.word_audio_url ? 0 : 1) +
    (card.sentence_audio_url || !card.example_cn ? 0 : 1);
  let spentCredits = 0;

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: missingAudioCount * creditCosts.ttsAudio,
      eventType: "ensure_card_audio",
      metadata: { cardId: card.id, missingAudioCount },
    });
    spentCredits = creditCharge.creditsUsed;

    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      card.word_audio_url
        ? Promise.resolve(card.word_audio_url)
        : createAndUploadSpeech(user.id, card.id, "word", card.chinese),
      card.sentence_audio_url
        ? Promise.resolve(card.sentence_audio_url)
        : card.example_cn
          ? createAndUploadSpeech(
              user.id,
              card.id,
              "sentence",
              card.example_cn,
            )
          : Promise.resolve(null),
    ]);

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        word_audio_url: wordAudioUrl,
        sentence_audio_url: sentenceAudioUrl,
      })
      .eq("id", card.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      wordAudioUrl,
      sentenceAudioUrl,
      creditBalance: creditCharge.balance,
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
        eventType: "refund_ensure_card_audio",
        metadata: { reason: "ensure_card_audio_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Không thể tạo audio cho thẻ" },
      { status: 500 },
    );
  }
}
