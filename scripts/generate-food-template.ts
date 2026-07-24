import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateTemplateSpeech } from "@/lib/tts";

loadEnvConfig(process.cwd());

type CategorySpec = {
  id: string;
  name: string;
  count: number;
  scope: string;
  requiredTopics: string[];
};

type GeneratedCard = {
  category: string;
  chinese: string;
  pinyin: string;
  meaning_vi: string;
  example_cn: string;
  example_pinyin: string;
  example_vi: string;
};

type FoodCard = GeneratedCard & {
  position: number;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const templateSlug = "am-thuc-goi-mon-200";
const outputPath = "supabase/migrations/041_food_ordering_200_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  "tiengtrunghihi-food-ordering-200-cards.json",
);
const expectedTotal = 200;
const audioConcurrency = 3;

const categories: CategorySpec[] = [
  {
    id: "restaurant-ordering",
    name: "Nhà hàng và gọi món",
    count: 25,
    scope:
      "Đặt bàn, vào nhà hàng, xem thực đơn, gọi món, thêm món, đổi món và hỏi nhân viên phục vụ.",
    requiredTopics: [
      "nhà hàng",
      "đặt bàn",
      "bàn trống",
      "thực đơn",
      "gọi món",
      "món đặc biệt",
      "món chính",
      "món phụ",
      "khẩu phần",
      "thêm món",
      "đổi món",
      "nhân viên phục vụ",
    ],
  },
  {
    id: "basic-ingredients",
    name: "Nguyên liệu cơ bản",
    count: 25,
    scope:
      "Lương thực, dầu, trứng, sữa, đậu, bột và các nguyên liệu nền phổ biến trong bếp và món ăn.",
    requiredTopics: [
      "gạo",
      "mì",
      "bột mì",
      "trứng",
      "sữa",
      "đậu phụ",
      "dầu ăn",
      "bơ",
      "đường",
      "muối",
      "tỏi",
      "gừng",
      "hành",
    ],
  },
  {
    id: "meat-seafood-produce",
    name: "Thịt, hải sản, rau và trái cây",
    count: 25,
    scope:
      "Các loại thịt, cá, hải sản, rau, nấm và trái cây thường được gọi hoặc hỏi trong nhà hàng.",
    requiredTopics: [
      "thịt bò",
      "thịt heo",
      "thịt gà",
      "vịt",
      "cá",
      "tôm",
      "cua",
      "mực",
      "hải sản",
      "rau xanh",
      "nấm",
      "khoai tây",
      "trái cây",
    ],
  },
  {
    id: "flavors-seasonings",
    name: "Khẩu vị và gia vị",
    count: 25,
    scope:
      "Vị cay, ngọt, chua, mặn, đắng, thanh, đậm, thơm và các gia vị dùng để điều chỉnh món ăn.",
    requiredTopics: [
      "cay",
      "ít cay",
      "không cay",
      "ngọt",
      "chua",
      "mặn",
      "nhạt",
      "đắng",
      "thơm",
      "đậm vị",
      "nước tương",
      "giấm",
      "tiêu",
      "ớt",
    ],
  },
  {
    id: "cooking-methods",
    name: "Cách chế biến và độ chín",
    count: 25,
    scope:
      "Các phương pháp nấu, thao tác sơ chế, nhiệt độ và mức độ chín của món ăn.",
    requiredTopics: [
      "xào",
      "chiên",
      "rán",
      "luộc",
      "hấp",
      "nướng",
      "hầm",
      "kho",
      "trộn",
      "cắt lát",
      "bóc vỏ",
      "chín kỹ",
      "tái",
      "nóng",
    ],
  },
  {
    id: "dishes-drinks",
    name: "Món ăn và đồ uống",
    count: 25,
    scope:
      "Tên nhóm món và đồ uống thông dụng để người học có thể đọc thực đơn và gọi món thực tế.",
    requiredTopics: [
      "cơm",
      "cơm chiên",
      "mì",
      "mì nước",
      "cháo",
      "súp",
      "lẩu",
      "salad",
      "bánh bao",
      "món tráng miệng",
      "trà",
      "cà phê",
      "nước ép",
      "bia",
    ],
  },
  {
    id: "allergies-diet",
    name: "Dị ứng và chế độ ăn",
    count: 25,
    scope:
      "Dị ứng thực phẩm, nguyên liệu cần tránh và yêu cầu ăn chay, ít đường, ít muối hoặc không chứa chất cụ thể.",
    requiredTopics: [
      "dị ứng",
      "dị ứng đậu phộng",
      "dị ứng hải sản",
      "không dung nạp lactose",
      "không gluten",
      "ăn chay",
      "thuần chay",
      "ít đường",
      "ít muối",
      "ít dầu",
      "không hành",
      "không rau mùi",
      "thành phần",
      "chất gây dị ứng",
    ],
  },
  {
    id: "service-billing",
    name: "Phục vụ, thanh toán và mang về",
    count: 25,
    scope:
      "Gọi phục vụ, yêu cầu dụng cụ, phản hồi món, đóng gói mang về, giao đồ ăn, hóa đơn và thanh toán.",
    requiredTopics: [
      "đũa",
      "thìa",
      "bát",
      "đĩa",
      "khăn giấy",
      "nước lọc",
      "mang về",
      "đóng gói",
      "giao đồ ăn",
      "hóa đơn",
      "chia hóa đơn",
      "thanh toán",
      "tiền boa",
      "phàn nàn",
    ],
  },
];

const responseSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().min(1),
      chinese: z.string().min(1),
      pinyin: z.string().min(1),
      meaning_vi: z.string().min(1),
      example_cn: z.string().min(2),
      example_pinyin: z.string().min(2),
      example_vi: z.string().min(2),
    }),
  ),
});

const dataCorrections: Record<string, Partial<GeneratedCard>> = {
  主菜: {
    pinyin: "zhǔcài",
    example_cn: "请问今天有什么主菜推荐？",
    example_pinyin: "Qǐngwèn jīntiān yǒu shénme zhǔcài tuījiàn?",
    example_vi: "Xin hỏi hôm nay có món chính nào được đề xuất?",
  },
  叫座率: {
    chinese: "等位",
    pinyin: "děngwèi",
    meaning_vi: "chờ bàn",
    example_cn: "周末来这家餐厅通常需要等位。",
    example_pinyin:
      "Zhōumò lái zhè jiā cāntīng tōngcháng xūyào děngwèi.",
    example_vi: "Cuối tuần đến nhà hàng này thường phải chờ bàn.",
  },
  少量: {
    chinese: "用餐人数",
    pinyin: "yòngcān rénshù",
    meaning_vi: "số người dùng bữa",
    example_cn: "请告诉我用餐人数，我来安排座位。",
    example_pinyin:
      "Qǐng gàosu wǒ yòngcān rénshù, wǒ lái ānpái zuòwèi.",
    example_vi: "Vui lòng cho tôi biết số người dùng bữa để tôi xếp chỗ.",
  },
  洋葱: {
    pinyin: "yángcōng",
    meaning_vi: "hành tây",
    example_vi:
      "Món này có hành tây nên khi ăn có thể cảm nhận vị cay nhẹ.",
  },
  奶油: {
    pinyin: "nǎiyóu",
    meaning_vi: "kem sữa",
    example_vi:
      "Món tráng miệng này có kem sữa, người dị ứng sản phẩm từ sữa cần thận trọng.",
  },
  生蚝: {
    pinyin: "shēngháo",
    meaning_vi: "hàu",
    example_vi:
      "Hàu phải thật tươi, nếu không rất dễ gây ngộ độc thực phẩm.",
  },
  油麦菜: {
    pinyin: "yóumàicài",
    meaning_vi: "rau diếp thơm",
    example_vi:
      "Rau diếp thơm xào thanh là món tôi thích, vừa đơn giản vừa tốt cho sức khỏe.",
  },
  辣味: {
    chinese: "酸",
    pinyin: "suān",
    meaning_vi: "chua",
    example_cn: "这道汤有一点酸，喝起来很开胃。",
    example_pinyin:
      "Zhè dào tāng yǒu yìdiǎn suān, hē qǐlái hěn kāiwèi.",
    example_vi: "Món canh này hơi chua, uống rất kích thích vị giác.",
  },
  烤箱烤: {
    chinese: "炒",
    pinyin: "chǎo",
    meaning_vi: "xào",
    example_cn: "厨师用大火炒青菜，保持清脆口感。",
    example_pinyin:
      "Chúshī yòng dàhuǒ chǎo qīngcài, bǎochí qīngcuì kǒugǎn.",
    example_vi:
      "Đầu bếp xào rau trên lửa lớn để giữ độ giòn.",
  },
  五成熟: {
    pinyin: "wǔ chéngshú",
    meaning_vi: "chín vừa",
    example_vi:
      "Vui lòng làm thịt bò chín vừa để vẫn giữ được độ mềm.",
  },
  焯水: {
    pinyin: "chāoshuǐ",
    meaning_vi: "chần sơ",
    example_vi:
      "Sau khi chần sơ, rau sẽ xanh hơn và trông tươi hơn.",
  },
  焖: {
    pinyin: "mèn",
    meaning_vi: "om, hầm kín",
    example_vi:
      "Cá kho cần được chiên trước rồi om thì hương vị mới ngon hơn.",
  },
  芥末: {
    pinyin: "jièmo",
  },
  冻酸奶: {
    chinese: "甜点",
    pinyin: "tiándiǎn",
    meaning_vi: "món tráng miệng",
    example_cn: "吃完主菜以后，我们点了一份甜点。",
    example_pinyin:
      "Chī wán zhǔcài yǐhòu, wǒmen diǎn le yí fèn tiándiǎn.",
    example_vi:
      "Sau khi ăn món chính, chúng tôi gọi một phần tráng miệng.",
  },
  粥品: {
    chinese: "米饭",
    pinyin: "mǐfàn",
    meaning_vi: "cơm",
    example_cn: "请给我一碗米饭，配这道红烧肉。",
    example_pinyin:
      "Qǐng gěi wǒ yì wǎn mǐfàn, pèi zhè dào hóngshāoròu.",
    example_vi: "Cho tôi một bát cơm để ăn cùng món thịt kho này.",
  },
  豆沙包: {
    chinese: "饺子",
    pinyin: "jiǎozi",
    meaning_vi: "sủi cảo",
    example_cn: "这家店的猪肉白菜饺子很受欢迎。",
    example_pinyin:
      "Zhè jiā diàn de zhūròu báicài jiǎozi hěn shòu huānyíng.",
    example_vi:
      "Sủi cảo nhân thịt heo và cải thảo của quán này rất được yêu thích.",
  },
  水果甜点: {
    chinese: "冰淇淋",
    pinyin: "bīngqílín",
    meaning_vi: "món kem lạnh",
    example_cn: "孩子想在饭后吃一份香草冰淇淋。",
    example_pinyin:
      "Háizi xiǎng zài fànhòu chī yí fèn xiāngcǎo bīngqílín.",
    example_vi: "Đứa trẻ muốn ăn một phần kem vani sau bữa cơm.",
  },
  鲜榨苹果汁: {
    chinese: "啤酒",
    pinyin: "píjiǔ",
    meaning_vi: "bia",
    example_cn: "请给我一瓶冰啤酒，不要加冰块。",
    example_pinyin:
      "Qǐng gěi wǒ yì píng bīng píjiǔ, bú yào jiā bīngkuài.",
    example_vi: "Cho tôi một chai bia lạnh, không cần thêm đá.",
  },
  现榨果汁: {
    chinese: "矿泉水",
    pinyin: "kuàngquánshuǐ",
    meaning_vi: "nước khoáng",
    example_cn: "请给我一瓶常温矿泉水。",
    example_pinyin: "Qǐng gěi wǒ yì píng chángwēn kuàngquánshuǐ.",
    example_vi: "Vui lòng cho tôi một chai nước khoáng ở nhiệt độ thường.",
  },
  指定无辣: {
    chinese: "不含鸡蛋",
    pinyin: "bù hán jīdàn",
    meaning_vi: "không chứa trứng",
    example_cn: "孩子对鸡蛋过敏，请做一份不含鸡蛋的餐。",
    example_pinyin:
      "Háizi duì jīdàn guòmǐn, qǐng zuò yí fèn bù hán jīdàn de cān.",
    example_vi:
      "Đứa trẻ dị ứng với trứng, vui lòng làm một phần ăn không chứa trứng.",
  },
  无葱: {
    chinese: "坚果过敏",
    pinyin: "jiānguǒ guòmǐn",
    meaning_vi: "dị ứng với các loại hạt",
    example_cn: "我有坚果过敏，请确认甜点里没有坚果。",
    example_pinyin:
      "Wǒ yǒu jiānguǒ guòmǐn, qǐng quèrèn tiándiǎn lǐ méiyǒu jiānguǒ.",
    example_vi:
      "Tôi dị ứng với các loại hạt, vui lòng xác nhận món tráng miệng không có hạt.",
  },
  餐盒: {
    chinese: "吸管",
    pinyin: "xīguǎn",
    meaning_vi: "ống hút",
    example_cn: "这杯果汁不用塑料吸管。",
    example_pinyin: "Zhè bēi guǒzhī bú yòng sùliào xīguǎn.",
    example_vi: "Ly nước ép này không cần ống hút nhựa.",
  },
  结账单: {
    chinese: "收据",
    pinyin: "shōujù",
    meaning_vi: "biên lai",
    example_cn: "结账以后请把收据给我。",
    example_pinyin: "Jiézhàng yǐhòu qǐng bǎ shōujù gěi wǒ.",
    example_vi: "Sau khi thanh toán, vui lòng đưa biên lai cho tôi.",
  },
};

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function hasToneMark(value: string) {
  return /[\u0300\u0301\u0304\u030c]/u.test(value.normalize("NFD"));
}

