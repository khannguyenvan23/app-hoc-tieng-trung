type ReviewLike = {
  id: string;
};

export function getStudySessionKey(
  kind: "word" | "sentence",
  deckId: string,
  weakOnly: boolean,
) {
  const scope = weakOnly ? "weak" : deckId || "all";
  return `hanzi-${kind}-study-current-review-id:${scope}`;
}

export function getStoredReviewIndex<TReview extends ReviewLike>(
  reviews: TReview[],
  storageKey: string,
  getItemId?: (review: TReview) => string | null | undefined,
) {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedReviewId = window.localStorage.getItem(storageKey);
  const storedItemId = window.localStorage.getItem(`${storageKey}:item`);
  const storedIndex = Number(window.localStorage.getItem(`${storageKey}:index`));

  if (storedReviewId) {
    const storedIndex = reviews.findIndex(
      (review) => review.id === storedReviewId,
    );

    if (storedIndex >= 0) {
      return storedIndex;
    }
  }

  if (storedItemId && getItemId) {
    const itemIndex = reviews.findIndex(
      (review) => getItemId(review) === storedItemId,
    );

    if (itemIndex >= 0) {
      return itemIndex;
    }
  }

  if (Number.isInteger(storedIndex) && storedIndex >= 0) {
    return Math.min(storedIndex, reviews.length - 1);
  }

  return 0;
}

export function saveStoredReviewId(
  storageKey: string,
  reviewId?: string,
  itemId?: string | null,
  index?: number,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (reviewId) {
    window.localStorage.setItem(storageKey, reviewId);
    if (itemId) {
      window.localStorage.setItem(`${storageKey}:item`, itemId);
    }
    if (typeof index === "number") {
      window.localStorage.setItem(`${storageKey}:index`, String(index));
    }
    return;
  }

  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(`${storageKey}:item`);
  window.localStorage.removeItem(`${storageKey}:index`);
}
