import type { ReviewRating } from "./types";
import {
  addDays,
  addMinutes,
  defaultStudySettings,
  parseLearningSteps,
  type StudySettings,
} from "./study-settings";

// learning_step semantics:
//   >= 0  => card is stepping through learning (interval_days === 0) or
//            relearning (interval_days > 0, holds the interval to restore).
//   -1 / null => graduated review card, scheduled by interval.
const REVIEW_PHASE = -1;

type ReviewState = {
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
  learning_step?: number | null;
};

export type NextReview = {
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  learning_step: number;
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

function applyIntervalModifier(days: number, settings: StudySettings) {
  return Math.round(days * settings.interval_modifier);
}

function resolveSteps(raw: string, fallback: string) {
  const steps = parseLearningSteps(raw);

  if (steps.length > 0) {
    return steps;
  }

  const fallbackSteps = parseLearningSteps(fallback);
  return fallbackSteps.length > 0 ? fallbackSteps : [10];
}

function graduate(
  isRelearning: boolean,
  pendingInterval: number,
  currentEase: number,
  isEasy: boolean,
  now: Date,
  settings: StudySettings,
): NextReview {
  let interval: number;

  if (isRelearning) {
    // Restore the interval that was computed when the card lapsed. Easy adds
    // the easy bonus on top so it stays ahead of Good.
    interval = isEasy
      ? clampInterval(
          Math.max(
            pendingInterval + 1,
            applyIntervalModifier(pendingInterval * settings.easy_bonus, settings),
          ),
          settings,
        )
      : clampInterval(pendingInterval, settings);
  } else {
    interval = clampInterval(
      isEasy ? settings.easy_interval_days : settings.graduating_interval_days,
      settings,
    );
  }

  return {
    next_review_at: addDays(now, interval).toISOString(),
    interval_days: interval,
    // Anki does not change ease while a card is still in (re)learning.
    ease_factor: clampEase(currentEase, settings),
    learning_step: REVIEW_PHASE,
  };
}

function scheduleLearning(
  rating: ReviewRating,
  ctx: {
    currentInterval: number;
    currentEase: number;
    currentStep: number;
    steps: number[];
    isRelearning: boolean;
  },
  now: Date,
  settings: StudySettings,
): NextReview {
  const { currentInterval, currentEase, currentStep, steps, isRelearning } = ctx;
  const lastIndex = steps.length - 1;
  // interval_days carries 0 while learning and the pending restore interval
  // while relearning. Ease stays put until the card graduates.
  const heldInterval = isRelearning ? currentInterval : 0;
  const heldEase = clampEase(currentEase, settings);

  const stepResult = (stepIndex: number, minutes: number): NextReview => ({
    next_review_at: addMinutes(now, minutes).toISOString(),
    interval_days: heldInterval,
    ease_factor: heldEase,
    learning_step: stepIndex,
  });

  if (rating === "again") {
    return stepResult(0, steps[0]);
  }

  if (rating === "hard") {
    // Hard stays on the current step but nudges the delay so it sits between
    // Again and Good, the way Anki does: the average of the current and next
    // step, or 1.5x the step when there is no next step.
    const hardMinutes =
      currentStep < lastIndex
        ? Math.round((steps[currentStep] + steps[currentStep + 1]) / 2)
        : Math.round(steps[currentStep] * 1.5);
    return stepResult(currentStep, hardMinutes);
  }

  if (rating === "good") {
    if (currentStep >= lastIndex) {
      return graduate(isRelearning, currentInterval, currentEase, false, now, settings);
    }

    const nextStep = currentStep + 1;
    return stepResult(nextStep, steps[nextStep]);
  }

  // easy graduates straight out of the (re)learning steps.
  return graduate(isRelearning, currentInterval, currentEase, true, now, settings);
}

function scheduleReview(
  rating: ReviewRating,
  ctx: { currentInterval: number; currentEase: number },
  now: Date,
  settings: StudySettings,
): NextReview {
  const { currentInterval, currentEase } = ctx;

  if (rating === "again") {
    // Lapse: drop ease, compute the interval to restore after relearning, and
    // send the card back through the relearning steps.
    const nextEase = clampEase(currentEase - 0.2, settings);
    const lapseInterval = clampInterval(
      Math.max(
        settings.minimum_lapse_interval_days,
        Math.round(currentInterval * (settings.new_interval_percentage / 100)),
      ),
      settings,
    );
    const relearningSteps = resolveSteps(
      settings.relearning_steps,
      defaultStudySettings.relearning_steps,
    );

    return {
      next_review_at: addMinutes(now, relearningSteps[0]).toISOString(),
      interval_days: lapseInterval,
      ease_factor: nextEase,
      learning_step: 0,
    };
  }

  const reviewResult = (interval: number, ease: number): NextReview => ({
    next_review_at: addDays(now, interval).toISOString(),
    interval_days: interval,
    ease_factor: ease,
    learning_step: REVIEW_PHASE,
  });

  const hardInterval = clampInterval(
    Math.max(
      currentInterval + 1,
      applyIntervalModifier(currentInterval * settings.hard_interval_multiplier, settings),
    ),
    settings,
  );

  if (rating === "hard") {
    return reviewResult(hardInterval, clampEase(currentEase - 0.15, settings));
  }

  const goodInterval = clampInterval(
    Math.max(
      hardInterval + 1,
      applyIntervalModifier(currentInterval * currentEase, settings),
    ),
    settings,
  );

  if (rating === "good") {
    return reviewResult(goodInterval, clampEase(currentEase, settings));
  }

  const easyInterval = clampInterval(
    Math.max(
      goodInterval + 1,
      applyIntervalModifier(currentInterval * currentEase * settings.easy_bonus, settings),
    ),
    settings,
  );

  return reviewResult(easyInterval, clampEase(currentEase + 0.15, settings));
}

export function getNextReview(
  rating: ReviewRating,
  state: ReviewState,
  now = new Date(),
  settings = defaultStudySettings,
): NextReview {
  const currentInterval = Number(state.interval_days || 0);
  const currentEase = Number(
    state.ease_factor || settings.starting_ease_factor,
  );

  const storedStep = state.learning_step;
  const hasStoredStep = storedStep !== null && storedStep !== undefined;
  // With an explicit step we trust it; otherwise (e.g. column missing) fall
  // back to the interval: 0 means learning, > 0 means a graduated review card.
  const inLearningPhase = hasStoredStep
    ? Number(storedStep) >= 0
    : currentInterval <= 0;

  if (!inLearningPhase) {
    return scheduleReview(rating, { currentInterval, currentEase }, now, settings);
  }

  const isRelearning = currentInterval > 0;
  const steps = resolveSteps(
    isRelearning ? settings.relearning_steps : settings.learning_steps,
    isRelearning
      ? defaultStudySettings.relearning_steps
      : defaultStudySettings.learning_steps,
  );
  const currentStep = hasStoredStep
    ? Math.min(Math.max(Number(storedStep), 0), steps.length - 1)
    : 0;

  return scheduleLearning(
    rating,
    { currentInterval, currentEase, currentStep, steps, isRelearning },
    now,
    settings,
  );
}

// Spread out an interval so cards scheduled together don't all come due on the
// same day (Anki's "fuzz"). The fuzz window widens with the interval.
export function fuzzInterval(intervalDays: number, random = Math.random) {
  const interval = Math.round(intervalDays);

  if (interval < 2) {
    return interval;
  }

  if (interval === 2) {
    // Keep a 2-day card at 2-3 days so it never fuzzes back below itself.
    return 2 + Math.floor(random() * 2);
  }

  let fuzz: number;
  if (interval < 7) {
    fuzz = Math.floor(interval * 0.25);
  } else if (interval < 30) {
    fuzz = Math.max(2, Math.floor(interval * 0.15));
  } else {
    fuzz = Math.max(4, Math.floor(interval * 0.05));
  }
  fuzz = Math.max(fuzz, 1);

  const min = interval - fuzz;
  const max = interval + fuzz;
  return min + Math.floor(random() * (max - min + 1));
}

// Apply fuzz to a graduated review card only. Short (re)learning steps and
// 1-day graduations stay exact so previews match the actual schedule.
export function applyReviewFuzz(
  nextReview: NextReview,
  now: Date,
  settings = defaultStudySettings,
  random = Math.random,
): NextReview {
  if (
    nextReview.learning_step !== REVIEW_PHASE ||
    nextReview.interval_days < 2
  ) {
    return nextReview;
  }

  const fuzzed = clampInterval(
    fuzzInterval(nextReview.interval_days, random),
    settings,
  );

  return {
    ...nextReview,
    interval_days: fuzzed,
    next_review_at: addDays(now, fuzzed).toISOString(),
  };
}
