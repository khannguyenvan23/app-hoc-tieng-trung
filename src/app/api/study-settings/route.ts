import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import {
  defaultStudySettings,
  insertionOrders,
  isValidLearningSteps,
  normalizeStudySettings,
} from "@/lib/study-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  daily_new_card_limit: z.number().int().min(0).max(100),
  daily_new_sentence_limit: z.number().int().min(0).max(100),
  learning_steps: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isValidLearningSteps, "Invalid learning steps"),
  graduating_interval_days: z.number().int().min(1).max(365),
  easy_interval_days: z.number().int().min(1).max(365),
  insertion_order: z.enum(insertionOrders),
  review_again_interval_minutes: z.number().int().min(1).max(1440),
  hard_interval_multiplier: z.number().min(1).max(5),
  easy_bonus: z.number().min(1).max(5),
  interval_modifier: z.number().min(0.1).max(5),
  relearning_steps: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isValidLearningSteps, "Invalid relearning steps"),
  new_interval_percentage: z.number().min(0).max(100),
  minimum_lapse_interval_days: z.number().int().min(1).max(365),
  starting_ease_factor: z.number().min(1.3).max(5),
  minimum_ease_factor: z.number().min(1.1).max(5),
  maximum_interval_days: z.number().int().min(1).max(3650),
});

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_study_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể tải cài đặt học" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    settings: normalizeStudySettings(data || defaultStudySettings),
  });
}

export async function PUT(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = updateSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const nextSettings = normalizeStudySettings(body.data);
  const { data, error } = await supabase
    .from("user_study_settings")
    .upsert({
      user_id: user.id,
      ...nextSettings,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể lưu cài đặt học" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    settings: normalizeStudySettings(data),
  });
}
