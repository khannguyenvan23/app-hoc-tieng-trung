type ReviewLike = {
  id: string;
};

type StoredReviewQueue<TReview> = {
  savedAt: number;
  reviews: TReview[];
};

type StoredStudyProgress = {
  answered: number;
  savedAt: number;
  total: number;
};

const maxStoredQueueAgeMs = 12 * 60 * 60 * 1000;

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

export function restoreStoredReviewQueue<TReview extends ReviewLike>(
  reviews: TReview[],
  storageKey: string,
  getItemId?: (review: TReview) => string | null | undefined,
  shouldKeepStoredReview?: (review: TReview) => boolean,
) {
  if (typeof window === "undefined") {
    return reviews;
  }

  const storedValue = window.localStorage.getItem(`${storageKey}:queue`);

  if (!storedValue) {
    return reviews;
  }

  try {
    const storedQueue = JSON.parse(storedValue) as StoredReviewQueue<TReview>;

    if (
      !storedQueue ||
      !Array.isArray(storedQueue.reviews) ||
      Date.now() - Number(storedQueue.savedAt || 0) > maxStoredQueueAgeMs
    ) {
      window.localStorage.removeItem(`${storageKey}:queue`);
      return reviews;
    }

    const storedReviews = shouldKeepStoredReview
      ? storedQueue.reviews.filter(shouldKeepStoredReview)
      : storedQueue.reviews;

    const storedReviewIds = new Set(
      storedReviews.map((review) => review.id),
    );
    const storedItemIds = new Set(
      getItemId
        ? storedReviews
            .map((review) => getItemId(review))
            .filter(Boolean)
        : [],
    );
    const freshReviews = reviews.filter((review) => {
      if (storedReviewIds.has(review.id)) {
        return false;
      }

      const itemId = getItemId?.(review);
      return !itemId || !storedItemIds.has(itemId);
    });

    if (storedReviews.length !== storedQueue.reviews.length) {
      saveStoredReviewQueue(storageKey, storedReviews);
    }

    return [...storedReviews, ...freshReviews];
  } catch {
    window.localStorage.removeItem(`${storageKey}:queue`);
    return reviews;
  }
}

export function saveStoredReviewQueue<TReview extends ReviewLike>(
  storageKey: string,
  reviews: TReview[],
) {
  if (typeof window === "undefined") {
    return;
  }

  if (reviews.length === 0) {
    window.localStorage.removeItem(`${storageKey}:queue`);
    return;
  }

  window.localStorage.setItem(
    `${storageKey}:queue`,
    JSON.stringify({ savedAt: Date.now(), reviews }),
  );
}

export function getStoredStudyProgress(storageKey: string, queueLength: number) {
  const fallbackTotal = Math.max(0, queueLength);

  if (typeof window === "undefined") {
    return { answered: 0, total: fallbackTotal };
  }

  const storedValue = window.localStorage.getItem(`${storageKey}:progress`);

  if (!storedValue) {
    return { answered: 0, total: fallbackTotal };
  }

  try {
    const storedProgress = JSON.parse(storedValue) as StoredStudyProgress;

    if (
      !storedProgress ||
      Date.now() - Number(storedProgress.savedAt || 0) > maxStoredQueueAgeMs
    ) {
      window.localStorage.removeItem(`${storageKey}:progress`);
      return { answered: 0, total: fallbackTotal };
    }

    const total = Math.max(
      fallbackTotal,
      Number.isFinite(storedProgress.total) ? storedProgress.total : 0,
    );
    const answered = Math.min(
      Math.max(
        0,
        Number.isFinite(storedProgress.answered)
          ? storedProgress.answered
          : 0,
      ),
      total,
    );

    return { answered, total };
  } catch {
    window.localStorage.removeItem(`${storageKey}:progress`);
    return { answered: 0, total: fallbackTotal };
  }
}

export function saveStoredStudyProgress(
  storageKey: string,
  total?: number,
  answered?: number,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof total !== "number" || total <= 0) {
    window.localStorage.removeItem(`${storageKey}:progress`);
    return;
  }

  window.localStorage.setItem(
    `${storageKey}:progress`,
    JSON.stringify({
      answered: Math.min(Math.max(0, answered ?? 0), total),
      savedAt: Date.now(),
      total,
    }),
  );
}
