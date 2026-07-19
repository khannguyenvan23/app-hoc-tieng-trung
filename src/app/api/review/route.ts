import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { getRequestUser } from "@/lib/auth";
import { getNextReview } from "@/lib/review";
import {
  defaultStudySettings,
  normalizeStudySettings,
} from "@/lib/study-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

type ReviewRow = {
  id: string;
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
  learning_step?: number | null;
  first_reviewed_at?: string | null;
  weak_score?: number | null;
  lapse_count?: number | null;
  weak_since?: string | null;
};

function missingWeakColumns(error: unknown) {
  return (
    typeof error === "object" &&
    error &&
    "message" in error &&
    String(error.message).includes("weak_score")
  );
}

function missingFirstReviewedColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error &&
    "message" in error &&
    String(error.message).includes("first_reviewed_at")
  );
}

function missingLearningStepColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error &&
    "message" in error &&
    String(error.message).includes("learning_step")
  );
}

function buildReviewSelect(options: {
  weak: boolean;
  firstReviewed: boolean;
  learningStep: boolean;
}) {
  const columns = ["id", "review_count", "interval_days", "ease_factor"];

  if (options.learningStep) {
    columns.push("learning_step");
  }

  if (options.firstReviewed) {
    columns.push("first_reviewed_at");
  }

  if (options.weak) {
    columns.push("weak_score", "lapse_count", "weak_since");
  }

  return columns.join(", ");
}

function getWeakPatch(rating: z.infer<typeof schema>["rating"], review: ReviewRow) {
  const currentScore = Number(review.weak_score || 0);
  const currentLapseCount = Number(review.lapse_count || 0);
  let weakScore = currentScore;
  let lapseCount = currentLapseCount;
  let weakSince: string | null = review.weak_since || null;

  if (rating === "again") {
    weakScore += 1;
    lapseCount += 1;
  } else if (rating === "good") {
    weakScore = Math.max(0, weakScore - 1);
  } else if (rating === "easy") {
    weakScore = Math.max(0, weakScore - 2);
  }

  if (weakScore >= 2 && !weakSince) {
    weakSince = new Date().toISOString();
  } else if (weakScore < 2) {
    weakSince = null;
  }

  return {
    weak_score: weakScore,
    lapse_count: lapseCount,
    weak_since: weakSince,
  };
}

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  let supportsFirstReviewedAt = true;
  let { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select(
      buildReviewSelect({ weak: true, firstReviewed: true, learningStep: true }),
    )
    .eq("card_id", body.data.cardId)
    .eq("user_id", user.id)
    .single<ReviewRow>();

  const supportsWeakQueue = !missingWeakColumns(reviewError);
  const supportsLearningStep = !missingLearningStepColumn(reviewError);

  if (
    reviewError &&
    (missingFirstReviewedColumn(reviewError) ||
      !supportsWeakQueue ||
      !supportsLearningStep)
  ) {
    supportsFirstReviewedAt = !missingFirstReviewedColumn(reviewError);
    const retryResult = await supabase
      .from("reviews")
      .select(
        buildReviewSelect({
          weak: supportsWeakQueue,
          firstReviewed: false,
          learningStep: supportsLearningStep,
        }),
      )
      .eq("card_id", body.data.cardId)
      .eq("user_id", user.id)
      .single<ReviewRow>();

    review = retryResult.data;
    reviewError = retryResult.error;
  }

  if (reviewError || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data: studySettingsRow, error: settingsError } = await supabase
    .from("user_study_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsError) {
    console.warn(settingsError);
  }

  const studySettings = normalizeStudySettings(
    settingsError ? defaultStudySettings : studySettingsRow,
  );
  const nextReview = getNextReview(
    body.data.rating,
    review,
    new Date(),
    studySettings,
  );
  const schedulePatch: Record<string, unknown> = { ...nextReview };
  if (!supportsLearningStep) {
    delete schedulePatch.learning_step;
  }
  const weakPatch = supportsWeakQueue ? getWeakPatch(body.data.rating, review) : {};
  const firstReviewPatch =
    supportsFirstReviewedAt &&
    Number(review.review_count || 0) === 0 &&
    !review.first_reviewed_at
      ? { first_reviewed_at: new Date().toISOString() }
      : {};
  const { error } = await supabase
    .from("reviews")
    .update({
      ...schedulePatch,
      ...weakPatch,
      ...firstReviewPatch,
      review_count: Number(review.review_count || 0) + 1,
      last_rating: body.data.rating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Review update failed" }, { status: 500 });
  }

  if (Number(review.review_count || 0) === 0) {
    await recordAnalyticsEvent({
      dedupeKey: `first_study:${user.id}`,
      eventName: "first_study",
      userId: user.id,
    });
  }

  return NextResponse.json({ success: true, ...nextReview });
}
