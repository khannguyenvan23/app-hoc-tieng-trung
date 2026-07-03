import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { getNextReview } from "@/lib/review";
import {
  defaultStudySettings,
  normalizeStudySettings,
} from "@/lib/study-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  sentenceCardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

type ReviewRow = {
  id: string;
  review_count: number | null;
  interval_days: number | null;
  ease_factor: number | null;
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
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  let { data: review, error: reviewError } = await supabase
    .from("sentence_reviews")
    .select("id, review_count, interval_days, ease_factor, weak_score, lapse_count, weak_since")
    .eq("sentence_card_id", body.data.sentenceCardId)
    .eq("user_id", user.id)
    .single<ReviewRow>();

  const supportsWeakQueue = !missingWeakColumns(reviewError);

  if (reviewError && !supportsWeakQueue) {
    const retryResult = await supabase
      .from("sentence_reviews")
      .select("id, review_count, interval_days, ease_factor")
      .eq("sentence_card_id", body.data.sentenceCardId)
      .eq("user_id", user.id)
      .single<ReviewRow>();

    review = retryResult.data;
    reviewError = retryResult.error;
  }

  if (reviewError || !review) {
    return NextResponse.json(
      { error: "Không tìm thấy lượt ôn" },
      { status: 404 },
    );
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
  const weakPatch = supportsWeakQueue ? getWeakPatch(body.data.rating, review) : {};
  const { error } = await supabase
    .from("sentence_reviews")
    .update({
      ...nextReview,
      ...weakPatch,
      review_count: Number(review.review_count || 0) + 1,
      last_rating: body.data.rating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể lưu kết quả ôn" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, ...nextReview });
}
