import type { ReviewRating } from "@/lib/types";

type ReviewQueueItem = {
  interval_days: number | null;
  last_rating: ReviewRating | null;
  review_count: number | null;
  learning_step?: number | null;
};

function isInLearningPhase(review: ReviewQueueItem) {
  // When learning_step is tracked, it is the source of truth: >= 0 means the
  // card is stepping through learning or relearning. Fall back to the old
  // heuristic for rows saved before the column existed.
  if (review.learning_step !== null && review.learning_step !== undefined) {
    return Number(review.learning_step) >= 0;
  }

  return (
    Number(review.interval_days || 0) <= 0 || review.last_rating === "again"
  );
}

export type ReviewQueueStats = {
  learning: number;
  new: number;
  review: number;
};

export function getReviewQueueStats(
  reviews: ReviewQueueItem[],
): ReviewQueueStats {
  return reviews.reduce<ReviewQueueStats>(
    (stats, review) => {
      if (Number(review.review_count || 0) === 0) {
        stats.new += 1;
        return stats;
      }

      if (isInLearningPhase(review)) {
        stats.learning += 1;
        return stats;
      }

      stats.review += 1;
      return stats;
    },
    { learning: 0, new: 0, review: 0 },
  );
}
