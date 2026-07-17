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
import {
  createAndUploadSpeech,
  getOrCreateTemplateSpeech,
} from "@/lib/tts";

const schema = z.object({
  sentenceCardId: z.string().uuid(),
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
  const { data: sentenceCard, error: cardError } = await supabase
    .from("sentence_cards")
    .select("id, deck_id, sentence_cn, sentence_audio_url")
    .eq("id", body.data.sentenceCardId)
    .eq("user_id", user.id)
    .single();

  if (cardError || !sentenceCard) {
    return NextResponse.json(
      { error: "Không tìm thấy câu luyện tập" },
      { status: 404 },
    );
  }

  if (sentenceCard.sentence_audio_url) {
    return NextResponse.json({
      success: true,
      sentenceAudioUrl: sentenceCard.sentence_audio_url,
      creditsUsed: 0,
    });
  }

  const { data: deck } = await supabase
    .from("decks")
    .select("source_template_slug")
    .eq("id", sentenceCard.deck_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (deck?.source_template_slug) {
    try {
      const sentenceAudioUrl = await getOrCreateTemplateSpeech(
        deck.source_template_slug,
        "sentence",
        sentenceCard.sentence_cn,
      );

      if (sentenceAudioUrl) {
        const { error: updateError } = await supabase
          .from("sentence_cards")
          .update({ sentence_audio_url: sentenceAudioUrl })
          .eq("id", sentenceCard.id)
          .eq("user_id", user.id);

        if (updateError) {
          throw updateError;
        }
      }

      return NextResponse.json({
        success: true,
        sentenceAudioUrl,
        creditsUsed: 0,
      });
    } catch (error) {
      console.error("Could not prepare shared template sentence audio", error);
      return NextResponse.json(
        { error: "Không thể chuẩn bị audio cho câu mẫu" },
        { status: 500 },
      );
    }
  }

  let spentCredits = 0;

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: creditCosts.ttsAudio,
      eventType: "ensure_sentence_audio",
      metadata: { sentenceCardId: sentenceCard.id },
    });
    spentCredits = creditCharge.creditsUsed;

    const sentenceAudioUrl = await createAndUploadSpeech(
      user.id,
      sentenceCard.id,
      "sentence",
      sentenceCard.sentence_cn,
    );

    const { error: updateError } = await supabase
      .from("sentence_cards")
      .update({ sentence_audio_url: sentenceAudioUrl })
      .eq("id", sentenceCard.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
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
        eventType: "refund_ensure_sentence_audio",
        metadata: { reason: "ensure_sentence_audio_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Không thể tạo audio cho câu luyện tập" },
      { status: 500 },
    );
  }
}
