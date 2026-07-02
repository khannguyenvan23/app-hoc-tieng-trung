import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TemplateCardRow = {
  chinese: string;
  pinyin: string | null;
  meaning_vi: string | null;
  example_cn: string | null;
  example_pinyin?: string | null;
  example_vi: string | null;
};

type TemplateSentenceCardRow = {
  sentence_cn: string;
  sentence_pinyin: string | null;
  sentence_vi: string | null;
  vocab_json: unknown;
};

const copySchema = z.object({
  templateDeckId: z.string().uuid(),
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "Unknown error";
}

function mapTemplateCards(
  userId: string,
  deckId: string,
  templateCards: TemplateCardRow[],
  includeExamplePinyin: boolean,
) {
  return templateCards.map((card) => ({
    user_id: userId,
    deck_id: deckId,
    chinese: card.chinese,
    pinyin: card.pinyin,
    meaning_vi: card.meaning_vi,
    example_cn: card.example_cn,
    ...(includeExamplePinyin ? { example_pinyin: card.example_pinyin } : {}),
    example_vi: card.example_vi,
  }));
}

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: templates, error } = await supabase
    .from("template_decks")
    .select("*, template_cards(id), template_sentence_cards(id)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể tải bộ thẻ mẫu" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    templates: (templates || []).map((template) => ({
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      level: template.level,
      created_at: template.created_at,
      card_count: Array.isArray(template.template_cards)
        ? template.template_cards.length +
          (Array.isArray(template.template_sentence_cards)
            ? template.template_sentence_cards.length
            : 0)
        : 0,
    })),
  });
}

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = copySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: template, error: templateError } = await supabase
    .from("template_decks")
    .select("*")
    .eq("id", body.data.templateDeckId)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ thẻ mẫu" },
      { status: 404 },
    );
  }

  const { data: templateCards, error: cardsError } = await supabase
    .from("template_cards")
    .select("*")
    .eq("template_deck_id", template.id)
    .order("position", { ascending: true });

  if (cardsError) {
    console.error(cardsError);
    return NextResponse.json(
      { error: "Không thể đọc thẻ mẫu" },
      { status: 500 },
    );
  }

  const { data: templateSentenceCards, error: sentenceCardsError } =
    await supabase
      .from("template_sentence_cards")
      .select("*")
      .eq("template_deck_id", template.id)
      .order("position", { ascending: true });

  const hasTemplateSentenceTable = !sentenceCardsError;

  if (!templateCards?.length) {
    return NextResponse.json(
      { error: "Bộ thẻ mẫu chưa có thẻ" },
      { status: 400 },
    );
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      user_id: user.id,
      name: template.name,
    })
    .select("id")
    .single();

  if (deckError || !deck) {
    console.error(deckError);
    return NextResponse.json(
      { error: `Không thể tạo bộ thẻ từ mẫu: ${getErrorMessage(deckError)}` },
      { status: 500 },
    );
  }

  const mappedCards = mapTemplateCards(
    user.id,
    deck.id,
    templateCards as TemplateCardRow[],
    true,
  );

  let { data: cards, error: insertCardsError } = await supabase
    .from("cards")
    .insert(mappedCards)
    .select("id");

  if (
    insertCardsError &&
    getErrorMessage(insertCardsError).includes("example_pinyin")
  ) {
    const retryResult = await supabase
      .from("cards")
      .insert(
        mapTemplateCards(
          user.id,
          deck.id,
          templateCards as TemplateCardRow[],
          false,
        ),
      )
      .select("id");

    cards = retryResult.data;
    insertCardsError = retryResult.error;
  }

  if (insertCardsError || !cards) {
    console.error(insertCardsError);
    await supabase.from("decks").delete().eq("id", deck.id).eq("user_id", user.id);
    return NextResponse.json(
      { error: `Không thể copy thẻ mẫu: ${getErrorMessage(insertCardsError)}` },
      { status: 500 },
    );
  }

  const dueNow = new Date(Date.now() - 60_000).toISOString();
  const { error: reviewsError } = await supabase.from("reviews").insert(
    cards.map((card) => ({
      user_id: user.id,
      card_id: card.id,
      next_review_at: dueNow,
    })),
  );

  if (reviewsError) {
    console.error(reviewsError);
    await supabase.from("decks").delete().eq("id", deck.id).eq("user_id", user.id);
    return NextResponse.json(
      { error: `Không thể tạo lịch ôn cho thẻ mẫu: ${reviewsError.message}` },
      { status: 500 },
    );
  }

  let createdSentenceCards = 0;

  if (hasTemplateSentenceTable && templateSentenceCards?.length) {
    const { data: sentenceCards, error: insertSentenceCardsError } =
      await supabase
        .from("sentence_cards")
        .insert(
          (templateSentenceCards as TemplateSentenceCardRow[]).map((card) => ({
            user_id: user.id,
            deck_id: deck.id,
            sentence_cn: card.sentence_cn,
            sentence_pinyin: card.sentence_pinyin,
            sentence_vi: card.sentence_vi,
            vocab_json: card.vocab_json,
          })),
        )
        .select("id");

    if (insertSentenceCardsError || !sentenceCards) {
      console.error(insertSentenceCardsError);
      await supabase
        .from("decks")
        .delete()
        .eq("id", deck.id)
        .eq("user_id", user.id);
      return NextResponse.json(
        {
          error: `Không thể copy câu mẫu: ${getErrorMessage(
            insertSentenceCardsError,
          )}`,
        },
        { status: 500 },
      );
    }

    const { error: sentenceReviewsError } = await supabase
      .from("sentence_reviews")
      .insert(
        sentenceCards.map((card) => ({
          user_id: user.id,
          sentence_card_id: card.id,
          next_review_at: dueNow,
        })),
      );

    if (sentenceReviewsError) {
      console.error(sentenceReviewsError);
      await supabase
        .from("decks")
        .delete()
        .eq("id", deck.id)
        .eq("user_id", user.id);
      return NextResponse.json(
        {
          error: `Không thể tạo lịch ôn câu mẫu: ${sentenceReviewsError.message}`,
        },
        { status: 500 },
      );
    }

    createdSentenceCards = sentenceCards.length;
  }

  return NextResponse.json({
    success: true,
    deckId: deck.id,
    created: cards.length + createdSentenceCards,
  });
}
