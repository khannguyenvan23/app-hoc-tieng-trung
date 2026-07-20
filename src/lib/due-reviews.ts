import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

// A single "due cards ordered by next_review_at, limit N" query starves real
// reviews: a brand new row carries its creation time in next_review_at, so a
// deck holding hundreds of old never-studied cards pushes every due review out
// of the row limit. Fetch the two groups separately instead — cards already in
// learning/review can never be crowded out by new ones.
const LEARNED_LIMIT = 500;
const NEW_LIMIT = 200;

type DueReviewSource = {
  table: "reviews" | "sentence_reviews";
  cardsRelation: "cards" | "sentence_cards";
};

type DueReviewOptions = {
  deckId: string | null; // null => every deck
  weakOnly: boolean;
  dueCutoff: string;
};

export async function fetchDueReviewRows<TRow>(
  supabase: SupabaseBrowserClient,
  source: DueReviewSource,
  options: DueReviewOptions,
): Promise<TRow[]> {
  const columns = `*, ${source.cardsRelation}!inner(*)`;
  const deckColumn = `${source.cardsRelation}.deck_id`;

  const withDeck = <TQuery extends { eq: (column: string, value: string) => TQuery }>(
    query: TQuery,
  ) => (options.deckId ? query.eq(deckColumn, options.deckId) : query);

  if (options.weakOnly) {
    const { data } = await withDeck(
      supabase.from(source.table).select(columns).gte("weak_score", 2),
    )
      .order("weak_score", { ascending: false })
      .order("next_review_at", { ascending: true })
      .limit(NEW_LIMIT);

    return (data || []) as TRow[];
  }

  const learnedQuery = withDeck(
    supabase
      .from(source.table)
      .select(columns)
      .gt("review_count", 0)
      .lte("next_review_at", options.dueCutoff),
  )
    .order("next_review_at", { ascending: true })
    .limit(LEARNED_LIMIT);

  const newQuery = withDeck(
    supabase
      .from(source.table)
      .select(columns)
      .eq("review_count", 0)
      .lte("next_review_at", options.dueCutoff),
  )
    .order("next_review_at", { ascending: true })
    .limit(NEW_LIMIT);

  const [learned, fresh] = await Promise.all([learnedQuery, newQuery]);

  // Learned cards first; buildStudyQueue re-sorts and caps the new ones.
  return [...(learned.data || []), ...(fresh.data || [])] as TRow[];
}
