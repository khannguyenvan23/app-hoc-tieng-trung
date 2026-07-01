import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getNextReview } from "@/lib/review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
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
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, review_count, interval_days, ease_factor")
    .eq("card_id", body.data.cardId)
    .eq("user_id", user.id)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const nextReview = getNextReview(body.data.rating, review);
  const { error } = await supabase
    .from("reviews")
    .update({
      ...nextReview,
      review_count: Number(review.review_count || 0) + 1,
      last_rating: body.data.rating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Review update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...nextReview });
}
