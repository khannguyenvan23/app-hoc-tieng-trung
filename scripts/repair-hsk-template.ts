import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createOrReplaceTemplateSpeech,
  getOrCreateTemplateSpeech,
} from "@/lib/tts";

const templateConfigs = {
  "hsk1-co-ban": {
    name: "HSK1 cơ bản",
    expectedCardCount: 150,
    migration:
      "supabase/migrations/058_hsk1_complete_examples_pinyin_audio.sql",
  },
  "hsk2-co-ban": {
    name: "HSK2 cơ bản",
    expectedCardCount: 150,
    migration:
      "supabase/migrations/057_hsk2_complete_pinyin_audio.sql",
  },
  "hsk3-co-ban": {
    name: "HSK3 cơ bản",
    expectedCardCount: 300,
    migration:
      "supabase/migrations/056_hsk3_complete_pinyin_audio.sql",
  },
  "hsk4-co-ban": {
    name: "HSK4 cơ bản",
    expectedCardCount: 600,
    migration:
      "supabase/migrations/059_hsk4_complete_pinyin_audio.sql",
  },
} as const;

const requestedSlug =
  process.argv
    .find((argument) => argument.startsWith("--slug="))
    ?.slice("--slug=".length) || "hsk3-co-ban";

if (!(requestedSlug in templateConfigs)) {
  throw new Error(`Bộ thẻ không được hỗ trợ: ${requestedSlug}`);
}

const TEMPLATE_SLUG = requestedSlug as keyof typeof templateConfigs;
const templateConfig = templateConfigs[TEMPLATE_SLUG];
const TEMPLATE_NAME = templateConfig.name;
const EXPECTED_CARD_COUNT = templateConfig.expectedCardCount;
const AUDIO_BUCKET = "card-audio";
const EDGE_TTS_VOICE = "zh-CN-XiaoxiaoNeural";
const OUTPUT_PATH = resolve(process.cwd(), templateConfig.migration);

type HskCard = {
  id: string;
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
  word_audio_url: string | null;
  sentence_audio_url: string | null;
  position: number;
  original_example_cn: string;
};

type RepairedCard = HskCard & {
  repaired_example_pinyin: string;
  repaired_word_audio_url: string;
  repaired_sentence_audio_url: string;
};

let openAiTtsUnavailable = process.argv.includes("--edge-tts");
const useGoogleTts = process.argv.includes("--google-tts");
const rebuildWithOpenAi = process.argv.includes("--openai-rebuild");
const repairSentencePinyin = process.argv.includes("--repair-pinyin");

const exampleCorrections: Partial<
  Record<
    keyof typeof templateConfigs,
    Record<
      string,
      Pick<HskCard, "example_cn" | "example_pinyin" | "example_vi">
    >
  >
> = {
  "hsk1-co-ban": {
    三: {
      example_cn: "桌上有三个杯子。",
      example_pinyin: "Zhuō shàng yǒu sān gè bēizi.",
      example_vi: "Trên bàn có ba cái cốc.",
    },
    喜欢: {
      example_cn: "妹妹喜欢听音乐。",
      example_pinyin: "Mèimei xǐhuan tīng yīnyuè.",
      example_vi: "Em gái thích nghe nhạc.",
    },
    苹果: {
      example_cn: "这个苹果很甜。",
      example_pinyin: "Zhège píngguǒ hěn tián.",
      example_vi: "Quả táo này rất ngọt.",
    },
    这: {
      example_cn: "这是我的老师。",
      example_pinyin: "Zhè shì wǒ de lǎoshī.",
      example_vi: "Đây là giáo viên của tôi.",
    },
    水: {
      example_cn: "杯子里有热水。",
      example_pinyin: "Bēizi lǐ yǒu rèshuǐ.",
      example_vi: "Trong cốc có nước nóng.",
    },
    你: {
      example_cn: "你今天去学校吗？",
      example_pinyin: "Nǐ jīntiān qù xuéxiào ma?",
      example_vi: "Hôm nay bạn có đến trường không?",
    },
    一: {
      example_cn: "我每天早上喝一杯牛奶。",
      example_pinyin: "Wǒ měitiān zǎoshang hē yì bēi niúnǎi.",
      example_vi: "Mỗi sáng tôi uống một cốc sữa.",
    },
    有: {
      example_cn: "教室里有很多学生。",
      example_pinyin: "Jiàoshì lǐ yǒu hěn duō xuésheng.",
      example_vi: "Trong lớp học có rất nhiều học sinh.",
    },
  },
};

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

