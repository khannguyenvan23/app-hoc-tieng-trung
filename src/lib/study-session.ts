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
) {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedReviewId = window.localStorage.getItem(storageKey);

  if (!storedReviewId) {
    return 0;
  }

  const storedIndex = reviews.findIndex((review) => review.id === storedReviewId);
  return storedIndex >= 0 ? storedIndex : 0;
}

export function saveStoredReviewId(storageKey: string, reviewId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (reviewId) {
    window.localStorage.setItem(storageKey, reviewId);
    return;
  }

  window.localStorage.removeItem(storageKey);
}

