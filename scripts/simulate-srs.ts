/**
 * SRS simulation harness.
 *
 * Drives the real scheduler (getNextReview + applyReviewFuzz) with a synthetic
 * learner over many days and reports:
 *   1. Invariant violations  -> is the algorithm behaving correctly / safely?
 *   2. Retention + workload  -> is it scheduling sensibly (not too hard/easy)?
 *
 * The "learner" forgets on a half-life curve: the chance of recalling a card is
 * 2^(-elapsedDays / stability), where a hidden `stability` grows on success and
 * shrinks on a lapse. This is a stand-in for human memory, so the retention
 * number reflects that assumed curve — not a real user. What is objective is the
 * invariant check and whether the daily review load stays bounded.
 *
 * Usage:
 *   npx tsx scripts/simulate-srs.ts [--days 365] [--cards 500] [--new 15] [--seed 7]
 */
import { applyReviewFuzz, getNextReview } from "@/lib/review";
import {
  defaultStudySettings,
  type StudySettings,
} from "@/lib/study-settings";
import type { ReviewRating } from "@/lib/types";

const DAY_MS = 86_400_000;

// ---- Assumed human-memory model (tweak to stress different learners) ----
// Recall follows a half-life curve: p = 2^(-elapsed / stability). We let the
// learner's memory half-life track the interval the scheduler just picked, so a
// well-behaved scheduler holds retention near TARGET_RETENTION. Jitter makes
// some cards decay faster and lapse, producing a realistic leech tail.
const LEARN_RECALL = 0.9; // recall chance while still in short learning steps
const TARGET_RETENTION = 0.9;
const HALF_LIFE_RATIO = -1 / Math.log2(TARGET_RETENTION); // half-life = interval * ratio
const STABILITY_JITTER = 0.25; // per-review +/- fraction on the half-life
const LAPSE_STABILITY_FACTOR = 0.4; // how much a lapse shrinks memory
const P_EASY = 0.12; // of the recalled answers, share rated Easy
const P_HARD = 0.08; // ... and Hard (rest are Good)
const MAX_REVIEWS_PER_CARD_PER_DAY = 15; // guard against learning-step loops

type SimCard = {
  id: number;
  started: boolean;
  review_count: number;
  interval_days: number;
  ease_factor: number;
  learning_step: number;
  lapse_count: number;
  nextDue: number;
  lastReviewedAt: number;
  reviewsToday: number;
  stability: number; // hidden memory half-life, in days
};

function mulberry32(seed: number) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: number) => {
    const index = args.indexOf(flag);
    if (index === -1) return fallback;
    const value = Number(args[index + 1]);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    days: get("--days", 365),
    cards: get("--cards", 500),
    newPerDay: get("--new", 15),
    seed: get("--seed", 7),
  };
}

