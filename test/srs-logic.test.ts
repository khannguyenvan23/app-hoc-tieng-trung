import assert from "node:assert/strict";
import test from "node:test";
import { getNextReview } from "../src/lib/review.ts";
import { defaultStudySettings } from "../src/lib/study-settings.ts";
import {
  buildStudyQueue,
  countWaitingNewItems,
  shouldRequeueInCurrentSession,
  type StudyQueueReview,
} from "../src/lib/study-queue.ts";

const baseNow = new Date("2026-07-17T00:00:00.000Z");
const settings = {
  ...defaultStudySettings,
  daily_new_card_limit: 10,
  daily_new_sentence_limit: 10,
  learning_steps: "3m 10m",
  relearning_steps: "3m",
  graduating_interval_days: 1,
  easy_interval_days: 3,
  insertion_order: "sequential" as const,
};

type TestReview = StudyQueueReview & {
  id: string;
  created_at: string;
};

function minutesUntil(nextReviewAt: string) {
  return Math.round(
    (new Date(nextReviewAt).getTime() - baseNow.getTime()) / 60_000,
  );
}

function daysUntil(nextReviewAt: string) {
  return Math.round(
    (new Date(nextReviewAt).getTime() - baseNow.getTime()) / 86_400_000,
  );
}

function makeReview(id: number, reviewCount: number): TestReview {
  return {
    id: `review-${id}`,
    review_count: reviewCount,
    next_review_at: new Date(baseNow.getTime() + id * 1_000).toISOString(),
    created_at: new Date(baseNow.getTime() + id * 1_000).toISOString(),
  };
}

test("new items obey the current daily limit while due review items stay visible", () => {
  const dueReviews = [makeReview(1, 2), makeReview(2, 1)];
  const newReviews = Array.from({ length: 30 }, (_, index) =>
    makeReview(index + 3, 0),
  );

  const queue = buildStudyQueue(
    [...dueReviews, ...newReviews],
    settings.daily_new_card_limit,
    settings,
    (review) => review.created_at,
  );

  assert.equal(queue.length, 12);
  assert.equal(queue.filter((review) => Number(review.review_count) === 0).length, 10);
  assert.deepEqual(
    dueReviews.map((review) => review.id).sort(),
    queue
      .filter((review) => Number(review.review_count) > 0)
      .map((review) => review.id)
      .sort(),
  );
  assert.equal(countWaitingNewItems([...dueReviews, ...newReviews], 10), 20);
});

test("restored queues are capped again when the user lowers the daily limit", () => {
  const oldStoredQueue = [
    makeReview(1, 1),
    makeReview(2, 1),
    ...Array.from({ length: 28 }, (_, index) => makeReview(index + 3, 0)),
  ];

  const queue = buildStudyQueue(
    oldStoredQueue,
    settings.daily_new_sentence_limit,
    settings,
    (review) => review.created_at,
  );

  assert.equal(queue.length, 12);
  assert.equal(queue.filter((review) => Number(review.review_count) === 0).length, 10);
});

test("learning ratings use the configured Anki-style steps and intervals", () => {
  const newState = {
    review_count: 0,
    interval_days: 0,
    ease_factor: null,
  };

  const again = getNextReview("again", newState, baseNow, settings);
  const hard = getNextReview("hard", newState, baseNow, settings);
  const good = getNextReview("good", newState, baseNow, settings);
  const easy = getNextReview("easy", newState, baseNow, settings);

  assert.equal(again.interval_days, 0);
  assert.equal(minutesUntil(again.next_review_at), 3);
  assert.equal(hard.interval_days, 0);
  assert.equal(minutesUntil(hard.next_review_at), 10);
  assert.equal(good.interval_days, settings.graduating_interval_days);
  assert.equal(daysUntil(good.next_review_at), settings.graduating_interval_days);
  assert.equal(easy.interval_days, settings.easy_interval_days);
  assert.equal(daysUntil(easy.next_review_at), settings.easy_interval_days);
});

test("review ratings schedule again soon and keep hard < good < easy", () => {
  const reviewState = {
    review_count: 5,
    interval_days: 4,
    ease_factor: 2.5,
  };

  const again = getNextReview("again", reviewState, baseNow, settings);
  const hard = getNextReview("hard", reviewState, baseNow, settings);
  const good = getNextReview("good", reviewState, baseNow, settings);
  const easy = getNextReview("easy", reviewState, baseNow, settings);

  assert.equal(minutesUntil(again.next_review_at), 3);
  assert.equal(again.interval_days, settings.minimum_lapse_interval_days);
  assert.ok(hard.interval_days < good.interval_days);
  assert.ok(good.interval_days < easy.interval_days);
  assert.equal(daysUntil(hard.next_review_at), hard.interval_days);
  assert.equal(daysUntil(good.next_review_at), good.interval_days);
  assert.equal(daysUntil(easy.next_review_at), easy.interval_days);
});

test("short learning steps stay in the current session, multi-day reviews do not", () => {
  assert.equal(
    shouldRequeueInCurrentSession(
      new Date(baseNow.getTime() + 10 * 60_000).toISOString(),
      baseNow,
    ),
    true,
  );
  assert.equal(
    shouldRequeueInCurrentSession(
      new Date(baseNow.getTime() + 3 * 86_400_000).toISOString(),
      baseNow,
    ),
    false,
  );
});
