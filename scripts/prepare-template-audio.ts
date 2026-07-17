import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateTemplateSpeech } from "@/lib/tts";

type TemplateDeckRow = {
  id: string;
  slug: string;
  name: string;
};

type TemplateCardRow = {
  id: string;
  chinese: string | null;
  example_cn: string | null;
  word_audio_url: string | null;
  sentence_audio_url: string | null;
};

type TemplateSentenceCardRow = {
  id: string;
  sentence_cn: string | null;
  sentence_audio_url: string | null;
};

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const targetSlug = getArgValue("slug");
const limit = Number(getArgValue("limit") || 0);
const dryRun = process.argv.includes("--dry-run");

let preparedCount = 0;

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex < 0) {
        return;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

function canContinue() {
  return !limit || preparedCount < limit;
}

async function prepareTemplateCardAudio(
  deck: TemplateDeckRow,
  card: TemplateCardRow,
) {
  const supabase = createSupabaseAdminClient();
  const patch: Partial<
    Pick<TemplateCardRow, "word_audio_url" | "sentence_audio_url">
  > = {};

  if (!card.word_audio_url && card.chinese && canContinue()) {
    preparedCount += 1;
    console.log(`[word] ${deck.slug}: ${card.chinese}`);
    if (!dryRun) {
      patch.word_audio_url = await getOrCreateTemplateSpeech(
        deck.slug,
        "word",
        card.chinese,
      );
    }
  }

  if (!card.sentence_audio_url && card.example_cn && canContinue()) {
    preparedCount += 1;
    console.log(`[sentence] ${deck.slug}: ${card.example_cn}`);
    if (!dryRun) {
      patch.sentence_audio_url = await getOrCreateTemplateSpeech(
        deck.slug,
        "sentence",
        card.example_cn,
      );
    }
  }

  if (!dryRun && Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("template_cards")
      .update(patch)
      .eq("id", card.id);

    if (error) {
      throw error;
    }
  }
}

async function prepareTemplateSentenceAudio(
  deck: TemplateDeckRow,
  sentenceCard: TemplateSentenceCardRow,
) {
  if (
    sentenceCard.sentence_audio_url ||
    !sentenceCard.sentence_cn ||
    !canContinue()
  ) {
    return;
  }

  preparedCount += 1;
  console.log(`[practice-sentence] ${deck.slug}: ${sentenceCard.sentence_cn}`);

  if (dryRun) {
    return;
  }

  const sentenceAudioUrl = await getOrCreateTemplateSpeech(
    deck.slug,
    "sentence",
    sentenceCard.sentence_cn,
  );
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("template_sentence_cards")
    .update({ sentence_audio_url: sentenceAudioUrl })
    .eq("id", sentenceCard.id);

  if (error) {
    throw error;
  }
}

async function main() {
  loadLocalEnv();

  const supabase = createSupabaseAdminClient();
  let deckQuery = supabase
    .from("template_decks")
    .select("id, slug, name")
    .order("created_at", { ascending: true });

  if (targetSlug) {
    deckQuery = deckQuery.eq("slug", targetSlug);
  }

  const { data: decks, error: deckError } = await deckQuery;

  if (deckError) {
    throw deckError;
  }

  for (const deck of (decks || []) as TemplateDeckRow[]) {
    if (!canContinue()) {
      break;
    }

    console.log(`\nPreparing template audio: ${deck.name} (${deck.slug})`);

    const { data: cards, error: cardError } = await supabase
      .from("template_cards")
      .select("id, chinese, example_cn, word_audio_url, sentence_audio_url")
      .eq("template_deck_id", deck.id)
      .or("word_audio_url.is.null,sentence_audio_url.is.null")
      .order("created_at", { ascending: true });

    if (cardError) {
      throw cardError;
    }

    for (const card of (cards || []) as TemplateCardRow[]) {
      if (!canContinue()) {
        break;
      }

      await prepareTemplateCardAudio(deck, card);
    }

    const { data: sentenceCards, error: sentenceError } = await supabase
      .from("template_sentence_cards")
      .select("id, sentence_cn, sentence_audio_url")
      .eq("template_deck_id", deck.id)
      .is("sentence_audio_url", null)
      .order("created_at", { ascending: true });

    if (sentenceError) {
      throw sentenceError;
    }

    for (const sentenceCard of (sentenceCards || []) as TemplateSentenceCardRow[]) {
      if (!canContinue()) {
        break;
      }

      await prepareTemplateSentenceAudio(deck, sentenceCard);
    }
  }

  console.log(
    `\nDone. ${dryRun ? "Would prepare" : "Prepared"} ${preparedCount} audio item(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
