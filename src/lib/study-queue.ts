import type { StudySettings } from "./study-settings";

export type StudyQueueReview = {
  review_count: number | null;
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

export function isDueForStudy(nextReviewAt: string, now = new Date()) {
  return new Date(nextReviewAt).getTime() <= now.getTime() + 60_000;
}

export function getNextStudyQueueIndex<TReview extends StudyQueueReview>(
  reviews: TReview[],
  preferredIndex = 0,
  now = new Date(),
) {
  if (reviews.length === 0) {
    return -1;
  }

  const startIndex = Math.min(Math.max(preferredIndex, 0), reviews.length - 1);

  for (let offset = 0; offset < reviews.length; offset += 1) {
    const index = (startIndex + offset) % reviews.length;

    if (isDueForStudy(reviews[index].next_review_at, now)) {
      return index;
    }
  }

  return -1;
}

export function getNextPendingStudyAt<TReview extends StudyQueueReview>(
  reviews: TReview[],
  now = new Date(),
) {
  const nowWithGrace = now.getTime() + 60_000;
  const nextTime = reviews.reduce<number | null>((earliest, review) => {
    const reviewTime = new Date(review.next_review_at).getTime();

    if (!Number.isFinite(reviewTime) || reviewTime <= nowWithGrace) {
      return earliest;
    }

    return earliest === null ? reviewTime : Math.min(earliest, reviewTime);
  }, null);

  return nextTime === null ? null : new Date(nextTime).toISOString();
}
