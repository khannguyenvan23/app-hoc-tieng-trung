import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUDIO_BUCKET = "card-audio";

export async function createAndUploadSpeech(
  userId: string,
  cardId: string,
  kind: "word" | "sentence",
  text: string | null,
) {
  if (!text || !process.env.OPENAI_API_KEY) {
    return null;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: process.env.OPENAI_TTS_VOICE || "alloy",
    input: text,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/${cardId}/${kind}.mp3`;
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
