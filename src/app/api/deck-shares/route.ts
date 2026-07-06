import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.string().uuid();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), deckId: z.string().uuid() }),
  z.object({ action: z.literal("disable"), deckId: z.string().uuid() }),
  z.object({ action: z.literal("copy"), token: z.string().uuid() }),
]);

type CreatedCard = { id: string };

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }

  return "Lỗi không xác định";
}

async function listActiveShares(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: shares, error } = await supabase
    .from("deck_shares")
    .select("id, token, deck_id, owner_id, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(9);

  if (error) {
    return NextResponse.json(
      { error: "Không thể tải các bộ thẻ được chia sẻ" },
      { status: 500 },
    );
  }

  const activeShares = shares || [];
  const summaries = await Promise.all(
    activeShares.map(async (share) => {
      const [deckResult, cardsResult, sentencesResult] = await Promise.all([
        supabase.from("decks").select("name").eq("id", share.deck_id).maybeSingle(),
        supabase
          .from("cards")
          .select("id", { count: "exact", head: true })
          .eq("deck_id", share.deck_id),
        supabase
          .from("sentence_cards")
          .select("id", { count: "exact", head: true })
          .eq("deck_id", share.deck_id),
      ]);

      if (!deckResult.data) {
        return null;
      }

      return {
        token: share.token,
        name: deckResult.data.name,
        cardCount: cardsResult.count || 0,
        sentenceCount: sentencesResult.count || 0,
        isOwner: share.owner_id === user.id,
        updatedAt: share.updated_at,
      };
    }),
  );

  return NextResponse.json(
    { shares: summaries.filter(Boolean) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");

  if (!token) {
    return listActiveShares(request);
  }

  const parsedToken = tokenSchema.safeParse(token);

  if (!parsedToken.success) {
    return NextResponse.json({ error: "Liên kết chia sẻ không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: share, error: shareError } = await supabase
    .from("deck_shares")
    .select("id, deck_id")
    .eq("token", parsedToken.data)
    .eq("is_active", true)
    .maybeSingle();

  if (shareError || !share) {
    return NextResponse.json(
      { error: "Liên kết đã bị tắt hoặc không còn tồn tại" },
      { status: 404 },
    );
  }

  const [deckResult, cardsResult, sentencesResult] = await Promise.all([
    supabase.from("decks").select("id, name").eq("id", share.deck_id).maybeSingle(),
    supabase
      .from("cards")
      .select("chinese, pinyin, meaning_vi", { count: "exact" })
      .eq("deck_id", share.deck_id)
      .order("created_at", { ascending: true })
      .limit(8),
    supabase
      .from("sentence_cards")
      .select("sentence_cn, sentence_pinyin, sentence_vi", { count: "exact" })
      .eq("deck_id", share.deck_id)
      .order("created_at", { ascending: true })
      .limit(5),
  ]);

  if (deckResult.error || !deckResult.data) {
    return NextResponse.json({ error: "Không tìm thấy bộ thẻ" }, { status: 404 });
  }

  return NextResponse.json(
    {
      deck: deckResult.data,
      cardCount: cardsResult.count || 0,
      sentenceCount: sentencesResult.count || 0,
      cards: cardsResult.data || [],
      sentences: sentencesResult.data || [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = actionSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (body.data.action === "create") {
    const { data: deck } = await supabase
      .from("decks")
      .select("id")
      .eq("id", body.data.deckId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!deck) {
      return NextResponse.json({ error: "Không tìm thấy bộ thẻ" }, { status: 404 });
    }

    const { data: share, error } = await supabase
      .from("deck_shares")
      .upsert(
        {
          deck_id: deck.id,
          owner_id: user.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deck_id" },
      )
      .select("token")
      .single();

    if (error || !share) {
      return NextResponse.json(
        { error: `Không thể tạo liên kết chia sẻ: ${getErrorMessage(error)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, token: share.token });
  }

  if (body.data.action === "disable") {
    const { error } = await supabase
      .from("deck_shares")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("deck_id", body.data.deckId)
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Không thể tắt liên kết" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { data: share } = await supabase
    .from("deck_shares")
    .select("id, deck_id, owner_id")
    .eq("token", body.data.token)
    .eq("is_active", true)
    .maybeSingle();

  if (!share) {
    return NextResponse.json(
      { error: "Liên kết đã bị tắt hoặc không còn tồn tại" },
      { status: 404 },
    );
  }

  if (share.owner_id === user.id) {
    return NextResponse.json({ error: "Đây là bộ thẻ của bạn" }, { status: 409 });
  }

  const { data: existingDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id)
    .eq("source_share_id", share.id)
    .maybeSingle();

  if (existingDeck) {
    return NextResponse.json(
      { error: "Bạn đã thêm bộ thẻ này", deckId: existingDeck.id },
      { status: 409 },
    );
  }

  const [sourceDeckResult, cardsResult, sentencesResult] = await Promise.all([
    supabase.from("decks").select("name").eq("id", share.deck_id).single(),
    supabase.from("cards").select("*").eq("deck_id", share.deck_id),
    supabase.from("sentence_cards").select("*").eq("deck_id", share.deck_id),
  ]);

  if (sourceDeckResult.error || !sourceDeckResult.data) {
    return NextResponse.json({ error: "Không tìm thấy bộ thẻ nguồn" }, { status: 404 });
  }

  const { data: copiedDeck, error: deckError } = await supabase
    .from("decks")
    .insert({
      user_id: user.id,
      name: sourceDeckResult.data.name,
      source_share_id: share.id,
    })
    .select("id")
    .single();

  if (deckError || !copiedDeck) {
    return NextResponse.json(
      { error: `Không thể tạo bản sao: ${getErrorMessage(deckError)}` },
      { status: 500 },
    );
  }

  try {
    const sourceCards = cardsResult.data || [];
    const sourceSentences = sentencesResult.data || [];
    let copiedCards: CreatedCard[] = [];
    let copiedSentences: CreatedCard[] = [];

    if (sourceCards.length > 0) {
      const result = await supabase
        .from("cards")
        .insert(
          sourceCards.map((card) => ({
            user_id: user.id,
            deck_id: copiedDeck.id,
            chinese: card.chinese,
            pinyin: card.pinyin,
            meaning_vi: card.meaning_vi,
            example_cn: card.example_cn,
            example_pinyin: card.example_pinyin,
            example_vi: card.example_vi,
            word_audio_url: card.word_audio_url,
            sentence_audio_url: card.sentence_audio_url,
          })),
        )
        .select("id");

      if (result.error) {
        throw result.error;
      }

      copiedCards = (result.data || []) as CreatedCard[];
    }

    if (sourceSentences.length > 0) {
      const result = await supabase
        .from("sentence_cards")
        .insert(
          sourceSentences.map((sentence) => ({
            user_id: user.id,
            deck_id: copiedDeck.id,
            sentence_cn: sentence.sentence_cn,
            sentence_pinyin: sentence.sentence_pinyin,
            sentence_vi: sentence.sentence_vi,
            vocab_json: sentence.vocab_json,
            sentence_audio_url: sentence.sentence_audio_url,
          })),
        )
        .select("id");

      if (result.error) {
        throw result.error;
      }

      copiedSentences = (result.data || []) as CreatedCard[];
    }

    const dueNow = new Date(Date.now() - 60_000).toISOString();

    if (copiedCards.length > 0) {
      const { error } = await supabase.from("reviews").insert(
        copiedCards.map((card) => ({
          user_id: user.id,
          card_id: card.id,
          next_review_at: dueNow,
        })),
      );
      if (error) throw error;
    }

    if (copiedSentences.length > 0) {
      const { error } = await supabase.from("sentence_reviews").insert(
        copiedSentences.map((sentence) => ({
          user_id: user.id,
          sentence_card_id: sentence.id,
          next_review_at: dueNow,
        })),
      );
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      deckId: copiedDeck.id,
      copiedCards: copiedCards.length,
      copiedSentences: copiedSentences.length,
    });
  } catch (error) {
    console.error(error);
    await supabase.from("decks").delete().eq("id", copiedDeck.id).eq("user_id", user.id);
    return NextResponse.json(
      { error: `Không thể sao chép bộ thẻ: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
