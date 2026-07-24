import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { getOrCreateTemplateSpeech } from "@/lib/tts";

loadEnvConfig(process.cwd());

type TravelWord = {
  chinese: string;
  pinyin: string;
  meaningVi: string;
  position: number;
};

type TravelCard = TravelWord & {
  exampleCn: string;
  examplePinyin: string;
  exampleVi: string;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const templateSlug = "du-lich-tieng-trung-100";
const outputPath = "supabase/migrations/038_travel_100_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  "tiengtrunghihi-travel-100-examples.json",
);
const batchSize = 20;
const audioConcurrency = 2;

const words = [
  ["旅游", "lǚyóu", "du lịch"],
  ["旅行", "lǚxíng", "đi du lịch, chuyến đi"],
  ["游客", "yóukè", "khách du lịch"],
  ["导游", "dǎoyóu", "hướng dẫn viên du lịch"],
  ["景点", "jǐngdiǎn", "điểm tham quan"],
  ["风景", "fēngjǐng", "phong cảnh"],
  ["行程", "xíngchéng", "lịch trình"],
  ["计划", "jìhuà", "kế hoạch"],
  ["出发", "chūfā", "khởi hành"],
  ["到达", "dàodá", "đến nơi"],
  ["返回", "fǎnhuí", "trở về"],
  ["预订", "yùdìng", "đặt trước"],
  ["取消", "qǔxiāo", "hủy bỏ"],
  ["改签", "gǎiqiān", "đổi vé, đổi chuyến"],
  ["护照", "hùzhào", "hộ chiếu"],
  ["签证", "qiānzhèng", "thị thực, visa"],
  ["身份证", "shēnfènzhèng", "căn cước công dân"],
  ["机票", "jīpiào", "vé máy bay"],
  ["往返票", "wǎngfǎnpiào", "vé khứ hồi"],
  ["单程票", "dānchéngpiào", "vé một chiều"],
  ["登机牌", "dēngjīpái", "thẻ lên máy bay"],
  ["行李", "xíngli", "hành lý"],
  ["行李箱", "xínglixiāng", "va li"],
  ["托运", "tuōyùn", "ký gửi hành lý"],
  ["手提行李", "shǒutí xíngli", "hành lý xách tay"],
  ["安检", "ānjiǎn", "kiểm tra an ninh"],
  ["海关", "hǎiguān", "hải quan"],
  ["入境", "rùjìng", "nhập cảnh"],
  ["出境", "chūjìng", "xuất cảnh"],
  ["航班", "hángbān", "chuyến bay"],
  ["机场", "jīchǎng", "sân bay"],
  ["航站楼", "hángzhànlóu", "nhà ga sân bay"],
  ["登机口", "dēngjīkǒu", "cửa lên máy bay"],
  ["延误", "yánwù", "trì hoãn, chậm chuyến"],
  ["起飞", "qǐfēi", "cất cánh"],
  ["降落", "jiàngluò", "hạ cánh"],
  ["火车", "huǒchē", "tàu hỏa"],
  ["火车站", "huǒchēzhàn", "ga tàu hỏa"],
  ["高铁", "gāotiě", "tàu cao tốc"],
  ["地铁", "dìtiě", "tàu điện ngầm"],
  ["公交车", "gōngjiāochē", "xe buýt"],
  ["出租车", "chūzūchē", "taxi"],
  ["网约车", "wǎngyuēchē", "xe công nghệ"],
  ["租车", "zūchē", "thuê xe"],
  ["自驾游", "zìjiàyóu", "du lịch tự lái xe"],
  ["车票", "chēpiào", "vé xe, vé tàu"],
  ["站台", "zhàntái", "sân ga"],
  ["换乘", "huànchéng", "chuyển tuyến"],
  ["路线", "lùxiàn", "tuyến đường"],
  ["地图", "dìtú", "bản đồ"],
  ["导航", "dǎoháng", "dẫn đường, định vị"],
  ["迷路", "mílù", "lạc đường"],
  ["地址", "dìzhǐ", "địa chỉ"],
  ["方向", "fāngxiàng", "phương hướng"],
  ["左转", "zuǒzhuǎn", "rẽ trái"],
  ["右转", "yòuzhuǎn", "rẽ phải"],
  ["直走", "zhízǒu", "đi thẳng"],
  ["酒店", "jiǔdiàn", "khách sạn"],
  ["宾馆", "bīnguǎn", "nhà nghỉ, khách sạn"],
  ["前台", "qiántái", "quầy lễ tân"],
  ["房间", "fángjiān", "phòng"],
  ["单人间", "dānrénjiān", "phòng đơn"],
  ["双人间", "shuāngrénjiān", "phòng đôi"],
  ["入住", "rùzhù", "nhận phòng"],
  ["退房", "tuìfáng", "trả phòng"],
  ["房卡", "fángkǎ", "thẻ phòng"],
  ["钥匙", "yàoshi", "chìa khóa"],
  ["早餐", "zǎocān", "bữa sáng"],
  ["无线网络", "wúxiàn wǎngluò", "mạng không dây, Wi-Fi"],
  ["空调", "kōngtiáo", "điều hòa"],
  ["旅游团", "lǚyóutuán", "đoàn du lịch"],
  ["自由行", "zìyóuxíng", "du lịch tự túc"],
  ["门票", "ménpiào", "vé vào cửa"],
  ["售票处", "shòupiàochù", "quầy bán vé"],
  ["开放时间", "kāifàng shíjiān", "giờ mở cửa"],
  ["博物馆", "bówùguǎn", "bảo tàng"],
  ["古迹", "gǔjì", "di tích cổ"],
  ["寺庙", "sìmiào", "chùa, đền"],
  ["海滩", "hǎitān", "bãi biển"],
  ["山", "shān", "núi"],
  ["湖", "hú", "hồ"],
  ["公园", "gōngyuán", "công viên"],
  ["拍照", "pāizhào", "chụp ảnh"],
  ["纪念品", "jìniànpǐn", "quà lưu niệm"],
  ["特产", "tèchǎn", "đặc sản"],
  ["兑换", "duìhuàn", "đổi tiền"],
  ["汇率", "huìlǜ", "tỷ giá"],
  ["现金", "xiànjīn", "tiền mặt"],
  ["信用卡", "xìnyòngkǎ", "thẻ tín dụng"],
  ["支付", "zhīfù", "thanh toán"],
  ["费用", "fèiyòng", "chi phí"],
  ["预算", "yùsuàn", "ngân sách"],
  ["保险", "bǎoxiǎn", "bảo hiểm"],
  ["旅游保险", "lǚyóu bǎoxiǎn", "bảo hiểm du lịch"],
  ["紧急情况", "jǐnjí qíngkuàng", "tình huống khẩn cấp"],
  ["医院", "yīyuàn", "bệnh viện"],
  ["警察", "jǐngchá", "cảnh sát"],
  ["求助", "qiúzhù", "cầu cứu, nhờ giúp đỡ"],
  ["天气预报", "tiānqì yùbào", "dự báo thời tiết"],
  ["当地人", "dāngdìrén", "người địa phương"],
].map(
  ([chinese, pinyin, meaningVi], index) =>
    ({
      chinese,
      pinyin,
      meaningVi,
      position: index + 1,
    }) satisfies TravelWord,
);

