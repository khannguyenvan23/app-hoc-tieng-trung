import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSentenceFromWord } from "@/lib/ai";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAndUploadSpeech } from "@/lib/tts";

const schema = z.object({
  deckId: z.string().uuid(),
  items: z
    .array(
      z.object({
        chinese: z.string().min(1).max(30),
      }),
    )
    .min(1)
    .max(50),
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
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", body.data.deckId)
    .eq("user_id", user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ thẻ" },
      { status: 404 },
    );
  }

  let created = 0;

  try {
    for (const item of body.data.items) {
      const generated = await generateSentenceFromWord(item.chinese.trim());
      const { data: sentenceCard, error: cardError } = await supabase
        .from("sentence_cards")
        .insert({
          user_id: user.id,
          deck_id: body.data.deckId,
          sentence_cn: generated.sentence_cn,
          sentence_pinyin: generated.sentence_pinyin,
          sentence_vi: generated.sentence_vi,
          vocab_json: generated.vocab_items,
        })
        .select("id")
        .single();

      if (cardError || !sentenceCard) {
        throw cardError || new Error("Sentence card insert failed");
      }

      const sentenceAudioUrl = await createAndUploadSpeech(
        user.id,
        sentenceCard.id,
        "sentence",
        generated.sentence_cn,
      );

      if (sentenceAudioUrl) {
        const { error: audioError } = await supabase
          .from("sentence_cards")
          .update({ sentence_audio_url: sentenceAudioUrl })
          .eq("id", sentenceCard.id)
          .eq("user_id", user.id);

        if (audioError) {
          throw audioError;
        }
      }

      const { error: reviewError } = await supabase
        .from("sentence_reviews")
        .insert({
          user_id: user.id,
          sentence_card_id: sentenceCard.id,
        });

      if (reviewError) {
        throw reviewError;
      }

      created += 1;
    }

    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Import từ thành câu thất bại";
    const missingSentenceTables =
      message.includes("sentence_cards") ||
      message.includes("sentence_reviews") ||
      message.includes("schema cache");

    return NextResponse.json(
      {
        error: missingSentenceTables
          ? "Supabase chưa có bảng luyện câu. Hãy chạy migration 003_sentence_cards.sql trong SQL Editor rồi thử lại."
          : `Import từ thành câu thất bại: ${message}`,
        created,
      },
      { status: 500 },
    );
  }
}
