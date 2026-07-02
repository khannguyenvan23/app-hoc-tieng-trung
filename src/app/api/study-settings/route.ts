import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const defaultSettings = {
  daily_new_card_limit: 10,
  daily_new_sentence_limit: 5,
};

const updateSchema = z.object({
  daily_new_card_limit: z.number().int().min(0).max(100),
  daily_new_sentence_limit: z.number().int().min(0).max(100),
});

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_study_settings")
    .select("daily_new_card_limit, daily_new_sentence_limit")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể tải cài đặt học" },
      { status: 500 },
    );
  }

  return NextResponse.json({ settings: data || defaultSettings });
}

export async function PUT(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = updateSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_study_settings")
    .upsert({
      user_id: user.id,
      daily_new_card_limit: body.data.daily_new_card_limit,
      daily_new_sentence_limit: body.data.daily_new_sentence_limit,
      updated_at: new Date().toISOString(),
    })
    .select("daily_new_card_limit, daily_new_sentence_limit")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể lưu cài đặt học" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, settings: data });
}