function hasVietnameseAccent(value: string) {
  return (
    /[\u0300-\u036f]/u.test(value.normalize("NFD")) ||
    /[\u0110\u0111]/u.test(value)
  );
}

function normalizeCard(card: GeneratedCard): GeneratedCard {
  const normalized = {
    category: card.category.trim(),
    chinese: card.chinese.replace(/\s+/g, ""),
    pinyin: card.pinyin.trim().replace(/\s+/g, " "),
    meaning_vi: card.meaning_vi.trim(),
    example_cn: card.example_cn.replace(/\s+/g, ""),
    example_pinyin: card.example_pinyin.trim().replace(/\s+/g, " "),
    example_vi: card.example_vi.trim(),
  };
  return {
    ...normalized,
    ...dataCorrections[normalized.chinese],
  };
}

function rejectionReason(
  card: GeneratedCard,
  forbiddenWords: Set<string>,
  collectedWords: Set<string>,
) {
  if (forbiddenWords.has(card.chinese)) {
    return "từ đã xuất hiện ở nhóm khác";
  }
  if (collectedWords.has(card.chinese)) {
    return "từ bị trùng trong nhóm";
  }
  if (!hasToneMark(card.pinyin)) {
    return "pinyin của từ chưa có dấu thanh";
  }
  if (!card.example_cn.includes(card.chinese)) {
    return "câu ví dụ không chứa nguyên văn từ mục tiêu";
  }
  if (!/[\u3002\uff01\uff1f]$/u.test(card.example_cn)) {
    return "câu ví dụ thiếu dấu câu tiếng Trung";
  }
  if (!hasToneMark(card.example_pinyin)) {
    return "pinyin của câu chưa có dấu thanh";
  }
  if (!hasVietnameseAccent(card.meaning_vi)) {
    return "nghĩa tiếng Việt chưa có dấu";
  }
  if (!hasVietnameseAccent(card.example_vi)) {
    return "câu tiếng Việt chưa có dấu";
  }
  return null;
}