const generatedSchema = z.object({
  items: z.array(
    z.object({
      chinese: z.string().min(1),
      example_cn: z.string().min(2),
      example_pinyin: z.string().min(2),
      example_vi: z.string().min(2),
    }),
  ),
});

type GeneratedExample = z.infer<typeof generatedSchema>["items"][number];

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return new Map<string, GeneratedExample>();
  }

  const cached = generatedSchema.parse(
    JSON.parse(fs.readFileSync(cachePath, "utf8")),
  );
  return new Map(
    cached.items.map((item) => [
      item.chinese,
      {
        ...item,
        example_cn: item.example_cn.replace(/\s+/g, ""),
      },
    ]),
  );
}

function saveCache(examples: Map<string, GeneratedExample>) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ items: Array.from(examples.values()) }, null, 2),
    "utf8",
  );
}

function validateExamples(
  sourceWords: TravelWord[],
  response: z.infer<typeof generatedSchema>,
) {
  if (response.items.length !== sourceWords.length) {
    throw new Error(
      `Expected ${sourceWords.length} examples, received ${response.items.length}.`,
    );
  }

  const byChinese = new Map(
    response.items.map((item) => [item.chinese.trim(), item]),
  );

  return sourceWords.map((word) => {
    const item = byChinese.get(word.chinese);

    if (!item) {
      throw new Error(`Missing example for ${word.chinese}.`);
    }

    const exampleCn = item.example_cn.replace(/\s+/g, "");
    const examplePinyin = item.example_pinyin.trim();
    const exampleVi = item.example_vi.trim();

    if (!exampleCn.includes(word.chinese)) {
      throw new Error(
        `Example does not contain ${word.chinese}: ${exampleCn}`,
      );
    }

    if (!/[。！？]$/.test(exampleCn)) {
      throw new Error(`Missing Chinese punctuation: ${exampleCn}`);
    }

    if (!/[À-ỹĐđ]/u.test(exampleVi)) {
      throw new Error(`Vietnamese translation has no accents: ${exampleVi}`);
    }

    return {
      chinese: word.chinese,
      example_cn: exampleCn,
      example_pinyin: examplePinyin,
      example_vi: exampleVi,
    };
  });
}

