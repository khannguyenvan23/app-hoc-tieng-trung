import type { StudySettings } from "./study-settings";

export type StudyQueueReview = {
  review_count: number | null;
  interval_days?: number | null;
  learning_step?: number | null;
  next_review_at: string;
};

function shuffleStudyQueue<TReview>(reviews: TReview[]) {
  const nextReviews = [...reviews];

  for (let index = nextReviews.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextReviews[index], nextReviews[swapIndex]] = [
      nextReviews[swapIndex],
      nextReviews[index],
    ];
  }

  return nextReviews;
}

export function buildStudyQueue<TReview extends StudyQueueReview>(
  reviews: TReview[],
  remainingNewItems: number,
  settings: StudySettings,
  getCreatedAt: (review: TReview) => string | null | undefined,
) {
  const reviewItems = reviews.filter((review) => Number(review.review_count) > 0);
  const newItemCandidates = reviews
    .filter((review) => Number(review.review_count) === 0)
    .sort(
      (left, right) =>
        new Date(getCreatedAt(left) || left.next_review_at).getTime() -
        new Date(getCreatedAt(right) || right.next_review_at).getTime(),
    );
  const newItems =
    settings.insertion_order === "random"
      ? shuffleStudyQueue(newItemCandidates).slice(0, remainingNewItems)
      : newItemCandidates.slice(0, remainingNewItems);

  return [...reviewItems, ...newItems].sort(
    (left, right) =>
      new Date(left.next_review_at).getTime() -
      new Date(right.next_review_at).getTime(),
  );
}

export function countWaitingNewItems<TReview extends StudyQueueReview>(
  reviews: TReview[],
  remainingNewItems: number,
) {
  const newItemCount = reviews.filter(
    (review) => Number(review.review_count) === 0,
  ).length;

  return Math.max(0, newItemCount - remainingNewItems);
}

export function shouldRequeueInCurrentSession(
  nextReviewAt: string,
  now = new Date(),
) {
  const minutesUntilDue = Math.round(
    (new Date(nextReviewAt).getTime() - now.getTime()) / 60_000,
  );

  return minutesUntilDue < 23 * 60;
}

// Keep the grace well below the shortest supported learning step. A one-minute
// grace made a "1m" card immediately due, silently defeating the setting.
const DEFAULT_DUE_GRACE_MS = 2_000;

export function isDueForStudy(
  nextReviewAt: string,
  now = new Date(),
  graceMs = DEFAULT_DUE_GRACE_MS,
) {
  return new Date(nextReviewAt).getTime() <= now.getTime() + graceMs;
}

export function isLearningOrRelearning<TReview extends StudyQueueReview>(
  review: TReview,
) {
  if (Number(review.review_count || 0) <= 0) {
    return false;
  }

  if (review.learning_step !== null && review.learning_step !== undefined) {
    return Number(review.learning_step) >= 0;
  }

  return Number(review.interval_days || 0) <= 0;
}

export function isAvailableForStudy<TReview extends StudyQueueReview>(
  review: TReview,
  now = new Date(),
  learnAheadLimitMinutes = 0,
  graceMs = DEFAULT_DUE_GRACE_MS,
) {
  if (isDueForStudy(review.next_review_at, now, graceMs)) {
    return true;
  }

  if (
    learnAheadLimitMinutes <= 0 ||
    !isLearningOrRelearning(review)
  ) {
    return false;
  }

  return (
    new Date(review.next_review_at).getTime() <=
    now.getTime() + learnAheadLimitMinutes * 60_000
  );
}

export function getNextDueLearningQueueIndex<
  TReview extends StudyQueueReview,
