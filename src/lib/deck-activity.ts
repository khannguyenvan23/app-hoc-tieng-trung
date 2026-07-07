import type { Deck } from "@/lib/types";

type DeckActivityField = "last_card_added_at" | "last_sentence_added_at";

function toTime(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

export function sortDecksByRecentContent(
  decks: Deck[],
  activityField: DeckActivityField,
) {
  return [...decks].sort((left, right) => {
    const rightActivity = toTime(right[activityField] || right.created_at);
    const leftActivity = toTime(left[activityField] || left.created_at);

    if (rightActivity !== leftActivity) {
      return rightActivity - leftActivity;
    }

    return toTime(right.created_at) - toTime(left.created_at);
  });
}