async function generateBatch(
  openai: OpenAI,
  sourceWords: TravelWord[],
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "travel_vocabulary_examples",
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
              "Bạn là giáo viên tiếng Trung cho người Việt. Với mỗi từ du lịch, hãy viết một câu tiếng Trung tự nhiên trong tình huống du lịch thực tế. Câu bắt buộc chứa nguyên văn từ mục tiêu, dài khoảng 8-20 chữ Hán và không dùng một khuôn câu lặp lại. example_pinyin phải là pinyin có dấu thanh đầy đủ cho cả câu. example_vi phải là bản dịch tiếng Việt tự nhiên, có dấu. Giữ nguyên trường chinese và thứ tự đầu vào.",
          },
          {
            role: "user",
            content: JSON.stringify(
              sourceWords.map((word) => ({
                chinese: word.chinese,
                pinyin: word.pinyin,
                meaning_vi: word.meaningVi,
              })),
            ),
          },
        ],
      });
      const content = completion.choices[0]?.message.content;

      if (!content) {
        throw new Error("OpenAI returned an empty response.");
      }

      return validateExamples(
        sourceWords,
        generatedSchema.parse(JSON.parse(content)),
      );
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }

      console.warn(
        `Retrying positions ${sourceWords[0].position}-${sourceWords.at(-1)?.position}:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw new Error("Unreachable generation state.");
}

async function buildCards() {
  if (words.length !== 100 || new Set(words.map((word) => word.chinese)).size !== 100) {
    throw new Error("Travel vocabulary must contain exactly 100 unique words.");
  }

  const cache = readCache();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 120_000,
  });

  for (let index = 0; index < words.length; index += batchSize) {
    const sourceBatch = words.slice(index, index + batchSize);
    const pendingWords = sourceBatch.filter((word) => !cache.has(word.chinese));

    if (pendingWords.length > 0) {
      const generated = await generateBatch(openai, pendingWords);
      generated.forEach((example) => cache.set(example.chinese, example));
      saveCache(cache);
      console.log(`Generated examples ${index + 1}-${index + sourceBatch.length}.`);
    }
  }

  async function createCard(word: TravelWord) {
    const example = cache.get(word.chinese);

    if (!example) {
      throw new Error(`Missing cached example for ${word.chinese}.`);
    }

    console.log(`[audio ${word.position}/100] ${word.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      getOrCreateTemplateSpeech(templateSlug, "word", word.chinese),
      getOrCreateTemplateSpeech(templateSlug, "sentence", example.example_cn),
    ]);

    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Could not create complete audio for ${word.chinese}.`);
    }

    return {
      ...word,
      exampleCn: example.example_cn,
      examplePinyin: example.example_pinyin,
      exampleVi: example.example_vi,
      wordAudioUrl,
      sentenceAudioUrl,
    } satisfies TravelCard;
  }

  const cards: TravelCard[] = [];

  for (let index = 0; index < words.length; index += audioConcurrency) {
    const completedCards = await Promise.all(
      words.slice(index, index + audioConcurrency).map(createCard),
    );
    cards.push(...completedCards);
  }

  return cards;
}

function buildMigration(cards: TravelCard[]) {
  const values = cards
    .map(
      (card) =>
        `    (${[
          card.chinese,
          card.pinyin,
          card.meaningVi,
          card.exampleCn,
          card.examplePinyin,
          card.exampleVi,
          card.wordAudioUrl,
          card.sentenceAudioUrl,
        ]
          .map(sqlLiteral)
          .join(", ")}, ${card.position})`,
    )
    .join(",\n");

  return `-- Add a reusable 100-word Chinese travel deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  'Du lịch tiếng Trung - 100 từ',
  '100 từ vựng tiếng Trung thiết yếu khi đi du lịch: sân bay, phương tiện, khách sạn, tham quan, thanh toán và tình huống khẩn cấp. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ và audio tạo sẵn.',
  'Du lịch'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id
  from public.template_decks
  where slug = '${templateSlug}'
)
insert into public.template_cards (
  template_deck_id,
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url,
  position
)
select
  target_deck.id,
  card.chinese,
  card.pinyin,
  card.meaning_vi,
  card.example_cn,
  card.example_pinyin,
  card.example_vi,
  card.word_audio_url,
  card.sentence_audio_url,
  card.position
from target_deck
cross join (
  values
${values}
) as card(
  chinese,
  pinyin,
  meaning_vi,
  example_cn,
  example_pinyin,
  example_vi,
  word_audio_url,
  sentence_audio_url,
  position
)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  example_cn = excluded.example_cn,
  example_pinyin = excluded.example_pinyin,
  example_vi = excluded.example_vi,
  word_audio_url = excluded.word_audio_url,
  sentence_audio_url = excluded.sentence_audio_url,
  position = excluded.position;
`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const cards = await buildCards();
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  console.log(`Created ${outputPath} with ${cards.length} complete cards.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
