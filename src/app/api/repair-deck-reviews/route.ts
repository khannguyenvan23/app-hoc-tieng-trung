import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  deckId: z.string().uuid(),
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

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, reviews(id)")
    .eq("deck_id", body.data.deckId)
    .eq("user_id", user.id);

  if (cardsError) {
    console.error(cardsError);
    return NextResponse.json(
      { error: "Không thể kiểm tra thẻ trong bộ" },
      { status: 500 },
    );
  }

  const cardsWithoutReviews = (cards || []).filter(
    (card) => !Array.isArray(card.reviews) || card.reviews.length === 0,
  );

  if (cardsWithoutReviews.length === 0) {
    return NextResponse.json({ success: true, created: 0 });
  }

  const now = new Date().toISOString();
  const { error: reviewsError } = await supabase.from("reviews").insert(
    cardsWithoutReviews.map((card) => ({
      user_id: user.id,
      card_id: card.id,
      next_review_at: now,
    })),
  );

  if (reviewsError) {
    console.error(reviewsError);
    return NextResponse.json(
      { error: `Không thể tạo lịch ôn: ${reviewsError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    created: cardsWithoutReviews.length,
  });
}
