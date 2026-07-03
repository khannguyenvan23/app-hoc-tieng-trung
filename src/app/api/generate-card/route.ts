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
  chinese: z.string().min(1),
  meaning_vi: z.string().min(1).optional(),
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
  let spentCredits = 0;

  try {
    const creditCharge = await spendCredits({
      supabase,
      userId: user.id,
      credits: creditCosts.cardAi,
      eventType: "generate_card_ai",
      metadata: { chinese: body.data.chinese },
    });
    spentCredits = creditCharge.creditsUsed;

    const card = await generateCardData(
      body.data.chinese,
      body.data.meaning_vi,
    );
    return NextResponse.json({
      ...card,
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
        eventType: "refund_generate_card_ai",
        metadata: { reason: "generate_card_failed" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Could not generate card" },
      { status: 500 },
    );
  }
}
