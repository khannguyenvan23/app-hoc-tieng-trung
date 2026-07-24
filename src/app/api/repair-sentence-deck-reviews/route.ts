import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getImmediateDueAt } from "@/lib/immediate-due";
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
    return NextResponse.json({ error: "Du lieu khong hop le" }, { status: 400 });
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
      { error: "Khong tim thay bo the" },
      { status: 404 },
    );
  }

  const { data: sentenceCards, error: cardsError } = await supabase
    .from("sentence_cards")
    .select("id, sentence_reviews(id, review_count)")
    .eq("deck_id", body.data.deckId)
    .eq("user_id", user.id);

  if (cardsError) {
    console.error(cardsError);
    return NextResponse.json(
      { error: "Khong the kiem tra cau trong bo" },
      { status: 500 },
    );
  }

  const cardsWithoutReviews = (sentenceCards || []).filter(
    (card) =>
      !Array.isArray(card.sentence_reviews) ||
      card.sentence_reviews.length === 0,
  );
  const unreviewedReviewIds = (sentenceCards || []).flatMap((card) =>
    Array.isArray(card.sentence_reviews)
      ? card.sentence_reviews
          .filter((review) => Number(review.review_count) === 0)
          .map((review) => review.id)
      : [],
  );
  const dueNow = getImmediateDueAt();

  if (cardsWithoutReviews.length > 0) {
    const { error: reviewsError } = await supabase.from("sentence_reviews").insert(
      cardsWithoutReviews.map((card) => ({
        user_id: user.id,
        sentence_card_id: card.id,
        next_review_at: dueNow,
      })),
    );

    if (reviewsError) {
      console.error(reviewsError);
      return NextResponse.json(
        { error: `Khong the tao lich on cau: ${reviewsError.message}` },
        { status: 500 },
      );
    }
  }

  if (unreviewedReviewIds.length > 0) {
    for (let index = 0; index < unreviewedReviewIds.length; index += 100) {
      const { error: updateError } = await supabase
        .from("sentence_reviews")
        .update({ next_review_at: dueNow })
        .eq("user_id", user.id)
        .in("id", unreviewedReviewIds.slice(index, index + 100));

      if (updateError) {
        console.error(updateError);
        return NextResponse.json(
          { error: `Khong the cap nhat lich on cau: ${updateError.message}` },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    created: cardsWithoutReviews.length,
    updated: unreviewedReviewIds.length,
  });
}