function validateCategory(
  spec: CategorySpec,
  cards: GeneratedCard[],
  excludedWords: Set<string>,
) {
  if (cards.length !== spec.count) {
    throw new Error(
      `${spec.name}: cần ${spec.count} thẻ, hiện có ${cards.length}.`,
    );
  }

  const normalized = cards.map((card) => ({
    ...normalizeCard(card),
    category: spec.id,
  }));
  const collectedWords = new Set<string>();

  for (const card of normalized) {
    const reason = rejectionReason(card, excludedWords, collectedWords);
    if (reason) {
      throw new Error(`${spec.name} - ${card.chinese}: ${reason}.`);
    }
    collectedWords.add(card.chinese);
  }

  if (new Set(normalized.map((card) => card.example_cn)).size !== spec.count) {
    throw new Error(`${spec.name}: câu ví dụ phải khác nhau.`);
  }

  return normalized;
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return [] satisfies GeneratedCard[];
  }
  const parsed = responseSchema.parse(
    JSON.parse(fs.readFileSync(cachePath, "utf8")),
  );
  return parsed.items.map(normalizeCard);
}

function saveCache(cards: GeneratedCard[]) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ items: cards }, null, 2),
    "utf8",
  );
}

async function generateCategory(
  openai: OpenAI,
  spec: CategorySpec,
  excludedWords: string[],
) {
  const collected = new Map<string, GeneratedCard>();
  const forbiddenWords = new Set(excludedWords);

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const remaining = spec.count - collected.size;
    if (remaining <= 0) {
      break;
    }

    const requestCount = remaining <= 5 ? 6 : Math.min(remaining + 3, 28);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "food_ordering_vocabulary_cards",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items"],
            properties: {
              items: {
                type: "array",
                minItems: requestCount,
                maxItems: requestCount,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "category",
                    "chinese",
                    "pinyin",
                    "meaning_vi",
                    "example_cn",
                    "example_pinyin",
                    "example_vi",
                  ],
                  properties: {
                    category: { type: "string" },
                    chinese: { type: "string" },
                    pinyin: { type: "string" },
                    meaning_vi: { type: "string" },
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
            "Bạn là giáo viên tiếng Trung chuyên ngành ẩm thực và nhà hàng cho người Việt. Hãy tạo từ vựng tiếng Trung giản thể thực tế để ăn uống, gọi món và giao tiếp nhà hàng. Mỗi mục là một từ hoặc cụm từ hữu ích, không phải cả câu. Pinyin của từ và câu phải có đầy đủ dấu thanh, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu. Câu ví dụ dài khoảng 8-24 chữ Hán, chứa nguyên văn từ mục tiêu, kết thúc bằng dấu câu tiếng Trung và mô tả tình huống ăn uống cụ thể. Dữ liệu về dị ứng phải rõ ràng, không gây hiểu nhầm nguy hiểm. Các câu phải đa dạng, không lặp công thức. Không tạo từ đồng nghĩa gần như trùng hẳn với mục đã bị cấm. Giữ category đúng id được yêu cầu.",
        },
        {
          role: "user",
          content: JSON.stringify({
            attempt,
            category_id: spec.id,
            category_name: spec.name,
            exact_count: requestCount,
            valid_items_still_needed: remaining,
            scope: spec.scope,
            topics_that_must_be_well_represented: spec.requiredTopics,
            forbidden_duplicate_chinese_words: [
              ...excludedWords,
              ...collected.keys(),
            ],
          }),
        },
      ],
    });
    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error(`OpenAI không trả dữ liệu cho nhóm ${spec.name}.`);
    }

    const response = responseSchema.parse(JSON.parse(content));
    for (const rawCard of response.items) {
      if (collected.size >= spec.count) {
        break;
      }

      const card = { ...normalizeCard(rawCard), category: spec.id };
      const reason = rejectionReason(
        card,
        forbiddenWords,
        new Set(collected.keys()),
      );
      if (reason) {
        console.warn(`[data] Bỏ ${card.chinese || "(trống)"}: ${reason}.`);
        continue;
      }
      collected.set(card.chinese, card);
    }

    console.log(
      `[data] ${spec.name}: ${collected.size}/${spec.count} thẻ hợp lệ.`,
    );
    if (collected.size < spec.count) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  return validateCategory(
    spec,
    Array.from(collected.values()),
    forbiddenWords,
  );
}

