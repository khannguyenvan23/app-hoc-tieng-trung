import type { ReviewRating } from "@/lib/types";

type ReviewState = {
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
};

const minEaseFactor = 1.3;
const defaultEaseFactor = 2.5;

function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function clampEase(easeFactor: number) {
  return Math.max(minEaseFactor, Number(easeFactor.toFixed(2)));
}

export function getNextReview(
  rating: ReviewRating,
  state: ReviewState,
  now = new Date(),
) {
  const currentReviewCount = Number(state.review_count || 0);
  const currentInterval = Number(state.interval_days || 0);
  const currentEase = Number(state.ease_factor || defaultEaseFactor);
  let nextInterval = currentInterval;
  let nextEase = currentEase;
  let nextReviewAt = now;

  if (rating === "again") {
    nextEase = clampEase(currentEase - 0.2);
    nextInterval = 0;
    nextReviewAt = addMinutes(now, 10);
  } else if (rating === "hard") {
    nextEase = clampEase(currentEase - 0.15);
    nextInterval = Math.max(1, Math.ceil(currentInterval * 1.2));
    nextReviewAt = addDays(now, nextInterval);
  } else if (rating === "good") {
    if (currentReviewCount === 0) {
      nextInterval = 1;
    } else if (currentReviewCount === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.max(1, Math.round(currentInterval * currentEase));
    }

    nextEase = clampEase(currentEase);
    nextReviewAt = addDays(now, nextInterval);
  } else {
    if (currentReviewCount === 0) {
      nextInterval = 4;
    } else if (currentReviewCount === 1) {
      nextInterval = 8;
    } else {
      nextInterval = Math.max(2, Math.round(currentInterval * currentEase * 1.3));
    }

    nextEase = clampEase(currentEase + 0.15);
    nextReviewAt = addDays(now, nextInterval);
  }

  return {
    next_review_at: nextReviewAt.toISOString(),
    interval_days: nextInterval,
    ease_factor: nextEase,
  };
}
