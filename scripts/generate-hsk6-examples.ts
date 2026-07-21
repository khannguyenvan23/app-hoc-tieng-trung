import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

type SourceWord = {
  chinese: string;
  pinyin: string;
  meaningVi: string;
  position: number;
};

type Example = {
  chinese: string;
  exampleCn: string;
  examplePinyin: string;
  exampleVi: string;
};

const batchSchema = z.object({
  items: z.array(
    z.object({
      chinese: z.string().min(1),
      example_cn: z.string().min(2),
      example_pinyin: z.string().min(2),
      example_vi: z.string().min(2),
    }),
  ),
});

const defaultSource = "supabase/migrations/036_hsk6_2500_words.sql";
const defaultOutput = "supabase/migrations/037_hsk6_examples.sql";
const cachePath = path.join(os.tmpdir(), "tiengtrunghihi-hsk6-examples.json");
const batchSize = 20;
const concurrency = 2;

function parseArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function unescapeSql(value: string) {
  return value.replaceAll("''", "'");
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function readSourceWords(filePath: string): SourceWord[] {
  const sql = fs.readFileSync(filePath, "utf8");
  const rowPattern =
    /^\s+\('((?:[^']|'')*)', '((?:[^']|'')*)', '((?:[^']|'')*)', (\d+)\),?$/gm;
  const rows = Array.from(sql.matchAll(rowPattern)).map((match) => ({
    chinese: unescapeSql(match[1]),
    pinyin: unescapeSql(match[2]),
    meaningVi: unescapeSql(match[3]),
    position: Number(match[4]),
  }));

  if (
    rows.length !== 2500 ||
    rows.some((row, index) => row.position !== index + 1)
  ) {
    throw new Error(`Expected 2,500 ordered HSK6 words, received ${rows.length}.`);
  }

  return rows;
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return new Map<string, Example>();
  }

  const values = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Example[];
  return new Map(values.map((value) => [value.chinese, value]));
}