function main() {
  const { days, cards: cardCount, newPerDay, seed } = parseArgs();
  const settings: StudySettings = {
    ...defaultStudySettings,
    learning_steps: "1m 10m",
    relearning_steps: "10m",
  };
  const rng = mulberry32(seed);

  const base = new Date("2026-01-01T09:00:00.000Z");
  const baseMs = base.getTime();

  const deck: SimCard[] = Array.from({ length: cardCount }, (_, id) => ({
    id,
    started: false,
    review_count: 0,
    interval_days: 0,
    ease_factor: settings.starting_ease_factor,
    learning_step: 0,
    lapse_count: 0,
    nextDue: 0,
    lastReviewedAt: 0,
    reviewsToday: 0,
    stability: 0,
  }));

  const violations: string[] = [];
  const reviewsPerDay: number[] = [];
  let totalReviews = 0;

  // Retention accounting, split by the interval the card was scheduled at.
  let reviewPhaseAnswers = 0;
  let reviewPhaseAgain = 0;
  let youngAnswers = 0;
  let youngAgain = 0;
  let matureAnswers = 0;
  let matureAgain = 0;
  const ratingCounts: Record<ReviewRating, number> = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  };

  function checkInvariants(card: SimCard, result: ReturnType<typeof getNextReview>, day: number) {
    const nextMs = Date.parse(result.next_review_at);
    if (!Number.isFinite(result.interval_days) || result.interval_days < 0) {
      violations.push(`day ${day} card ${card.id}: bad interval ${result.interval_days}`);
    }
    if (result.interval_days > settings.maximum_interval_days) {
      violations.push(
        `day ${day} card ${card.id}: interval ${result.interval_days} > max ${settings.maximum_interval_days}`,
      );
    }
    if (!Number.isFinite(result.ease_factor) || result.ease_factor < settings.minimum_ease_factor - 1e-9) {
      violations.push(`day ${day} card ${card.id}: ease ${result.ease_factor} < min`);
    }
    if (!Number.isFinite(nextMs)) {
      violations.push(`day ${day} card ${card.id}: invalid next_review_at`);
    }
    if (!Number.isInteger(result.learning_step) || result.learning_step < -1) {
      violations.push(`day ${day} card ${card.id}: bad learning_step ${result.learning_step}`);
    }
  }

  function reviewCard(card: SimCard, nowMs: number, day: number) {
    const wasReviewPhase = card.interval_days > 0 && card.learning_step === -1;
    const scheduledInterval = card.interval_days;

    let recalled: boolean;
    if (card.learning_step >= 0) {
      recalled = rng() < LEARN_RECALL;
    } else {
      const elapsedDays = Math.max(0, (nowMs - card.lastReviewedAt) / DAY_MS);
      const stability = Math.max(0.1, card.stability);
      recalled = rng() < Math.pow(2, -elapsedDays / stability);
    }

    let rating: ReviewRating;
    if (!recalled) {
      rating = "again";
    } else {
      const roll = rng();
      rating = roll < P_EASY ? "easy" : roll < P_EASY + P_HARD ? "hard" : "good";
    }
    ratingCounts[rating] += 1;

    if (wasReviewPhase) {
      reviewPhaseAnswers += 1;
      if (rating === "again") reviewPhaseAgain += 1;
      if (scheduledInterval < 21) {
        youngAnswers += 1;
        if (rating === "again") youngAgain += 1;
      } else {
        matureAnswers += 1;
        if (rating === "again") matureAgain += 1;
      }
    }

    const now = new Date(nowMs);
    const result = applyReviewFuzz(
      getNextReview(
        rating,
        {
          review_count: card.review_count,
          interval_days: card.interval_days,
          ease_factor: card.ease_factor,
          learning_step: card.learning_step,
        },
        now,
        settings,
      ),
      now,
      settings,
      rng,
    );
    checkInvariants(card, result, day);

    // Update the hidden memory model.
    const jitter = 1 + (rng() * 2 - 1) * STABILITY_JITTER;
    if (rating === "again") {
      if (wasReviewPhase) card.lapse_count += 1;
      card.stability = Math.max(0.5, card.stability * LAPSE_STABILITY_FACTOR);
    } else if (result.learning_step === -1 && result.interval_days > 0) {
      // Successful review or graduation: memory half-life tracks the interval
      // the scheduler just committed to.
      card.stability = Math.max(1, result.interval_days * HALF_LIFE_RATIO * jitter);
    }

    card.review_count += 1;
    card.interval_days = result.interval_days;
    card.ease_factor = result.ease_factor;
    card.learning_step = result.learning_step;
    card.lastReviewedAt = nowMs;
    card.nextDue = Date.parse(result.next_review_at);
    card.reviewsToday += 1;
    totalReviews += 1;
  }

  for (let day = 0; day < days; day += 1) {
    const dayStartMs = baseMs + day * DAY_MS;
    const dayEndMs = dayStartMs + DAY_MS - 1;

    let introduced = 0;
    for (const card of deck) {
      card.reviewsToday = 0;
      if (!card.started && introduced < newPerDay) {
        card.started = true;
        card.nextDue = dayStartMs;
        introduced += 1;
      }
    }

    let reviewsThisDay = 0;
    let worked = true;
    let guard = 0;
    while (worked && guard < 2_000_000) {
      worked = false;
      guard += 1;
      for (const card of deck) {
        if (
          card.started &&
          card.nextDue <= dayEndMs &&
          card.reviewsToday < MAX_REVIEWS_PER_CARD_PER_DAY
        ) {
          reviewCard(card, dayStartMs, day);
          reviewsThisDay += 1;
          worked = true;
        }
      }
    }
    reviewsPerDay.push(reviewsThisDay);
  }

  report({
    days,
    cardCount,
    newPerDay,
    seed,
    settings,
    deck,
    violations,
    reviewsPerDay,
    totalReviews,
    reviewPhaseAnswers,
    reviewPhaseAgain,
    youngAnswers,
    youngAgain,
    matureAnswers,
    matureAgain,
    ratingCounts,
  });
}

function pct(part: number, total: number) {
  return total === 0 ? "n/a" : `${((part / total) * 100).toFixed(1)}%`;
}

function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

type ReportInput = {
  days: number;
  cardCount: number;
  newPerDay: number;
  seed: number;
  settings: StudySettings;
  deck: SimCard[];
  violations: string[];
  reviewsPerDay: number[];
  totalReviews: number;
  reviewPhaseAnswers: number;
  reviewPhaseAgain: number;
  youngAnswers: number;
  youngAgain: number;
  matureAnswers: number;
  matureAgain: number;
  ratingCounts: Record<ReviewRating, number>;
};

