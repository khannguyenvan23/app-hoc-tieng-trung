import OpenAI from "openai";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUDIO_BUCKET = "card-audio";

function getPublicAudioUrl(path: string) {
  const supabase = createSupabaseAdminClient();
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function audioObjectExists(path: string) {
  const separatorIndex = path.lastIndexOf("/");
  const folder = path.slice(0, separatorIndex);
  const fileName = path.slice(separatorIndex + 1);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(folder, { limit: 1, search: fileName });

  return !error && Boolean(data?.some((item) => item.name === fileName));
}

async function createAndUploadSpeechAtPath(
  path: string,
  text: string | null,
  cacheControl = "3600",
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
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, arrayBuffer, {
      cacheControl,
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return getPublicAudioUrl(path);
}

export async function getOrCreateTemplateSpeech(
  templateSlug: string,
  kind: "word" | "sentence",
  text: string | null,
) {
  if (!text) {
    return null;
  }

  const textHash = createHash("sha256").update(text).digest("hex").slice(0, 24);
  const safeSlug = templateSlug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `templates/${safeSlug}/${kind}-${textHash}.mp3`;

  if (await audioObjectExists(path)) {
    return getPublicAudioUrl(path);
  }

  return createAndUploadSpeechAtPath(path, text, "31536000");
}

export async function createAndUploadSpeech(
  userId: string,
  cardId: string,
  kind: "word" | "sentence",
  text: string | null,
) {
  const path = `${userId}/${cardId}/${kind}.mp3`;
  return createAndUploadSpeechAtPath(path, text);
}