function convertExamplesToTonePinyin(sentences: string[]) {
  const pythonSource = String.raw`
import json
import re
import sys

import jieba
from pypinyin import Style, lazy_pinyin

closing_punctuation = set("，。！？；：、,.!?;:)]}）】》」』")
opening_punctuation = set("([{（【《「『“‘")

def convert_sentence(text):
    output = ""

    for token in jieba.cut(text, cut_all=False):
        if not token or token.isspace():
            continue

        if re.fullmatch(r"[\u3400-\u4dbf\u4e00-\u9fff]+", token):
            value = "".join(
                lazy_pinyin(
                    token,
                    style=Style.TONE,
                    neutral_tone_with_five=False,
                    errors="default",
                )
            )
        else:
            value = token

        if value and all(character in closing_punctuation for character in value):
            output = output.rstrip() + value
        elif value and all(character in opening_punctuation for character in value):
            if output and not output.endswith(" "):
                output += " "
            output += value
        else:
            if output and not output.endswith((" ", "（", "(", "【", "《", "「", "『", "“", "‘")):
                output += " "
            output += value

    return output.strip().capitalize()

sentences = json.load(sys.stdin)
json.dump(
    [convert_sentence(sentence) for sentence in sentences],
    sys.stdout,
    ensure_ascii=False,
)
`;
  const result = spawnSync("python", ["-c", pythonSource], {
    input: JSON.stringify(sentences),
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
    maxBuffer: 8 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      `Không thể tạo pinyin ${TEMPLATE_NAME}: ${result.stderr || result.stdout}`,
    );
  }

  const converted = JSON.parse(result.stdout) as string[];

  if (converted.length !== sentences.length) {
    throw new Error(
      `Bộ chuyển pinyin trả về ${converted.length}/${sentences.length} câu.`,
    );
  }

  return converted;
}