function report(input: ReportInput) {
  const {
    days,
    cardCount,
    newPerDay,
    seed,
    settings,
    deck,
    violations,
    reviewsPerDay,
    totalReviews,
    reviewPhaseAnswers,
    reviewPhaseAgain,
    youngAnswers,
    youngAgain,
    matureAnswers,
    matureAgain,
    ratingCounts,
  } = input;

  const started = deck.filter((card) => card.started);
  const graduated = started.filter(
    (card) => card.interval_days > 0 && card.learning_step === -1,
  );
  const inLearning = started.filter((card) => card.learning_step >= 0);
  const leeches = started.filter((card) => card.lapse_count >= 8);

  const easeBuckets = new Map<string, number>();
  for (const card of graduated) {
    const key = card.ease_factor.toFixed(2);
    easeBuckets.set(key, (easeBuckets.get(key) ?? 0) + 1);
  }

  const intervalBuckets: Array<[string, (i: number) => boolean]> = [
    ["1-6d", (i) => i >= 1 && i < 7],
    ["7-20d", (i) => i >= 7 && i < 21],
    ["21-59d", (i) => i >= 21 && i < 60],
    ["60-179d", (i) => i >= 60 && i < 180],
    ["180-365d", (i) => i >= 180],
  ];

  const first30 = average(reviewsPerDay.slice(0, 30));
  const last30 = average(reviewsPerDay.slice(-30));
  const peak = Math.max(...reviewsPerDay);

  const line = "-".repeat(58);
  console.log(line);
  console.log("SRS SIMULATION");
  console.log(line);
  console.log(
    `Config: days=${days} cards=${cardCount} new/day=${newPerDay} seed=${seed} steps="${settings.learning_steps}"`,
  );
  console.log("");

  console.log("== TÍNH ĐÚNG (bất biến) ==");
  if (violations.length === 0) {
    console.log(`  PASS — 0 vi phạm trên ${totalReviews.toLocaleString()} lượt ôn.`);
  } else {
    console.log(`  FAIL — ${violations.length} vi phạm. 10 cái đầu:`);
    for (const violation of violations.slice(0, 10)) {
      console.log(`    - ${violation}`);
    }
  }
  console.log("");

  console.log("== RETENTION (theo đường quên giả định) ==");
  console.log(
    `  Tổng thể (thẻ review): ${pct(reviewPhaseAnswers - reviewPhaseAgain, reviewPhaseAnswers)} nhớ` +
      `  (${reviewPhaseAnswers.toLocaleString()} lượt)`,
  );
  console.log(
    `  Young (<21 ngày):      ${pct(youngAnswers - youngAgain, youngAnswers)} nhớ`,
  );
  console.log(
    `  Mature (>=21 ngày):    ${pct(matureAnswers - matureAgain, matureAnswers)} nhớ`,
  );
  console.log("  (mục tiêu lành mạnh ~85-90%)");
  console.log("");

  console.log("== TẢI ÔN MỖI NGÀY ==");
  console.log(`  30 ngày đầu:  ${first30.toFixed(1)} lượt/ngày`);
  console.log(`  30 ngày cuối: ${last30.toFixed(1)} lượt/ngày`);
  console.log(`  Đỉnh:         ${peak} lượt/ngày`);
  console.log("");

  console.log("== TRẠNG THÁI THẺ (cuối mô phỏng) ==");
  console.log(`  Đã bắt đầu:   ${started.length}`);
  console.log(`  Đã tốt nghiệp:${graduated.length}  (${pct(graduated.length, started.length)})`);
  console.log(`  Còn học:      ${inLearning.length}`);
  console.log(`  Leech (>=8 quên): ${leeches.length}`);
  console.log("");

  console.log("== PHÂN BỐ RATING ==");
  for (const rating of ["again", "hard", "good", "easy"] as ReviewRating[]) {
    console.log(`  ${rating.padEnd(6)} ${ratingCounts[rating].toLocaleString().padStart(8)}  ${pct(ratingCounts[rating], totalReviews)}`);
  }
  console.log("");

  console.log("== PHÂN BỐ INTERVAL (thẻ đã tốt nghiệp) ==");
  for (const [label, test] of intervalBuckets) {
    const count = graduated.filter((card) => test(card.interval_days)).length;
    console.log(`  ${label.padEnd(10)} ${String(count).padStart(5)}  ${pct(count, graduated.length)}`);
  }
  console.log("");

  console.log("== PHÂN BỐ EASE (dấu hiệu 'ease hell' nếu dồn ở 1.30) ==");
  const easeKeys = [...easeBuckets.keys()].sort((a, b) => Number(a) - Number(b));
  for (const key of easeKeys) {
    const count = easeBuckets.get(key) ?? 0;
    console.log(`  ${key}  ${String(count).padStart(5)}  ${pct(count, graduated.length)}`);
  }
  console.log(line);
}

main();
