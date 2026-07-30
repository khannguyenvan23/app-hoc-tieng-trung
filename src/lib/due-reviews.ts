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
  learnAheadCutoff?: string;
};

export async function fetchDueReviewRows<TRow>(
  supabase: SupabaseBrowserClient,
  source: DueReviewSource,
  options: DueReviewOptions,
): Promise<TRow[]> {
  // These queues can contain hundreds of rows. Avoid returning ownership and
  // other unused columns for every review/card, especially for large HSK
  // decks where the difference is several hundred kilobytes per page load.
  const reviewColumns =
    "id, next_review_at, interval_days, ease_factor, review_count, learning_step, first_reviewed_at, last_rating, weak_score, lapse_count, weak_since, updated_at";
  const cardColumns =
    source.cardsRelation === "cards"
      ? "id, deck_id, chinese, pinyin, meaning_vi, example_cn, example_pinyin, example_vi, word_audio_url, sentence_audio_url, created_at"
      : "id, deck_id, sentence_cn, sentence_pinyin, sentence_vi, vocab_json, sentence_audio_url, created_at";
  const columns = `${reviewColumns}, ${source.cardsRelation}!inner(${cardColumns})`;
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
  let learningAheadRows: unknown[] = [];

  if (
    options.learnAheadCutoff &&
    new Date(options.learnAheadCutoff).getTime() >
      new Date(options.dueCutoff).getTime()
  ) {
    const learningAhead = await withDeck(
      supabase
        .from(source.table)
        .select(columns)
        .gt("review_count", 0)
        .gte("learning_step", 0)
        .gt("next_review_at", options.dueCutoff)
        .lte("next_review_at", options.learnAheadCutoff),
    )
      .order("next_review_at", { ascending: true })
      .limit(LEARNED_LIMIT);

    if (!learningAhead.error) {
      learningAheadRows = learningAhead.data || [];
    }
  }

  // Learned cards first; buildStudyQueue re-sorts and caps the new ones.
  return [
    ...(learned.data || []),
    ...learningAheadRows,
    ...(fresh.data || []),
  ] as TRow[];
}
