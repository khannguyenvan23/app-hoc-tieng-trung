import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAndUploadSpeech } from "@/lib/tts";

const schema = z.object({
  cardId: z.string().uuid(),
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
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, chinese, example_cn, word_audio_url, sentence_audio_url")
    .eq("id", body.data.cardId)
    .eq("user_id", user.id)
    .single();

  if (cardError || !card) {
    return NextResponse.json(
      { error: "Không tìm thấy thẻ" },
      { status: 404 },
    );
  }

  try {
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      card.word_audio_url
        ? Promise.resolve(card.word_audio_url)
        : createAndUploadSpeech(user.id, card.id, "word", card.chinese),
      card.sentence_audio_url
        ? Promise.resolve(card.sentence_audio_url)
        : createAndUploadSpeech(user.id, card.id, "sentence", card.example_cn),
    ]);

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        word_audio_url: wordAudioUrl,
        sentence_audio_url: sentenceAudioUrl,
      })
      .eq("id", card.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      wordAudioUrl,
      sentenceAudioUrl,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Không thể tạo audio cho thẻ" },
      { status: 500 },
    );
  }
}
