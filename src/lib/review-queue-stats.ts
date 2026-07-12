import type { ReviewRating } from "@/lib/types";

type ReviewQueueItem = {
  interval_days: number | null;
  last_rating: ReviewRating | null;
  review_count: number | null;
};

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

      if (
        Number(review.interval_days || 0) <= 0 ||
        review.last_rating === "again"
      ) {
        stats.learning += 1;
        return stats;
      }

      stats.review += 1;
      return stats;
    },
    { learning: 0, new: 0, review: 0 },
  );
}