function saveCache(examples: Map<string, Example>) {
  const temporaryPath = `${cachePath}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(Array.from(examples.values()), null, 2),
    "utf8",
  );
  fs.renameSync(temporaryPath, cachePath);
}

function validateBatch(words: SourceWord[], raw: z.infer<typeof batchSchema>) {
  if (raw.items.length !== words.length) {
    throw new Error(`Expected ${words.length} examples, received ${raw.items.length}.`);
  }

  const byChinese = new Map(raw.items.map((item) => [item.chinese.trim(), item]));

  return words.map((word) => {
    const item = byChinese.get(word.chinese);

    if (!item) {
      throw new Error(`Missing example for ${word.chinese}.`);
    }

    const exampleCn = item.example_cn.trim();
    const examplePinyin = item.example_pinyin.trim();
    const exampleVi = item.example_vi.trim();

    const exampleTarget = word.chinese.replace(/（[^）]+）/g, "");

    if (!exampleCn.includes(exampleTarget)) {
      throw new Error(`Example does not contain target word ${word.chinese}: ${exampleCn}`);
    }

    if (!/[。！？]$/.test(exampleCn)) {
      throw new Error(`Example has no Chinese ending punctuation: ${exampleCn}`);
    }

    if (!/[À-ỹĐđ]/u.test(exampleVi)) {
      throw new Error(`Vietnamese translation appears unaccented: ${exampleVi}`);
    }

    return {
      chinese: word.chinese,
      exampleCn,
      examplePinyin,
      exampleVi,
    } satisfies Example;
  });
}

async function generateBatch(
  openai: OpenAI,
  model: string,
  words: SourceWord[],
) {
  const input = words.map((word) => ({
    chinese: word.chinese,
    pinyin: word.pinyin,
    meaning_vi: word.meaningVi,
  }));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "hsk6_examples",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["items"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "chinese",
                      "example_cn",
                      "example_pinyin",
                      "example_vi",
                    ],
                    properties: {
                      chinese: { type: "string" },
                      example_cn: { type: "string" },
                      example_pinyin: { type: "string" },
                      example_vi: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Bạn là giáo viên tiếng Trung HSK6 cho người Việt. Với mỗi từ đầu vào, viết đúng một câu ví dụ tiếng Trung tự nhiên, rõ ngữ cảnh và bắt buộc chứa nguyên văn từ mục tiêu. Các câu trong cùng lô không được dùng chung một khuôn câu. Ưu tiên câu dài 10-24 chữ Hán, đúng ngữ pháp và thể hiện đúng nghĩa đã cho. example_pinyin phải là pinyin có dấu thanh cho toàn bộ câu. example_vi phải là bản dịch tiếng Việt tự nhiên, có dấu đầy đủ. Giữ nguyên chinese và thứ tự đầu vào. Chỉ trả về JSON hợp lệ dạng {\"items\":[...]}, không giải thích.",
          },
          {
            role: "user",
            content: `Tạo câu ví dụ cho danh sách sau:\n${JSON.stringify(input)}\n\nJSON đầu ra bắt buộc có dạng:\n{\"items\":[{\"chinese\":\"...\",\"example_cn\":\"...\",\"example_pinyin\":\"...\",\"example_vi\":\"...\"}]}`,
          },
        ],
      });
      const content = completion.choices[0]?.message.content;

      if (!content) {
        throw new Error("OpenAI returned an empty response.");
      }

      return validateBatch(words, batchSchema.parse(JSON.parse(content)));
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      const delayMs = attempt * 1500;
      console.warn(
        `Retrying batch ${words[0].position}-${words.at(-1)?.position} after:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Unreachable batch generation state.");
}

function buildMigration(examples: Example[]) {
  const values = examples
    .map(
      (example) =>
        `  (${sqlLiteral(example.chinese)}, ${sqlLiteral(example.exampleCn)}, ${sqlLiteral(example.examplePinyin)}, ${sqlLiteral(example.exampleVi)})`,
    )
    .join(",\n");

  return `-- Add contextual HSK6 examples without overwriting user-edited content.
with hsk6_example_backfill (
  chinese,
  example_cn,
  example_pinyin,
  example_vi
) as (
  values
${values}
),
updated_template_cards as (
  update public.template_cards as card
  set
    example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
    example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
    example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
  from public.template_decks as deck,
    hsk6_example_backfill as example
  where card.template_deck_id = deck.id
    and deck.slug = 'hsk6-co-ban'
    and card.chinese = example.chinese
    and (
      nullif(btrim(card.example_cn), '') is null
      or nullif(btrim(card.example_pinyin), '') is null
      or nullif(btrim(card.example_vi), '') is null
    )
  returning card.id
)
update public.cards as card
set
  example_cn = coalesce(nullif(btrim(card.example_cn), ''), example.example_cn),
  example_pinyin = coalesce(nullif(btrim(card.example_pinyin), ''), example.example_pinyin),
  example_vi = coalesce(nullif(btrim(card.example_vi), ''), example.example_vi)
from public.decks as deck,
  hsk6_example_backfill as example
where card.deck_id = deck.id
  and card.user_id = deck.user_id
  and (
    deck.source_template_slug = 'hsk6-co-ban'
    or (deck.source_template_slug is null and deck.name = 'HSK6 cơ bản')
  )
  and card.chinese = example.chinese
  and (
    nullif(btrim(card.example_cn), '') is null
    or nullif(btrim(card.example_pinyin), '') is null
    or nullif(btrim(card.example_vi), '') is null
  );
`;
}

async function main() {
  const sourcePath = parseArgument("source") || defaultSource;
  const outputPath = parseArgument("output") || defaultOutput;
  const limit = Number(parseArgument("limit") || 2500);
  const words = readSourceWords(sourcePath);
  const cache = readCache();
  const pending = words.filter((word) => !cache.has(word.chinese)).slice(0, limit);

  if (pending.length > 0) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required.");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: 120_000,
    });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const batches: SourceWord[][] = [];

    for (let index = 0; index < pending.length; index += batchSize) {
      batches.push(pending.slice(index, index + batchSize));
    }

    let nextBatch = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, batches.length) },
      async () => {
        while (nextBatch < batches.length) {
          const batchIndex = nextBatch;
          nextBatch += 1;
          const batch = batches[batchIndex];
          const generated = await generateBatch(openai, model, batch);

          generated.forEach((example) => cache.set(example.chinese, example));
          saveCache(cache);
          console.log(
            `Generated ${batch[0].position}-${batch.at(-1)?.position}; cache=${cache.size}/2500`,
          );
        }
      },
    );

    await Promise.all(workers);
  }

  const orderedExamples = words
    .map((word) => cache.get(word.chinese))
    .filter((example): example is Example => Boolean(example));

  if (orderedExamples.length === 2500) {
    fs.writeFileSync(outputPath, buildMigration(orderedExamples), "utf8");
    console.log(`Generated ${outputPath} with 2,500 contextual examples.`);
  } else {
    console.log(`Cache now contains ${orderedExamples.length}/2500 examples.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
