export type Deck = {
  id: string;
  user_id: string;
  name: string;
  source_template_slug?: string | null;
  created_at: string;
};

export type TemplateDeck = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  level: string | null;
  card_count: number;
  already_added?: boolean;
  user_deck_id?: string | null;
  created_at: string;
};

export type Card = {
  id: string;
  user_id: string;
  deck_id: string;
  chinese: string;
  pinyin: string | null;
  meaning_vi: string | null;
  example_cn: string | null;
  example_pinyin: string | null;
  example_vi: string | null;
  word_audio_url: string | null;
  sentence_audio_url: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  user_id: string;
  card_id: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  last_rating: ReviewRating | null;
  weak_score?: number | null;
  lapse_count?: number | null;
  weak_since?: string | null;
  updated_at: string;
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type GeneratedCard = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
};

export type DueReview = Review & {
  cards: Card | null;
};

export type SentenceVocabItem = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
};

export type SentenceCard = {
  id: string;
  user_id: string;
  deck_id: string;
  sentence_cn: string;
  sentence_pinyin: string | null;
  sentence_vi: string | null;
  vocab_json: SentenceVocabItem[] | null;
  sentence_audio_url: string | null;
  created_at: string;
};

export type SentenceReview = {
  id: string;
  user_id: string;
  sentence_card_id: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  last_rating: ReviewRating | null;
  weak_score?: number | null;
  lapse_count?: number | null;
  weak_since?: string | null;
  updated_at: string;
};

export type GeneratedSentenceCard = {
  sentence_cn: string;
  sentence_pinyin: string;
  sentence_vi: string;
  vocab_items: SentenceVocabItem[];
};

export type DueSentenceReview = SentenceReview & {
  sentence_cards: SentenceCard | null;
};