async function buildVocabulary() {
  const total = categories.reduce(
    (sum, category) => sum + category.count,
    0,
  );
  if (total !== expectedTotal) {
    throw new Error(`Các nhóm phải có tổng ${expectedTotal} thẻ, hiện là ${total}.`);
  }

  let cached = readCache();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 180_000,
  });

  for (const spec of categories) {
    const categoryCards = cached.filter((card) => card.category === spec.id);
    const otherCards = cached.filter((card) => card.category !== spec.id);
    const excludedWords = new Set(otherCards.map((card) => card.chinese));

    try {
      validateCategory(spec, categoryCards, excludedWords);
      console.log(`[data] Dùng cache ${spec.name}: ${spec.count} thẻ.`);
      continue;
    } catch {
      cached = otherCards;
    }

    const generated = await generateCategory(
      openai,
      spec,
      cached.map((card) => card.chinese),
    );
    cached.push(...generated);
    saveCache(cached);
  }

  const ordered = categories.flatMap((spec) =>
    cached.filter((card) => card.category === spec.id),
  );
  if (
    ordered.length !== expectedTotal ||
    new Set(ordered.map((card) => card.chinese)).size !== expectedTotal ||
    new Set(ordered.map((card) => card.example_cn)).size !== expectedTotal
  ) {
    throw new Error(
      `Bộ ẩm thực phải có đúng ${expectedTotal} từ và câu ví dụ duy nhất.`,
    );
  }
  return ordered;
}

