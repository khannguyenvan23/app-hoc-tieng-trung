export const insertionOrders = ["sequential", "random"] as const;

export type InsertionOrder = (typeof insertionOrders)[number];

export type StudySettings = {
  daily_new_card_limit: number;
  daily_new_sentence_limit: number;
  learning_steps: string;
  graduating_interval_days: number;
  easy_interval_days: number;
  insertion_order: InsertionOrder;
  review_again_interval_minutes: number;
  hard_interval_multiplier: number;
  starting_ease_factor: number;
  minimum_ease_factor: number;
  maximum_interval_days: number;
};

export const defaultStudySettings: StudySettings = {
  daily_new_card_limit: 10,
  daily_new_sentence_limit: 5,
  learning_steps: "10m",
  graduating_interval_days: 1,
  easy_interval_days: 4,
  insertion_order: "sequential",
  review_again_interval_minutes: 10,
  hard_interval_multiplier: 1.2,
  starting_ease_factor: 2.5,
  minimum_ease_factor: 1.3,
  maximum_interval_days: 365,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function parseLearningSteps(value: string) {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const minutes = tokens.flatMap((token) => {
    const match = token.toLowerCase().match(/^(\d+)(m|h|d)$/);

    if (!match) {
      return [];
    }

    const amount = Number(match[1]);
    const unit = match[2];

    if (!Number.isInteger(amount) || amount <= 0) {
      return [];
    }

    if (unit === "h") {
      return [amount * 60];
    }

    if (unit === "d") {
      return [amount * 1440];
    }

    return [amount];
  });

  return minutes.length === tokens.length ? minutes : [];
}

export function isValidLearningSteps(value: string) {
  const steps = parseLearningSteps(value);

  return (
    steps.length > 0 &&
    steps.length <= 8 &&
    steps.every((minutes) => minutes >= 1 && minutes <= 43_200)
  );
}

export function normalizeLearningSteps(value: unknown) {
  const textValue =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  return isValidLearningSteps(textValue)
    ? textValue
    : defaultStudySettings.learning_steps;
}

export function normalizeStudySettings(value: unknown): StudySettings {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof StudySettings, unknown>>)
      : {};

  return {
    daily_new_card_limit: clampInteger(
      source.daily_new_card_limit,
      0,
      100,
      defaultStudySettings.daily_new_card_limit,
    ),
    daily_new_sentence_limit: clampInteger(
      source.daily_new_sentence_limit,
      0,
      100,
      defaultStudySettings.daily_new_sentence_limit,
    ),
    learning_steps: normalizeLearningSteps(source.learning_steps),
    graduating_interval_days: clampInteger(
      source.graduating_interval_days,
      1,
      365,
      defaultStudySettings.graduating_interval_days,
    ),
    easy_interval_days: clampInteger(
      source.easy_interval_days,
      1,
      365,
      defaultStudySettings.easy_interval_days,
    ),
    insertion_order:
      source.insertion_order === "random" ? "random" : "sequential",
    review_again_interval_minutes: clampInteger(
      source.review_again_interval_minutes,
      1,
      1440,
      defaultStudySettings.review_again_interval_minutes,
    ),
    hard_interval_multiplier: Number(
      clampNumber(
        source.hard_interval_multiplier,
        1,
        5,
        defaultStudySettings.hard_interval_multiplier,
      ).toFixed(2),
    ),
    starting_ease_factor: Number(
      clampNumber(
        source.starting_ease_factor,
        1.3,
        5,
        defaultStudySettings.starting_ease_factor,
      ).toFixed(2),
    ),
    minimum_ease_factor: Number(
      clampNumber(
        source.minimum_ease_factor,
        1.1,
        5,
        defaultStudySettings.minimum_ease_factor,
      ).toFixed(2),
    ),
    maximum_interval_days: clampInteger(
      source.maximum_interval_days,
      1,
      3650,
      defaultStudySettings.maximum_interval_days,
    ),
  };
}

export function getFirstLearningStepMinutes(settings: StudySettings) {
  return (
    parseLearningSteps(settings.learning_steps)[0] ||
    parseLearningSteps(defaultStudySettings.learning_steps)[0] ||
    10
  );
}

export function getHardLearningStepMinutes(settings: StudySettings) {
  const steps = parseLearningSteps(settings.learning_steps);
  const firstStep = steps[0] || getFirstLearningStepMinutes(settings);

  return (
    steps[1] ||
    Math.max(firstStep * 3, settings.review_again_interval_minutes, 15)
  );
}

export function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function formatMinutesAsViDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} phút`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;

    return restMinutes > 0
      ? `${hours} giờ ${restMinutes} phút`
      : `${hours} giờ`;
  }

  const days = Math.round(minutes / 1440);
  return days === 1 ? "1 ngày" : `${days} ngày`;
}

export function formatReviewIntervalLabel(
  nextReviewAt: string,
  intervalDays: number,
  now = new Date(),
) {
  if (intervalDays > 0) {
    return intervalDays === 1 ? "1 ngày" : `${intervalDays} ngày`;
  }

  const minutes = Math.max(
    1,
    Math.round((new Date(nextReviewAt).getTime() - now.getTime()) / 60_000),
  );

  return formatMinutesAsViDuration(minutes);
}