>(
  reviews: TReview[],
  preferredIndex = 0,
  now = new Date(),
  graceMs = DEFAULT_DUE_GRACE_MS,
) {
  if (reviews.length === 0) {
    return -1;
  }

  const startIndex = Math.min(Math.max(preferredIndex, 0), reviews.length - 1);
  let bestLearningIndex = -1;
  let bestLearningTime = Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < reviews.length; offset += 1) {
    const index = (startIndex + offset) % reviews.length;
    const review = reviews[index];

    if (
      !isLearningOrRelearning(review) ||
      !isDueForStudy(review.next_review_at, now, graceMs)
    ) {
      continue;
    }

    const dueTime = new Date(review.next_review_at).getTime();
    if (dueTime < bestLearningTime) {
      bestLearningTime = dueTime;
      bestLearningIndex = index;
    }
  }

  return bestLearningIndex;
}

export function getNextPendingLearningAt<TReview extends StudyQueueReview>(
  reviews: TReview[],
  now = new Date(),
  graceMs = DEFAULT_DUE_GRACE_MS,
) {
  const nowWithGrace = now.getTime() + graceMs;
  const nextTime = reviews.reduce<number | null>((earliest, review) => {
    if (!isLearningOrRelearning(review)) {
      return earliest;
    }

    const reviewTime = new Date(review.next_review_at).getTime();
    if (!Number.isFinite(reviewTime) || reviewTime <= nowWithGrace) {
      return earliest;
    }

    return earliest === null ? reviewTime : Math.min(earliest, reviewTime);
  }, null);

  return nextTime === null ? null : new Date(nextTime).toISOString();
}

export function getNextStudyQueueIndex<TReview extends StudyQueueReview>(
  reviews: TReview[],
  preferredIndex = 0,
  now = new Date(),
  graceMs = DEFAULT_DUE_GRACE_MS,
  learnAheadLimitMinutes = 0,
) {
  if (reviews.length === 0) {
    return -1;
  }

  const startIndex = Math.min(Math.max(preferredIndex, 0), reviews.length - 1);

  // Among the cards that are actually due, surface a learning/relearning card
  // first — and the one whose short step elapsed longest ago — so a just-lapsed
  // "Quên 1 phút" card comes back promptly instead of waiting at the very back
  // behind every new card. New/review cards fall back to plain scan order.
  let firstDueIndex = -1;
  let bestLearningIndex = -1;
  let bestLearningTime = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < reviews.length; offset += 1) {
    const index = (startIndex + offset) % reviews.length;
    const review = reviews[index];

    if (!isDueForStudy(review.next_review_at, now, graceMs)) {
      continue;
    }

    if (firstDueIndex < 0) {
      firstDueIndex = index;
    }

    if (isLearningOrRelearning(review)) {
      const dueTime = new Date(review.next_review_at).getTime();
      if (dueTime < bestLearningTime) {
        bestLearningTime = dueTime;
        bestLearningIndex = index;
      }
    }
  }

  if (bestLearningIndex >= 0) {
    return bestLearningIndex;
  }

  if (firstDueIndex >= 0) {
    return firstDueIndex;
  }

  if (learnAheadLimitMinutes > 0) {
    for (let offset = 0; offset < reviews.length; offset += 1) {
      const index = (startIndex + offset) % reviews.length;

      if (
        isAvailableForStudy(
          reviews[index],
          now,
          learnAheadLimitMinutes,
          graceMs,
        )
      ) {
        return index;
      }
    }
  }

  return -1;
}

export function getNextPendingStudyAt<TReview extends StudyQueueReview>(
  reviews: TReview[],
  now = new Date(),
  graceMs = DEFAULT_DUE_GRACE_MS,
) {
  const nowWithGrace = now.getTime() + graceMs;
  const nextTime = reviews.reduce<number | null>((earliest, review) => {
    const reviewTime = new Date(review.next_review_at).getTime();

    if (!Number.isFinite(reviewTime) || reviewTime <= nowWithGrace) {
      return earliest;
    }

    return earliest === null ? reviewTime : Math.min(earliest, reviewTime);
  }, null);

  return nextTime === null ? null : new Date(nextTime).toISOString();
}
