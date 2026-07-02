import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  deckId: z.string().uuid(),
  action: z.enum([
    "reset-progress",
    "delete-vocabulary",
    "delete-sentences",
    "delete-deck",
  ]),
});

async function getOwnedDeck(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  deckId: string,
  userId: string,
) {
  return supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", userId)
    .single();
}

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
  const { data: deck, error: deckError } = await getOwnedDeck(
    supabase,
    body.data.deckId,
    user.id,
  );

  if (deckError || !deck) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ thẻ" },
      { status: 404 },
    );
  }

  if (body.data.action === "delete-deck") {
    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", body.data.deckId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: `Không thể xóa bộ thẻ: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  const [{ data: cards, error: cardsError }, { data: sentenceCards, error: sentenceCardsError }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("id")
        .eq("deck_id", body.data.deckId)
        .eq("user_id", user.id),
      supabase
        .from("sentence_cards")
        .select("id")
        .eq("deck_id", body.data.deckId)
        .eq("user_id", user.id),
    ]);

  if (cardsError || sentenceCardsError) {
    console.error(cardsError || sentenceCardsError);
    return NextResponse.json(
      { error: "Không thể đọc nội dung bộ thẻ" },
      { status: 500 },
    );
  }

  if (body.data.action === "delete-vocabulary") {
    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("deck_id", body.data.deckId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: `Không thể xóa thẻ từ vựng: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deleted: cards?.length || 0 });
  }

  if (body.data.action === "delete-sentences") {
    const { error } = await supabase
      .from("sentence_cards")
      .delete()
      .eq("deck_id", body.data.deckId)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: `Không thể xóa câu luyện tập: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deleted: sentenceCards?.length || 0,
    });
  }

  const now = new Date().toISOString();
  const dueNow = new Date(Date.now() - 60_000).toISOString();
  const cardIds = (cards || []).map((card) => card.id);
  const sentenceCardIds = (sentenceCards || []).map((card) => card.id);

  const reviewResults = await Promise.all([
    cardIds.length
      ? supabase
          .from("reviews")
          .update({
            next_review_at: dueNow,
            interval_days: 0,
            ease_factor: 2.5,
            review_count: 0,
            last_rating: null,
            updated_at: now,
          })
          .eq("user_id", user.id)
          .in("card_id", cardIds)
      : Promise.resolve({ error: null }),
    sentenceCardIds.length
      ? supabase
          .from("sentence_reviews")
          .update({
            next_review_at: dueNow,
            interval_days: 0,
            ease_factor: 2.5,
            review_count: 0,
            last_rating: null,
            updated_at: now,
          })
          .eq("user_id", user.id)
          .in("sentence_card_id", sentenceCardIds)
      : Promise.resolve({ error: null }),
  ]);

  const resetError = reviewResults.find((result) => result.error)?.error;

  if (resetError) {
    console.error(resetError);
    return NextResponse.json(
      { error: `Không thể reset tiến độ: ${resetError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    reset: cardIds.length + sentenceCardIds.length,
  });
}
