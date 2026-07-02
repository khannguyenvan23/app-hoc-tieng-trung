import type { ReviewRating } from "@/lib/types";

type ReviewState = {
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
};

const minEaseFactor = 1.3;
const defaultEaseFactor = 2.5;
const maxIntervalDays = 365;

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

function clampInterval(days: number) {
  return Math.min(maxIntervalDays, Math.max(1, days));
}

function getLearningInterval(
  rating: ReviewRating,
  currentEase: number,
  now: Date,
) {
  if (rating === "again") {
    return {
      nextInterval: 0,
      nextEase: clampEase(currentEase - 0.2),
      nextReviewAt: addMinutes(now, 10),
    };
  }

  if (rating === "hard") {
    return {
      nextInterval: 1,
      nextEase: clampEase(currentEase - 0.15),
      nextReviewAt: addDays(now, 1),
    };
  }

  if (rating === "good") {
    return {
      nextInterval: 1,
      nextEase: clampEase(currentEase),
      nextReviewAt: addDays(now, 1),
    };
  }

  return {
    nextInterval: 4,
    nextEase: clampEase(currentEase + 0.15),
    nextReviewAt: addDays(now, 4),
  };
}

export function getNextReview(
  rating: ReviewRating,
  state: ReviewState,
  now = new Date(),
) {
  const currentInterval = Number(state.interval_days || 0);
  const currentEase = Number(state.ease_factor || defaultEaseFactor);
  let nextInterval = currentInterval;
  let nextEase = currentEase;
  let nextReviewAt = now;

  if (currentInterval <= 0) {
    const learningStep = getLearningInterval(rating, currentEase, now);
    nextInterval = learningStep.nextInterval;
    nextEase = learningStep.nextEase;
    nextReviewAt = learningStep.nextReviewAt;
  } else if (rating === "again") {
    nextEase = clampEase(currentEase - 0.25);
    nextInterval = 0;
    nextReviewAt = addMinutes(now, 10);
  } else if (rating === "hard") {
    nextEase = clampEase(currentEase - 0.15);
    nextInterval = clampInterval(Math.round(currentInterval * 1.2));
    nextReviewAt = addDays(now, nextInterval);
  } else if (rating === "good") {
    nextEase = clampEase(currentEase);
    nextInterval = clampInterval(Math.round(currentInterval * currentEase));
    nextReviewAt = addDays(now, nextInterval);
  } else {
    nextEase = clampEase(currentEase + 0.15);
    const goodInterval = clampInterval(Math.round(currentInterval * currentEase));
    nextInterval = clampInterval(Math.max(
      goodInterval + 1,
      Math.round(currentInterval * currentEase * 1.3),
    ));
    nextReviewAt = addDays(now, nextInterval);
  }

  return {
    next_review_at: nextReviewAt.toISOString(),
    interval_days: nextInterval,
    ease_factor: nextEase,
  };
}
