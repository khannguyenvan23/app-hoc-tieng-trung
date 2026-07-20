import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReviewFuzz,
  fuzzInterval,
  getNextReview,
} from "../src/lib/review.ts";
import { getReviewQueueStats } from "../src/lib/review-queue-stats.ts";
import { defaultStudySettings } from "../src/lib/study-settings.ts";
import {
  buildStudyQueue,
  countWaitingNewItems,
  getNextPendingStudyAt,
  getNextStudyQueueIndex,
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

function addMinutesIso(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function addDaysIso(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
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

test("learning steps advance one at a time before graduating", () => {
  // learning_steps === "3m 10m": two steps before graduation.
  const newState = {
    review_count: 0,
    interval_days: 0,
    ease_factor: null,
  };

  const again = getNextReview("again", newState, baseNow, settings);
  const hard = getNextReview("hard", newState, baseNow, settings);
  const good = getNextReview("good", newState, baseNow, settings);
  const easy = getNextReview("easy", newState, baseNow, settings);

  // again resets to the first step; hard stays on the step but sits between
  // again (3m) and good (10m): round((3 + 10) / 2) = 7m.
  assert.equal(again.interval_days, 0);
  assert.equal(again.learning_step, 0);
  assert.equal(minutesUntil(again.next_review_at), 3);
  assert.equal(hard.interval_days, 0);
  assert.equal(hard.learning_step, 0);
  assert.equal(minutesUntil(hard.next_review_at), 7);
  assert.ok(
    minutesUntil(again.next_review_at) < minutesUntil(hard.next_review_at) &&
      minutesUntil(hard.next_review_at) < minutesUntil(good.next_review_at),
  );

  // good on a new card advances to the second step, it does NOT graduate yet.
  assert.equal(good.interval_days, 0);
  assert.equal(good.learning_step, 1);
  assert.equal(minutesUntil(good.next_review_at), 10);

  // easy graduates straight away.
  assert.equal(easy.interval_days, settings.easy_interval_days);
  assert.equal(easy.learning_step, -1);
  assert.equal(daysUntil(easy.next_review_at), settings.easy_interval_days);

  // good again from the last learning step graduates.
  const graduated = getNextReview(
    "good",
    { review_count: 1, interval_days: 0, ease_factor: 2.5, learning_step: 1 },
    baseNow,
    settings,
  );
  assert.equal(graduated.interval_days, settings.graduating_interval_days);
  assert.equal(graduated.learning_step, -1);
  assert.equal(daysUntil(graduated.next_review_at), settings.graduating_interval_days);
});

test("lapsing a review card sends it through relearning and restores an interval", () => {
  const reviewState = {
    review_count: 5,
    interval_days: 8,
    ease_factor: 2.5,
    learning_step: -1,
  };

  // again lapses the card into the relearning step ("3m").
  const lapsed = getNextReview("again", reviewState, baseNow, settings);
  assert.equal(lapsed.learning_step, 0);
  assert.equal(lapsed.interval_days, settings.minimum_lapse_interval_days);
  assert.equal(minutesUntil(lapsed.next_review_at), 3);
  assert.ok(lapsed.ease_factor < reviewState.ease_factor);

  // good on the (single) relearning step graduates back to review.
  const relearned = getNextReview(
    "good",
    {
      review_count: 6,
      interval_days: lapsed.interval_days,
      ease_factor: lapsed.ease_factor,
      learning_step: 0,
    },
    baseNow,
    settings,
  );
  assert.equal(relearned.learning_step, -1);
  assert.equal(relearned.interval_days, lapsed.interval_days);
  assert.equal(daysUntil(relearned.next_review_at), lapsed.interval_days);
});

test("relearning walks through every relearning step before restoring", () => {
  const multiStep = { ...settings, relearning_steps: "10m 1h" };
  const mature = {
    review_count: 9,
    interval_days: 20,
    ease_factor: 2.5,
    learning_step: -1,
  };

  // Lapse drops ease once and enters relearning step 0.
  const lapsed = getNextReview("again", mature, baseNow, multiStep);
  assert.equal(lapsed.ease_factor, 2.3);
  assert.equal(lapsed.learning_step, 0);
  assert.equal(lapsed.interval_days, multiStep.minimum_lapse_interval_days);
  assert.equal(minutesUntil(lapsed.next_review_at), 10);

  // Failing again inside relearning must NOT punish ease a second time.
  const failedAgain = getNextReview(
    "again",
    { review_count: 10, interval_days: 1, ease_factor: 2.3, learning_step: 0 },
    baseNow,
    multiStep,
  );
  assert.equal(failedAgain.ease_factor, 2.3);
  assert.equal(failedAgain.learning_step, 0);
  assert.equal(failedAgain.interval_days, 1);

  // Good advances to the second relearning step, still not a review card.
  const secondStep = getNextReview(
    "good",
    { review_count: 10, interval_days: 1, ease_factor: 2.3, learning_step: 0 },
    baseNow,
    multiStep,
  );
  assert.equal(secondStep.learning_step, 1);
  assert.equal(minutesUntil(secondStep.next_review_at), 60);
  assert.equal(secondStep.interval_days, 1);

  // Good on the last relearning step restores the pending interval.
  const restored = getNextReview(
    "good",
    { review_count: 11, interval_days: 1, ease_factor: 2.3, learning_step: 1 },
    baseNow,
    multiStep,
  );
  assert.equal(restored.learning_step, -1);
  assert.equal(restored.interval_days, 1);
  assert.equal(daysUntil(restored.next_review_at), 1);
});

test("again from a later learning step resets to the first step", () => {
  const atSecondStep = {
    review_count: 2,
    interval_days: 0,
    ease_factor: 2.5,
    learning_step: 1,
  };

  const again = getNextReview("again", atSecondStep, baseNow, settings);
  assert.equal(again.learning_step, 0);
  assert.equal(minutesUntil(again.next_review_at), 3);
  assert.equal(again.interval_days, 0);

  // Hard on the final step has no next step to average with, so it uses 1.5x.
  const hard = getNextReview("hard", atSecondStep, baseNow, settings);
  assert.equal(hard.learning_step, 1);
  assert.equal(minutesUntil(hard.next_review_at), 15);
});

test("easy stays ahead of good even when the intervals are misconfigured", () => {
  // A user can set Easy interval (2d) shorter than Graduating interval (5d) in
  // the options page; Easy must still not schedule sooner than Good.
  const inverted = {
    ...settings,
    learning_steps: "10m",
    graduating_interval_days: 5,
    easy_interval_days: 2,
  };
  const newCard = {
    review_count: 0,
    interval_days: 0,
    ease_factor: null,
    learning_step: 0,
  };

  const good = getNextReview("good", newCard, baseNow, inverted);
  const easy = getNextReview("easy", newCard, baseNow, inverted);

  assert.equal(good.interval_days, 5);
  assert.ok(
    easy.interval_days > good.interval_days,
    `easy (${easy.interval_days}d) must be longer than good (${good.interval_days}d)`,
  );
});

test("ease never falls below the configured floor", () => {
  const nearFloor = {
    review_count: 20,
    interval_days: 10,
    ease_factor: 1.35,
    learning_step: -1,
  };

  const lapsed = getNextReview("again", nearFloor, baseNow, settings);
  assert.equal(lapsed.ease_factor, settings.minimum_ease_factor);
  assert.ok(lapsed.ease_factor >= settings.minimum_ease_factor);
});

test("intervals never exceed the maximum, and stay ordered below it", () => {
  const capped = getNextReview(
    "easy",
    { review_count: 30, interval_days: 360, ease_factor: 2.5, learning_step: -1 },
    baseNow,
    settings,
  );
  assert.equal(capped.interval_days, settings.maximum_interval_days);

  // Property sweep: hard <= good <= easy always, strict while below the cap.
  for (const interval of [1, 3, 10, 50, 200]) {
    for (const ease of [1.3, 2.0, 2.5, 3.0]) {
      const state = {
        review_count: 5,
        interval_days: interval,
        ease_factor: ease,
        learning_step: -1,
      };
      const hard = getNextReview("hard", state, baseNow, settings).interval_days;
      const good = getNextReview("good", state, baseNow, settings).interval_days;
      const easy = getNextReview("easy", state, baseNow, settings).interval_days;
      const label = `interval=${interval} ease=${ease}`;

      assert.ok(hard <= good && good <= easy, `ordering broken at ${label}`);
      assert.ok(easy <= settings.maximum_interval_days, `cap broken at ${label}`);
      if (easy < settings.maximum_interval_days) {
        assert.ok(hard < good && good < easy, `not strict at ${label}`);
      }
    }
  }
});

test("interval fuzz stays within Anki's widening window", () => {
  // Tiny intervals are never fuzzed so previews stay exact.
  assert.equal(fuzzInterval(0), 0);
  assert.equal(fuzzInterval(1), 1);

  // A 2-day card lands on 2 or 3, never below itself.
  assert.equal(fuzzInterval(2, () => 0), 2);
  assert.equal(fuzzInterval(2, () => 0.999), 3);

  // 10-day card: fuzz = max(2, floor(10 * 0.15)) = 2 => range [8, 12].
  assert.equal(fuzzInterval(10, () => 0), 8);
  assert.equal(fuzzInterval(10, () => 0.999), 12);
  for (let i = 0; i < 50; i += 1) {
    const value = fuzzInterval(10);
    assert.ok(value >= 8 && value <= 12);
  }
});

test("fuzz only touches graduated review cards, not learning steps", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");

  const learningStep = {
    next_review_at: addMinutesIso(now, 10),
    interval_days: 0,
    ease_factor: 2.5,
    learning_step: 0,
  };
  assert.deepEqual(applyReviewFuzz(learningStep, now, settings), learningStep);

  const oneDay = {
    next_review_at: addDaysIso(now, 1),
    interval_days: 1,
    ease_factor: 2.5,
    learning_step: -1,
  };
  assert.deepEqual(applyReviewFuzz(oneDay, now, settings), oneDay);

  const graduated = {
    next_review_at: addDaysIso(now, 10),
    interval_days: 10,
    ease_factor: 2.5,
    learning_step: -1,
  };
  const fuzzedLow = applyReviewFuzz(graduated, now, settings, () => 0);
  assert.equal(fuzzedLow.interval_days, 8);
  assert.equal(daysUntil(fuzzedLow.next_review_at), 8);

  const capped = applyReviewFuzz(
    { ...graduated, interval_days: 400 },
    now,
    settings,
    () => 0.999,
  );
  assert.ok(capped.interval_days <= settings.maximum_interval_days);
});

test("queue stats treat relearning cards as learning, not review", () => {
  const stats = getReviewQueueStats([
    { review_count: 0, interval_days: 0, last_rating: null, learning_step: 0 },
    // relearning: interval > 0 but still stepping, must count as learning.
    { review_count: 3, interval_days: 1, last_rating: "hard", learning_step: 0 },
    { review_count: 5, interval_days: 10, last_rating: "good", learning_step: -1 },
    // legacy row without learning_step falls back to the old heuristic.
    { review_count: 2, interval_days: 0, last_rating: "good" },
  ]);

  assert.equal(stats.new, 1);
  assert.equal(stats.learning, 2);
  assert.equal(stats.review, 1);
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

test("study queue skips learning items until their scheduled time", () => {
  const futureLearning = {
    ...makeReview(1, 1),
    next_review_at: new Date(baseNow.getTime() + 10 * 60_000).toISOString(),
  };
  const newDueItem = {
    ...makeReview(2, 0),
    next_review_at: new Date(baseNow.getTime() - 60_000).toISOString(),
  };

  assert.equal(
    getNextStudyQueueIndex([futureLearning, newDueItem], 0, baseNow),
    1,
  );
  assert.equal(getNextStudyQueueIndex([futureLearning], 0, baseNow), -1);
  assert.equal(
    getNextStudyQueueIndex(
      [futureLearning],
      0,
      new Date(baseNow.getTime() + 10 * 60_000),
    ),
    0,
  );
  assert.equal(
    getNextPendingStudyAt([futureLearning], baseNow),
    futureLearning.next_review_at,
  );
  assert.equal(
    getNextPendingStudyAt([newDueItem, futureLearning], baseNow),
    futureLearning.next_review_at,
  );
});