function sqlLiteral(value: string | null) {
  if (value === null) {
    return "null";
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function getTemplateAudioPath(
  kind: "word" | "sentence",
  text: string,
) {
  const textHash = createHash("sha256")
    .update(text)
    .digest("hex")
    .slice(0, 24);
  return `templates/${TEMPLATE_SLUG}/${kind}-${textHash}.mp3`;
}

async function storedAudioUrl(path: string) {
  const separatorIndex = path.lastIndexOf("/");
  const folder = path.slice(0, separatorIndex);
  const fileName = path.slice(separatorIndex + 1);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(folder, { limit: 1, search: fileName });

  if (!error && data?.some((item) => item.name === fileName)) {
    return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return null;
}

async function createEdgeTemplateSpeech(
  kind: "word" | "sentence",
  text: string,
) {
  const path = getTemplateAudioPath(kind, text);
  const existingUrl = await storedAudioUrl(path);

  if (existingUrl) {
    return existingUrl;
  }

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "tiengtrunghihi-hsk-"),
  );
  const outputPath = join(temporaryDirectory, "speech.mp3");

  try {
    const result = spawnSync(
      "edge-tts",
      [
        "--voice",
        EDGE_TTS_VOICE,
        "--text",
        text,
        "--write-media",
        outputPath,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    if (result.status !== 0 || !existsSync(outputPath)) {
      throw new Error(
        `Edge TTS không tạo được audio: ${result.stderr || result.stdout}`,
      );
    }

    const supabase = createSupabaseAdminClient();
    const audioBuffer = await readFile(outputPath);
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, audioBuffer, {
        cacheControl: "31536000",
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (error) {
      throw error;
    }

    return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function createGoogleTemplateSpeech(
  kind: "word" | "sentence",
  text: string,
) {
  const path = getTemplateAudioPath(kind, text);
  const existingUrl = await storedAudioUrl(path);

  if (existingUrl) {
    return existingUrl;
  }

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "tiengtrunghihi-hsk-"),
  );
  const outputPath = join(temporaryDirectory, "speech.mp3");

  try {
    const result = spawnSync(
      "gtts-cli",
      [text, "--lang", "zh-CN", "--output", outputPath],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );

    if (result.status !== 0 || !existsSync(outputPath)) {
      throw new Error(
        `Google TTS không tạo được audio: ${result.stderr || result.stdout}`,
      );
    }

    const supabase = createSupabaseAdminClient();
    const audioBuffer = await readFile(outputPath);
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, audioBuffer, {
        cacheControl: "31536000",
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (error) {
      throw error;
    }

    return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function createTemplateSpeech(
  kind: "word" | "sentence",
  text: string,
) {
  if (rebuildWithOpenAi) {
    return createOrReplaceTemplateSpeech(TEMPLATE_SLUG, kind, text);
  }

  if (useGoogleTts) {
    return createGoogleTemplateSpeech(kind, text);
  }

  if (openAiTtsUnavailable) {
    return createEdgeTemplateSpeech(kind, text);
  }

  try {
    return await getOrCreateTemplateSpeech(TEMPLATE_SLUG, kind, text);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : 0;

    if (status !== 429) {
      throw error;
    }

    openAiTtsUnavailable = true;
    console.warn(
      "[audio] OpenAI TTS hết quota, chuyển sang Microsoft Edge TTS.",
    );
    return createEdgeTemplateSpeech(kind, text);
  }
}

function buildValues(cards: RepairedCard[]) {
  return cards
    .map(
      (card) =>
        `    (${[
          card.chinese,
          card.original_example_cn,
          card.example_cn,
          card.repaired_example_pinyin,
          card.example_vi,
          card.repaired_word_audio_url,
          card.repaired_sentence_audio_url,
        ]
          .map(sqlLiteral)
          .join(", ")})`,
    )
    .join(",\n");
}

function buildMigration(cards: RepairedCard[]) {
  const values = buildValues(cards);

  return `-- Complete ${TEMPLATE_NAME} with sentence pinyin and cached audio.
-- Existing user copies are refreshed only when their Chinese example still matches
-- the template example, so user-edited content is left untouched.

with repaired_hsk (
  chinese,
  original_example_cn,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url
) as (
  values
${values}
)
update public.template_cards as card
set
  example_cn = repaired.example_cn,
  example_pinyin = repaired.example_pinyin,
  example_vi = repaired.example_vi,
  word_audio_url = repaired.word_audio_url,
  sentence_audio_url = repaired.sentence_audio_url
from public.template_decks as deck,
  repaired_hsk as repaired
where card.template_deck_id = deck.id
  and deck.slug = '${TEMPLATE_SLUG}'
  and card.chinese = repaired.chinese;

with repaired_hsk (
  chinese,
  original_example_cn,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url
) as (
  values
${values}
)
update public.cards as card
set
  example_cn = repaired.example_cn,
  example_pinyin = repaired.example_pinyin,
  example_vi = repaired.example_vi,
  word_audio_url = repaired.word_audio_url,
  sentence_audio_url = repaired.sentence_audio_url
from public.decks as deck,
  repaired_hsk as repaired
where card.deck_id = deck.id
  and card.user_id = deck.user_id
  and (
    deck.source_template_slug = '${TEMPLATE_SLUG}'
    or (
      deck.source_template_slug is null
      and deck.name = '${TEMPLATE_NAME}'
    )
  )
  and card.chinese = repaired.chinese
  and card.example_cn = repaired.original_example_cn;
`;
}

function validateCards(cards: HskCard[]) {
  if (cards.length !== EXPECTED_CARD_COUNT) {
    throw new Error(
      `${TEMPLATE_NAME} phải có ${EXPECTED_CARD_COUNT} thẻ, hiện có ${cards.length}.`,
    );
  }

  const uniqueChinese = new Set(cards.map((card) => card.chinese.trim()));
  const uniqueExamples = new Set(cards.map((card) => card.example_cn.trim()));

  if (uniqueChinese.size !== EXPECTED_CARD_COUNT) {
    throw new Error(`${TEMPLATE_NAME} đang có từ tiếng Trung bị trùng.`);
  }

  if (uniqueExamples.size !== EXPECTED_CARD_COUNT) {
    throw new Error(`${TEMPLATE_NAME} đang có câu ví dụ bị trùng.`);
  }

  for (const card of cards) {
    const requiredValues = [
      card.chinese,
      card.pinyin,
      card.meaning_vi,
      card.example_cn,
      card.example_vi,
    ];

    if (requiredValues.some((value) => !value?.trim())) {
      throw new Error(
        `Thẻ ${TEMPLATE_NAME} vị trí ${card.position} đang thiếu dữ liệu.`,
      );
    }

    const targetWord = card.chinese.replace(/[（(].*$/, "").trim();

    if (!card.example_cn.includes(targetWord)) {
      throw new Error(
        `Câu ví dụ vị trí ${card.position} không chứa từ ${card.chinese}.`,
      );
    }
  }
}

async function updateExistingUserCopies(
  cards: RepairedCard[],
  deckIds: string[],
) {
  if (deckIds.length === 0) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  let updatedCount = 0;

  for (const card of cards) {
    const { data, error } = await supabase
      .from("cards")
      .update({
        example_cn: card.example_cn,
        example_pinyin: card.repaired_example_pinyin,
        example_vi: card.example_vi,
        word_audio_url: card.repaired_word_audio_url,
        sentence_audio_url: card.repaired_sentence_audio_url,
      })
      .in("deck_id", deckIds)
      .eq("chinese", card.chinese)
      .eq("example_cn", card.original_example_cn)
      .select("id");

    if (error) {
      throw error;
    }

    updatedCount += data?.length || 0;
  }

  return updatedCount;
}

async function main() {
  loadLocalEnv();

  const supabase = createSupabaseAdminClient();
  const { data: templateDeck, error: deckError } = await supabase
    .from("template_decks")
    .select("id, slug, name")
    .eq("slug", TEMPLATE_SLUG)
    .single();

  if (deckError) {
    throw deckError;
  }

  const { data, error: cardError } = await supabase
    .from("template_cards")
    .select(
      "id, chinese, pinyin, meaning_vi, example_cn, example_pinyin, example_vi, word_audio_url, sentence_audio_url, position",
    )
    .eq("template_deck_id", templateDeck.id)
    .order("position", { ascending: true });

  if (cardError) {
    throw cardError;
  }

  const corrections = exampleCorrections[TEMPLATE_SLUG] || {};
  const cards = ((data || []) as Omit<HskCard, "original_example_cn">[]).map(
    (card) => ({
      ...card,
      original_example_cn: card.example_cn,
      ...corrections[card.chinese],
    }),
  );
  validateCards(cards);

  const repairedPinyin = repairSentencePinyin
    ? convertExamplesToTonePinyin(cards.map((card) => card.example_cn))
    : cards.map((card) => card.example_pinyin);

  console.log(
    repairSentencePinyin
      ? `[pinyin] Đang chuẩn hóa ${cards.length} câu ${TEMPLATE_NAME}...`
      : `[pinyin] Giữ nguyên ${cards.length} câu pinyin đã có dấu.`,
  );
  const repairedCards: RepairedCard[] = [];

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const examplePinyin = repairedPinyin[index];

    if (!examplePinyin) {
      throw new Error(`Không tạo được pinyin cho thẻ ${card.position}.`);
    }

    console.log(`[audio ${index + 1}/${cards.length}] ${card.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      rebuildWithOpenAi
        ? createTemplateSpeech("word", card.chinese)
        : card.word_audio_url || createTemplateSpeech("word", card.chinese),
      rebuildWithOpenAi
        ? createTemplateSpeech("sentence", card.example_cn)
        : card.sentence_audio_url ||
          createTemplateSpeech("sentence", card.example_cn),
    ]);

    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Không tạo đủ audio cho thẻ ${card.position}.`);
    }

    const { error: updateError } = await supabase
      .from("template_cards")
      .update({
        example_cn: card.example_cn,
        example_pinyin: examplePinyin,
        example_vi: card.example_vi,
        word_audio_url: wordAudioUrl,
        sentence_audio_url: sentenceAudioUrl,
      })
      .eq("id", card.id);

    if (updateError) {
      throw updateError;
    }

    repairedCards.push({
      ...card,
      repaired_example_pinyin: examplePinyin,
      repaired_word_audio_url: wordAudioUrl,
      repaired_sentence_audio_url: sentenceAudioUrl,
    });
  }

  const { data: copiedDecks, error: copiedDeckError } = await supabase
    .from("decks")
    .select("id")
    .eq("source_template_slug", TEMPLATE_SLUG);

  if (copiedDeckError) {
    throw copiedDeckError;
  }

  const { data: legacyDecks, error: legacyDeckError } = await supabase
    .from("decks")
    .select("id")
    .is("source_template_slug", null)
    .eq("name", TEMPLATE_NAME);

  if (legacyDeckError) {
    throw legacyDeckError;
  }

  const copiedDeckIds = [
    ...new Set(
      [...(copiedDecks || []), ...(legacyDecks || [])].map(
        (deck) => deck.id,
      ),
    ),
  ];
  const updatedUserCards = await updateExistingUserCopies(
    repairedCards,
    copiedDeckIds,
  );

  writeFileSync(OUTPUT_PATH, buildMigration(repairedCards), "utf8");
  console.log(
    `[done] Đã sửa ${repairedCards.length} thẻ mẫu, cập nhật ${updatedUserCards} thẻ người dùng.`,
  );
  console.log(`[migration] ${OUTPUT_PATH}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