async function createAudioWithRetry(
  kind: "word" | "sentence",
  text: string,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await getOrCreateTemplateSpeech(templateSlug, kind, text);
    } catch (error) {
      lastError = error;
      console.warn(
        `[audio] Thử lại ${kind} lần ${attempt}/4 cho: ${text}`,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError;
}

async function buildCards(vocabulary: GeneratedCard[]) {
  async function createCard(card: GeneratedCard, index: number) {
    const position = index + 1;
    console.log(`[audio ${position}/${expectedTotal}] ${card.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      createAudioWithRetry("word", card.chinese),
      createAudioWithRetry("sentence", card.example_cn),
    ]);
    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Không tạo đủ hai audio cho ${card.chinese}.`);
    }
    return {
      ...card,
      position,
      wordAudioUrl,
      sentenceAudioUrl,
    } satisfies FoodCard;
  }

  const cards: FoodCard[] = [];
  for (
    let index = 0;
    index < vocabulary.length;
    index += audioConcurrency
  ) {
    cards.push(
      ...(await Promise.all(
        vocabulary
          .slice(index, index + audioConcurrency)
          .map((card, offset) => createCard(card, index + offset)),
      )),
    );
  }
  return cards;
}

function buildMigration(cards: FoodCard[]) {
  const values = cards
    .map(
      (card) =>
        `    (${[
          card.chinese,
          card.pinyin,
          card.meaning_vi,
          card.example_cn,
          card.example_pinyin,
          card.example_vi,
          card.wordAudioUrl,
          card.sentenceAudioUrl,
        ]
          .map(sqlLiteral)
          .join(", ")}, ${card.position})`,
    )
    .join(",\n");
  const activeWords = cards
    .map((card) => sqlLiteral(card.chinese))
    .join(", ");

  return `-- Add a reusable 200-word food and restaurant deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  'Ẩm thực và gọi món - 200 từ',
  '200 từ vựng tiếng Trung thực tế về nguyên liệu, món ăn, khẩu vị, gia vị, cách chế biến, dị ứng thực phẩm và giao tiếp nhà hàng. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.',
  'Ẩm thực'
)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = '${templateSlug}'
)
insert into public.template_cards (
  template_deck_id, chinese, pinyin, meaning_vi, example_cn,
  example_pinyin, example_vi, word_audio_url, sentence_audio_url, position
)
select
  target_deck.id, card.chinese, card.pinyin, card.meaning_vi,
  card.example_cn, card.example_pinyin, card.example_vi,
  card.word_audio_url, card.sentence_audio_url, card.position
from target_deck
cross join (
  values
${values}
) as card(
  chinese, pinyin, meaning_vi, example_cn, example_pinyin,
  example_vi, word_audio_url, sentence_audio_url, position
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

delete from public.template_cards
where template_deck_id = (
  select id from public.template_decks where slug = '${templateSlug}'
)
and chinese not in (${activeWords});
`;
}

