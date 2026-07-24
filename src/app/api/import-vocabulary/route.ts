import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCardData } from "@/lib/ai";
import { getRequestUser } from "@/lib/auth";
import {
  createCreditErrorResponse,
  creditCosts,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { getImmediateDueAt } from "@/lib/immediate-due";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAndUploadSpeech } from "@/lib/tts";

const schema = z.object({
  deckId: z.string().uuid(),
  items: z
    .array(
      z.object({
        chinese: z.string().min(1),
        pinyin: z.string().min(1).optional(),
        meaning_vi: z.string().min(1).optional(),
        example_cn: z.string().min(1).optional(),
        example_pinyin: z.string().min(1).optional(),
        example_vi: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(100),
});

function needsAiGeneration(item: z.infer<typeof schema>["items"][number]) {
  return !(
    item.pinyin &&
    item.meaning_vi &&
    item.example_cn &&
    item.example_pinyin &&
    item.example_vi
  );
}

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", body.data.deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  let created = 0;
  let spentCredits = 0;
  const creditsRequired = body.data.items.reduce((total, item) => {
    const aiCost = needsAiGeneration(item) ? creditCosts.cardAi : 0;
    const audioCost = creditCosts.ttsAudio * 2;

    return total + aiCost + audioCost;
  }, 0);

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: creditsRequired,
      eventType: "import_vocabulary",
      metadata: {
        itemCount: body.data.items.length,
        creditsRequired,
      },
    });
    spentCredits = creditCharge.creditsUsed;

    for (const item of body.data.items) {
      const generated =
        !needsAiGeneration(item)
          ? {
              chinese: item.chinese,
              pinyin: item.pinyin || "",
              meaning_vi: item.meaning_vi || "",
              example_cn: item.example_cn || "",
              example_pinyin: item.example_pinyin || "",
              example_vi: item.example_vi || "",
            }
          : await generateCardData(item.chinese, item.meaning_vi);

      const { data: card, error: cardError } = await supabase
        .from("cards")
        .insert({
          user_id: user.id,
          deck_id: body.data.deckId,
          chinese: generated.chinese,
          pinyin: generated.pinyin,
          meaning_vi: generated.meaning_vi,
          example_cn: generated.example_cn,
          example_pinyin: generated.example_pinyin,
          example_vi: generated.example_vi,
        })
        .select("id")
        .single();

      if (cardError || !card) {
        throw cardError || new Error("Card insert failed");
      }

      const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
        createAndUploadSpeech(user.id, card.id, "word", generated.chinese),
        createAndUploadSpeech(user.id, card.id, "sentence", generated.example_cn),
      ]);

      if (wordAudioUrl || sentenceAudioUrl) {
        const { error: audioError } = await supabase
          .from("cards")
          .update({
            word_audio_url: wordAudioUrl,
            sentence_audio_url: sentenceAudioUrl,
          })
          .eq("id", card.id)
          .eq("user_id", user.id);

        if (audioError) {
          throw audioError;
        }
      }

      const { error: reviewError } = await supabase.from("reviews").insert({
        user_id: user.id,
        card_id: card.id,
        next_review_at: getImmediateDueAt(),
      });

      if (reviewError) {
        throw reviewError;
      }

      created += 1;
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
        eventType: "refund_import_vocabulary",
        metadata: { reason: "import_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Import failed", created },
      { status: 500 },
    );
  }
}
