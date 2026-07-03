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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  deckId: z.string().uuid(),
  items: z
    .array(
      z.object({
        chinese: z.string().min(1),
        meaning_vi: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(100),
});

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

  const creditsRequired = body.data.items.length * creditCosts.cardAi;
  let spentCredits = 0;

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: creditsRequired,
      eventType: "preview_vocabulary_ai",
      metadata: { itemCount: body.data.items.length },
    });
    spentCredits = creditCharge.creditsUsed;

    const cards = [];

    for (const item of body.data.items) {
      cards.push(await generateCardData(item.chinese, item.meaning_vi));
    }

    return NextResponse.json({
      success: true,
      cards,
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
        eventType: "refund_preview_vocabulary_ai",
        metadata: { reason: "preview_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Không thể tạo preview bằng AI" },
      { status: 500 },
    );
  }
}
