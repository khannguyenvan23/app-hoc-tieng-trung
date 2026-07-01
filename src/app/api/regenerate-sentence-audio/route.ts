import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAndUploadSpeech } from "@/lib/tts";

const schema = z.object({
  sentenceCardId: z.string().uuid(),
});

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
  const { data: sentenceCard, error: cardError } = await supabase
    .from("sentence_cards")
    .select("id, sentence_cn")
    .eq("id", body.data.sentenceCardId)
    .eq("user_id", user.id)
    .single();

  if (cardError || !sentenceCard) {
    return NextResponse.json(
      { error: "Không tìm thấy câu luyện tập" },
      { status: 404 },
    );
  }

  try {
    const sentenceAudioUrl = await createAndUploadSpeech(
      user.id,
      sentenceCard.id,
      "sentence",
      sentenceCard.sentence_cn,
    );

    const { error } = await supabase
      .from("sentence_cards")
      .update({ sentence_audio_url: sentenceAudioUrl })
      .eq("id", sentenceCard.id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, sentenceAudioUrl });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Không thể tạo lại audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
