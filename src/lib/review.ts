import type { ReviewRating } from "@/lib/types";
import {
  addDays,
  addMinutes,
  defaultStudySettings,
  getFirstLearningStepMinutes,
  type StudySettings,
} from "@/lib/study-settings";

type ReviewState = {
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
};

function clampEase(easeFactor: number, settings: StudySettings) {
  return Math.max(
    settings.minimum_ease_factor,
    Number(easeFactor.toFixed(2)),
  );
}

function clampInterval(days: number, settings: StudySettings) {
  return Math.min(settings.maximum_interval_days, Math.max(1, days));
}

function getLearningInterval(
  rating: ReviewRating,
  currentEase: number,
  now: Date,
  settings: StudySettings,
) {
  if (rating === "again") {
    return {
      nextInterval: 0,
      nextEase: clampEase(currentEase - 0.2, settings),
      nextReviewAt: addMinutes(now, getFirstLearningStepMinutes(settings)),
    };
  }

  if (rating === "hard") {
    return {
      nextInterval: settings.graduating_interval_days,
      nextEase: clampEase(currentEase - 0.15, settings),
      nextReviewAt: addDays(now, settings.graduating_interval_days),
    };
  }

  if (rating === "good") {
    return {
      nextInterval: settings.graduating_interval_days,
      nextEase: clampEase(currentEase, settings),
      nextReviewAt: addDays(now, settings.graduating_interval_days),
    };
  }

  return {
    nextInterval: settings.easy_interval_days,
    nextEase: clampEase(currentEase + 0.15, settings),
    nextReviewAt: addDays(now, settings.easy_interval_days),
  };
}

export function getNextReview(
  rating: ReviewRating,
  state: ReviewState,
  now = new Date(),
  settings = defaultStudySettings,
) {
  const currentInterval = Number(state.interval_days || 0);
  const currentEase = Number(
    state.ease_factor || settings.starting_ease_factor,
  );
  let nextInterval = currentInterval;
  let nextEase = currentEase;
  let nextReviewAt = now;

  if (currentInterval <= 0) {
    const learningStep = getLearningInterval(
      rating,
      currentEase,
      now,
      settings,
    );
    nextInterval = learningStep.nextInterval;
    nextEase = learningStep.nextEase;
    nextReviewAt = learningStep.nextReviewAt;
  } else if (rating === "again") {
    nextEase = clampEase(currentEase - 0.25, settings);
    nextInterval = 0;
    nextReviewAt = addMinutes(now, settings.review_again_interval_minutes);
  } else if (rating === "hard") {
    nextEase = clampEase(currentEase - 0.15, settings);
    nextInterval = clampInterval(
      Math.round(currentInterval * settings.hard_interval_multiplier),
      settings,
    );
    nextReviewAt = addDays(now, nextInterval);
  } else if (rating === "good") {
    nextEase = clampEase(currentEase, settings);
    nextInterval = clampInterval(
      Math.round(currentInterval * currentEase),
      settings,
    );
    nextReviewAt = addDays(now, nextInterval);
  } else {
    nextEase = clampEase(currentEase + 0.15, settings);
    const goodInterval = clampInterval(
      Math.round(currentInterval * currentEase),
      settings,
    );
    nextInterval = clampInterval(
      Math.max(goodInterval + 1, Math.round(currentInterval * currentEase * 1.3)),
      settings,
    );
    nextReviewAt = addDays(now, nextInterval);
  }

  return {
    next_review_at: nextReviewAt.toISOString(),
    interval_days: nextInterval,
    ease_factor: nextEase,
  };
}
