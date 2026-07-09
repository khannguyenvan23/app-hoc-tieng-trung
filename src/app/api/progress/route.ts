import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TemplateDeckRow = {
  id: string;
  slug: string;
  name: string;
  level: string | null;
};

type UserDeckRow = {
  id: string;
  name: string;
  source_template_slug: string | null;
};

type UserCardRow = {
  id: string;
  deck_id: string;
  chinese: string;
};

type ReviewRow = {
  card_id: string;
  review_count: number | null;
};

const pageSize = 1000;

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function normalizeChinese(value: string | null | undefined) {
  return (value || "").trim();
}

function getHskNumber(template: TemplateDeckRow) {
  const source = `${template.level || ""} ${template.slug} ${template.name}`;
  const match = source.match(/hsk\s*([1-9])/i);

  return match ? Number(match[1]) : null;
}

function isHskTemplate(template: TemplateDeckRow) {
  return getHskNumber(template) !== null;
}

async function fetchUserCards(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  deckIds: string[],
) {
  const rows: UserCardRow[] = [];

  if (deckIds.length === 0) {
    return { data: rows, error: null };
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, deck_id, chinese")
      .eq("user_id", userId)
      .in("deck_id", deckIds)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    rows.push(...((data || []) as UserCardRow[]));

    if (!data || data.length < pageSize) {
      return { data: rows, error: null };
    }
  }
}

async function fetchLearnedReviewCardIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  cardIds: string[],
) {
  const learnedCardIds = new Set<string>();

  for (let index = 0; index < cardIds.length; index += pageSize) {
    const chunk = cardIds.slice(index, index + pageSize);

    const { data, error } = await supabase
      .from("reviews")
      .select("card_id, review_count")
      .eq("user_id", userId)
      .gt("review_count", 0)
      .in("card_id", chunk);

    if (error) {
      return { data: null, error };
    }

    ((data || []) as ReviewRow[]).forEach((review) => {
      if (review.card_id && Number(review.review_count || 0) > 0) {
        learnedCardIds.add(review.card_id);
      }
    });
  }

  return { data: learnedCardIds, error: null };
}

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: templateRows, error: templatesError } = await supabase
    .from("template_decks")
    .select("id, slug, name, level")
    .order("slug", { ascending: true });

  if (templatesError) {
    console.error(templatesError);
    return NextResponse.json(
      { error: "Không thể tải tiến độ HSK." },
      { status: 500 },
    );
  }

  const hskTemplates = ((templateRows || []) as TemplateDeckRow[])
    .filter(isHskTemplate)
    .sort((left, right) => {
      const leftNumber = getHskNumber(left) || 0;
      const rightNumber = getHskNumber(right) || 0;

      return leftNumber - rightNumber;
    });

  const totalBySlug = new Map<string, number>();

  for (const template of hskTemplates) {
    const { count, error } = await supabase
      .from("template_cards")
      .select("id", { count: "exact", head: true })
      .eq("template_deck_id", template.id);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Không thể đếm số từ HSK." },
        { status: 500 },
      );
    }

    totalBySlug.set(template.slug, count || 0);
  }

  const { data: deckRows, error: decksError } = await supabase
    .from("decks")
    .select("id, name, source_template_slug")
    .eq("user_id", user.id);

  if (decksError) {
    console.error(decksError);
    return NextResponse.json(
      { error: "Không thể tải bộ thẻ của bạn." },
      { status: 500 },
    );
  }

  const templateBySlug = new Map(
    hskTemplates.map((template) => [template.slug, template]),
  );
  const templateSlugByName = new Map(
    hskTemplates.map((template) => [normalizeText(template.name), template.slug]),
  );
  const slugByDeckId = new Map<string, string>();

  ((deckRows || []) as UserDeckRow[]).forEach((deck) => {
    const slugFromSource =
      deck.source_template_slug && templateBySlug.has(deck.source_template_slug)
        ? deck.source_template_slug
        : null;
    const slugFromName = templateSlugByName.get(normalizeText(deck.name));
    const hskSlug = slugFromSource || slugFromName;

    if (hskSlug) {
      slugByDeckId.set(deck.id, hskSlug);
    }
  });

  const deckIds = Array.from(slugByDeckId.keys());
  const { data: cardRows, error: cardsError } = await fetchUserCards(
    supabase,
    user.id,
    deckIds,
  );

  if (cardsError) {
    console.error(cardsError);
    return NextResponse.json(
      { error: "Không thể tải thẻ HSK của bạn." },
      { status: 500 },
    );
  }

  const cards = cardRows || [];
  const learnedResult = await fetchLearnedReviewCardIds(
    supabase,
    user.id,
    cards.map((card) => card.id),
  );

  if (learnedResult.error) {
    console.error(learnedResult.error);
    return NextResponse.json(
      { error: "Không thể tải lịch sử học HSK." },
      { status: 500 },
    );
  }

  const learnedCardIds = learnedResult.data || new Set<string>();
  const ownedWordsBySlug = new Map<string, Set<string>>();
  const learnedWordsBySlug = new Map<string, Set<string>>();

  hskTemplates.forEach((template) => {
    ownedWordsBySlug.set(template.slug, new Set());
    learnedWordsBySlug.set(template.slug, new Set());
  });

  cards.forEach((card) => {
    const slug = slugByDeckId.get(card.deck_id);
    const word = normalizeChinese(card.chinese);

    if (!slug || !word) {
      return;
    }

    ownedWordsBySlug.get(slug)?.add(word);

    if (learnedCardIds.has(card.id)) {
      learnedWordsBySlug.get(slug)?.add(word);
    }
  });

  const levels = hskTemplates.map((template) => {
    const totalCards = totalBySlug.get(template.slug) || 0;
    const copiedCards = ownedWordsBySlug.get(template.slug)?.size || 0;
    const learnedCards = learnedWordsBySlug.get(template.slug)?.size || 0;
    const percent =
      totalCards > 0 ? Math.min(100, Math.round((learnedCards / totalCards) * 100)) : 0;

    return {
      slug: template.slug,
      name: template.name,
      level: template.level || `HSK${getHskNumber(template) || ""}`,
      totalCards,
      copiedCards,
      learnedCards,
      percent,
    };
  });

  const totalLearned = levels.reduce(
    (sum, level) => sum + level.learnedCards,
    0,
  );
  const totalCards = levels.reduce((sum, level) => sum + level.totalCards, 0);
  const completedLevels = levels.filter(
    (level) => level.totalCards > 0 && level.learnedCards >= level.totalCards,
  ).length;

  return NextResponse.json({
    levels,
    totalLearned,
    totalCards,
    completedLevels,
  });
}