async function syncTemplate(cards: FoodCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: "Ẩm thực và gọi món - 200 từ",
        description:
          "200 từ vựng tiếng Trung thực tế về nguyên liệu, món ăn, khẩu vị, gia vị, cách chế biến, dị ứng thực phẩm và giao tiếp nhà hàng. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.",
        level: "Ẩm thực",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (deckError || !deck) {
    throw deckError || new Error("Không thể tạo bộ thẻ mẫu.");
  }

  const rows = cards.map((card) => ({
    template_deck_id: deck.id,
    chinese: card.chinese,
    pinyin: card.pinyin,
    meaning_vi: card.meaning_vi,
    example_cn: card.example_cn,
    example_pinyin: card.example_pinyin,
    example_vi: card.example_vi,
    word_audio_url: card.wordAudioUrl,
    sentence_audio_url: card.sentenceAudioUrl,
    position: card.position,
  }));

  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await supabase
      .from("template_cards")
      .upsert(rows.slice(index, index + 50), {
        onConflict: "template_deck_id,chinese",
      });
    if (error) {
      throw error;
    }
  }

  const activeWords = new Set(cards.map((card) => card.chinese));
  const { data: existingCards, error: existingError } = await supabase
    .from("template_cards")
    .select("id,chinese")
    .eq("template_deck_id", deck.id);
  if (existingError) {
    throw existingError;
  }

  const staleCardIds = (existingCards || [])
    .filter((card) => !activeWords.has(card.chinese))
    .map((card) => card.id);
  if (staleCardIds.length > 0) {
    const { error } = await supabase
      .from("template_cards")
      .delete()
      .in("id", staleCardIds);
    if (error) {
      throw error;
    }
  }

  const { count, error: countError } = await supabase
    .from("template_cards")
    .select("id", { count: "exact", head: true })
    .eq("template_deck_id", deck.id);
  if (countError) {
    throw countError;
  }
  if (count !== expectedTotal) {
    throw new Error(
      `Supabase cần có ${expectedTotal} thẻ, hiện đang có ${count ?? 0}.`,
    );
  }

  const activeAudioFiles = new Set(
    cards.flatMap((card) => [
      new URL(card.wordAudioUrl).pathname.split("/").at(-1),
      new URL(card.sentenceAudioUrl).pathname.split("/").at(-1),
    ]),
  );
  const audioFolder = `templates/${templateSlug}`;
  const { data: storedAudio, error: storageError } = await supabase.storage
    .from("card-audio")
    .list(audioFolder, { limit: 1000 });
  if (storageError) {
    throw storageError;
  }

  const staleAudioPaths = (storedAudio || [])
    .filter((file) => !activeAudioFiles.has(file.name))
    .map((file) => `${audioFolder}/${file.name}`);
  if (staleAudioPaths.length > 0) {
    const { error } = await supabase.storage
      .from("card-audio")
      .remove(staleAudioPaths);
    if (error) {
      throw error;
    }
  }

  console.log(
    `[sync] Đã đồng bộ ${count} thẻ; dọn ${staleCardIds.length} thẻ và ${staleAudioPaths.length} audio cũ.`,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  const vocabulary = await buildVocabulary();
  const cards = await buildCards(vocabulary);
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  await syncTemplate(cards);
  console.log(`Đã tạo ${outputPath} với ${cards.length} thẻ đầy đủ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
