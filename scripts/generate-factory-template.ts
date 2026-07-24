import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
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

type FactoryCard = GeneratedCard & {
  position: number;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const templateSlug = "nha-may-xuong-300";
const outputPath = "supabase/migrations/039_factory_300_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  "tiengtrunghihi-factory-300-cards.json",
);
const audioConcurrency = 3;

const categories: CategorySpec[] = [
  {
    id: "workforce",
    name: "Nhân sự và tổ chức trong xưởng",
    count: 25,
    scope:
      "Chức danh, bộ phận, vai trò và quan hệ công việc thường gặp trong nhà máy.",
    requiredTopics: [
      "công nhân",
      "tổ trưởng",
      "quản đốc",
      "kỹ sư",
      "kỹ thuật viên",
      "nhân viên kiểm tra chất lượng",
      "bộ phận sản xuất",
      "bộ phận kỹ thuật",
      "ca trưởng",
      "nhân viên mới",
    ],
  },
  {
    id: "factory",
    name: "Nhà xưởng và dây chuyền",
    count: 25,
    scope:
      "Khu vực nhà máy, dây chuyền, trạm làm việc và cơ sở hạ tầng sản xuất.",
    requiredTopics: [
      "nhà máy",
      "xưởng",
      "dây chuyền sản xuất",
      "khu vực làm việc",
      "trạm làm việc",
      "phòng sạch",
      "kho nguyên liệu",
      "kho thành phẩm",
      "lối thoát hiểm",
      "bảng điều khiển",
    ],
  },
  {
    id: "machinery",
    name: "Máy móc và thiết bị",
    count: 35,
    scope:
      "Máy sản xuất, thiết bị tự động hóa và bộ phận máy thường dùng trong nhiều ngành.",
    requiredTopics: [
      "máy móc",
      "thiết bị",
      "động cơ",
      "băng tải",
      "robot công nghiệp",
      "máy ép",
      "máy cắt",
      "máy hàn",
      "máy đóng gói",
      "cảm biến",
      "khuôn",
      "công tắc",
      "van",
      "trục",
      "vòng bi",
    ],
  },
  {
    id: "tools-materials",
    name: "Dụng cụ, linh kiện và vật liệu",
    count: 30,
    scope:
      "Dụng cụ cầm tay, chi tiết máy, vật tư tiêu hao, nguyên liệu và bán thành phẩm.",
    requiredTopics: [
      "dụng cụ",
      "cờ lê",
      "tua vít",
      "kìm",
      "thước đo",
      "ốc vít",
      "linh kiện",
      "phụ tùng",
      "nguyên liệu",
      "bán thành phẩm",
      "thành phẩm",
      "dầu bôi trơn",
    ],
  },
  {
    id: "operations",
    name: "Thao tác và quy trình sản xuất",
    count: 35,
    scope:
      "Các động tác vận hành máy và các bước trong quy trình sản xuất hằng ngày.",
    requiredTopics: [
      "khởi động máy",
      "tắt máy",
      "vận hành",
      "lắp ráp",
      "gia công",
      "hàn",
      "cắt",
      "đóng gói",
      "dán nhãn",
      "điều chỉnh",
      "cài đặt thông số",
      "chạy thử",
      "sản xuất hàng loạt",
      "ghi chép sản lượng",
    ],
  },
  {
    id: "quality",
    name: "Chất lượng và kiểm tra",
    count: 35,
    scope:
      "Kiểm tra chất lượng, tiêu chuẩn, phép đo, mẫu kiểm tra và kết quả nghiệm thu.",
    requiredTopics: [
      "chất lượng",
      "kiểm tra",
      "tiêu chuẩn",
      "dung sai",
      "kích thước",
      "độ chính xác",
      "lấy mẫu",
      "kiểm tra ngoại quan",
      "đạt yêu cầu",
      "không đạt",
      "tỷ lệ đạt",
      "báo cáo kiểm tra",
      "truy xuất nguồn gốc",
    ],
  },
  {
    id: "defects-maintenance",
    name: "Lỗi sản phẩm, sự cố và bảo trì",
    count: 35,
    scope:
      "Tên lỗi phổ biến, hiện tượng bất thường, xử lý sự cố, sửa chữa và bảo dưỡng.",
    requiredTopics: [
      "sản phẩm lỗi",
      "vết nứt",
      "trầy xước",
      "biến dạng",
      "thiếu linh kiện",
      "lắp sai",
      "rò rỉ",
      "quá nhiệt",
      "tiếng ồn bất thường",
      "máy dừng",
      "hỏng hóc",
      "sửa chữa",
      "bảo trì",
      "bảo dưỡng định kỳ",
      "thay thế phụ tùng",
    ],
  },
  {
    id: "safety",
    name: "An toàn lao động và ứng phó khẩn cấp",
    count: 30,
    scope:
      "Quy định an toàn, bảo hộ cá nhân, cảnh báo nguy hiểm và xử lý tai nạn trong xưởng.",
    requiredTopics: [
      "an toàn lao động",
      "mũ bảo hộ",
      "kính bảo hộ",
      "găng tay",
      "giày bảo hộ",
      "nút dừng khẩn cấp",
      "biển cảnh báo",
      "nguy hiểm",
      "điện giật",
      "cháy",
      "bình chữa cháy",
      "sơ cứu",
      "tai nạn lao động",
      "báo cáo sự cố",
    ],
  },
  {
    id: "warehouse-logistics",
    name: "Kho, đóng gói và logistics nội bộ",
    count: 25,
    scope:
      "Nhập xuất kho, tồn kho, mã hàng, pallet, xe nâng, vận chuyển và giao nhận nội bộ.",
    requiredTopics: [
      "nhập kho",
      "xuất kho",
      "tồn kho",
      "kiểm kê",
      "mã hàng",
      "mã vạch",
      "pallet",
      "xe nâng",
      "phiếu nhập kho",
      "phiếu xuất kho",
      "đóng thùng",
      "giao hàng",
    ],
  },
  {
    id: "instructions-shifts",
    name: "Chỉ dẫn công việc, ca làm và giao tiếp",
    count: 25,
    scope:
      "Mệnh lệnh, báo cáo tiến độ, bàn giao ca, năng suất và giao tiếp thực tế trong xưởng.",
    requiredTopics: [
      "ca ngày",
      "ca đêm",
      "đổi ca",
      "bàn giao ca",
      "tăng ca",
      "nghỉ giải lao",
      "hướng dẫn công việc",
      "quy trình thao tác chuẩn",
      "kế hoạch sản xuất",
      "tiến độ",
      "sản lượng",
      "năng suất",
      "hoàn thành đúng hạn",
    ],
  },
];

const generatedSchema = z.object({
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

const toneMarkPattern =
  /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]/u;
const vietnameseAccentPattern = /[À-ỹĐđ]/u;

const dataCorrections: Record<string, Partial<GeneratedCard>> = {
  原材料仓库: {
    pinyin: "yuáncáiliào cāngkù",
  },
  电烙铁: {
    pinyin: "diàn làotiě",
    example_pinyin:
      "Diànzǐ zǔzhuāng gōng shǐyòng diàn làotiě hànjiē diànlùbǎn.",
  },
  轴承磨损: {
    pinyin: "zhóuchéng mósǔn",
    meaning_vi: "ổ bi bị mòn",
    example_pinyin:
      "Zhóuchéng mósǔn yánzhòng, xūyào gēnghuàn xīn de cáinéng jìxù shǐyòng.",
  },
  标准作业流程: {
    pinyin: "biāozhǔn zuòyè liúchéng",
    example_pinyin:
      "Suǒyǒu yuángōng bìxū yángé zūnshǒu biāozhǔn zuòyè liúchéng bǎozhèng chǎnpǐn zhìliàng.",
  },
};

const fallbackCards: Record<string, GeneratedCard[]> = {
  "tools-materials": [
    {
      category: "tools-materials",
      chinese: "六角扳手",
      pinyin: "liùjiǎo bānshǒu",
      meaning_vi: "khóa lục giác",
      example_cn: "维修人员用六角扳手拧紧机器上的螺栓。",
      example_pinyin:
        "Wéixiū rényuán yòng liùjiǎo bānshǒu nǐngjǐn jīqì shàng de luóshuān.",
      example_vi:
        "Nhân viên bảo trì dùng khóa lục giác để siết chặt bu lông trên máy.",
    },
    {
      category: "tools-materials",
      chinese: "热熔胶枪",
      pinyin: "rèróngjiāo qiāng",
      meaning_vi: "súng bắn keo nóng",
      example_cn: "工人使用热熔胶枪固定包装盒里的零件。",
      example_pinyin:
        "Gōngrén shǐyòng rèróngjiāo qiāng gùdìng bāozhuānghé lǐ de língjiàn.",
      example_vi:
        "Công nhân dùng súng bắn keo nóng để cố định linh kiện trong hộp.",
    },
  ],
  operations: [
    {
      category: "operations",
      chinese: "预热设备",
      pinyin: "yùrè shèbèi",
      meaning_vi: "làm nóng thiết bị trước",
      example_cn: "正式生产前必须先预热设备十分钟。",
      example_pinyin:
        "Zhèngshì shēngchǎn qián bìxū xiān yùrè shèbèi shí fēnzhōng.",
      example_vi:
        "Trước khi sản xuất chính thức phải làm nóng thiết bị trước mười phút.",
    },
    {
      category: "operations",
      chinese: "校准参数",
      pinyin: "jiàozhǔn cānshù",
      meaning_vi: "hiệu chuẩn thông số",
      example_cn: "换线以后技术员需要重新校准参数。",
      example_pinyin:
        "Huànxiàn yǐhòu jìshùyuán xūyào chóngxīn jiàozhǔn cānshù.",
      example_vi:
        "Sau khi đổi dây chuyền, kỹ thuật viên cần hiệu chuẩn lại thông số.",
    },
    {
      category: "operations",
      chinese: "清洁工作台",
      pinyin: "qīngjié gōngzuòtái",
      meaning_vi: "vệ sinh bàn làm việc",
      example_cn: "每批产品完成后都要清洁工作台。",
      example_pinyin:
        "Měi pī chǎnpǐn wánchéng hòu dōu yào qīngjié gōngzuòtái.",
      example_vi:
        "Sau khi hoàn thành mỗi lô sản phẩm đều phải vệ sinh bàn làm việc.",
    },
    {
      category: "operations",
      chinese: "更换模具",
      pinyin: "gēnghuàn mújù",
      meaning_vi: "thay khuôn",
      example_cn: "生产新型号之前需要先更换模具。",
      example_pinyin:
        "Shēngchǎn xīn xínghào zhīqián xūyào xiān gēnghuàn mújù.",
      example_vi:
        "Trước khi sản xuất mẫu mới cần thay khuôn trước.",
    },
    {
      category: "operations",
      chinese: "投入原料",
      pinyin: "tóurù yuánliào",
      meaning_vi: "nạp nguyên liệu",
      example_cn: "确认配方无误后才能投入原料。",
      example_pinyin:
        "Quèrèn pèifāng wúwù hòu cáinéng tóurù yuánliào.",
      example_vi:
        "Chỉ được nạp nguyên liệu sau khi xác nhận công thức không có sai sót.",
    },
  ],
  "defects-maintenance": [
    {
      category: "defects-maintenance",
      chinese: "接触不良",
      pinyin: "jiēchù bùliáng",
      meaning_vi: "tiếp xúc kém",
      example_cn: "设备报警是因为连接器出现接触不良。",
      example_pinyin:
        "Shèbèi bàojǐng shì yīnwèi liánjiēqì chūxiàn jiēchù bùliáng.",
      example_vi:
        "Thiết bị báo lỗi vì đầu nối xuất hiện tình trạng tiếp xúc kém.",
    },
    {
      category: "defects-maintenance",
      chinese: "尺寸偏差",
      pinyin: "chǐcùn piānchā",
      meaning_vi: "sai lệch kích thước",
      example_cn: "这批零件存在尺寸偏差，暂时不能装配。",
      example_pinyin:
        "Zhè pī língjiàn cúnzài chǐcùn piānchā, zànshí bùnéng zhuāngpèi.",
      example_vi:
        "Lô linh kiện này bị sai lệch kích thước nên tạm thời chưa thể lắp ráp.",
    },
    {
      category: "defects-maintenance",
      chinese: "表面凹陷",
      pinyin: "biǎomiàn āoxiàn",
      meaning_vi: "bề mặt bị lõm",
      example_cn: "检验员发现外壳有明显的表面凹陷。",
      example_pinyin:
        "Jiǎnyànyuán fāxiàn wàiké yǒu míngxiǎn de biǎomiàn āoxiàn.",
      example_vi:
        "Nhân viên kiểm tra phát hiện vỏ ngoài có vết lõm bề mặt rõ ràng.",
    },
  ],
};

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
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

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return [] satisfies GeneratedCard[];
  }

  const parsed = generatedSchema.parse(
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

function validateCategory(
  spec: CategorySpec,
  cards: GeneratedCard[],
  excludedWords: Set<string>,
) {
  if (cards.length !== spec.count) {
    throw new Error(
      `${spec.name}: expected ${spec.count} cards, received ${cards.length}.`,
    );
  }

  const normalized = cards.map((card) => ({
    ...normalizeCard(card),
    category: spec.id,
  }));
  const localWords = new Set<string>();

  for (const card of normalized) {
    if (localWords.has(card.chinese) || excludedWords.has(card.chinese)) {
      throw new Error(`${spec.name}: duplicate word ${card.chinese}.`);
    }

    if (!toneMarkPattern.test(card.pinyin)) {
      throw new Error(`${card.chinese}: target pinyin has no tone marks.`);
    }

    if (!card.example_cn.includes(card.chinese)) {
      throw new Error(
        `${card.chinese}: example does not contain the target word.`,
      );
    }

    if (!/[。！？]$/u.test(card.example_cn)) {
      throw new Error(`${card.chinese}: example is missing Chinese punctuation.`);
    }

    if (!toneMarkPattern.test(card.example_pinyin)) {
      throw new Error(`${card.chinese}: example pinyin has no tone marks.`);
    }

    if (!vietnameseAccentPattern.test(card.example_vi)) {
      throw new Error(`${card.chinese}: Vietnamese text is missing accents.`);
    }

    localWords.add(card.chinese);
  }

  if (new Set(normalized.map((card) => card.example_cn)).size !== spec.count) {
    throw new Error(`${spec.name}: example sentences must be unique.`);
  }

  return normalized;
}

async function generateCategory(
  openai: OpenAI,
  spec: CategorySpec,
  excludedWords: string[],
) {
  const collected = new Map<string, GeneratedCard>();

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const remaining = spec.count - collected.size;

    if (remaining <= 0) {
      break;
    }

    const requestCount = remaining <= 5 ? 5 : remaining;

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "factory_vocabulary_cards",
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
              "Bạn là giáo viên tiếng Trung chuyên ngành sản xuất cho công nhân và kỹ sư người Việt. Hãy tạo đúng số lượng từ vựng tiếng Trung giản thể thực tế trong nhà máy. Mỗi mục phải là một từ hoặc cụm từ chuyên môn hữu ích, không phải cả câu. Pinyin của từ và của câu phải có dấu thanh đầy đủ. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu. Câu ví dụ phải dài khoảng 8-24 chữ Hán, chứa nguyên văn từ mục tiêu và mô tả một tình huống nhà xưởng cụ thể. Không dùng các câu chung chung lặp khuôn. Giữ category đúng id được yêu cầu.",
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
        throw new Error("OpenAI returned an empty response.");
      }

      const response = generatedSchema.parse(JSON.parse(content));
      const forbidden = new Set(excludedWords);

      for (const rawCard of response.items) {
        if (collected.size >= spec.count) {
          break;
        }

        const card = {
          ...normalizeCard(rawCard),
          category: spec.id,
        };
        const rejectionReason =
          (forbidden.has(card.chinese) && "already used in another category") ||
          (collected.has(card.chinese) && "duplicate in this category") ||
          (!toneMarkPattern.test(card.pinyin) &&
            "target pinyin has no tone marks") ||
          (!card.example_cn.includes(card.chinese) &&
            "example is missing the target word") ||
          (!/[。！？]$/u.test(card.example_cn) &&
            "example is missing Chinese punctuation") ||
          (!toneMarkPattern.test(card.example_pinyin) &&
            "example pinyin has no tone marks") ||
          (!vietnameseAccentPattern.test(card.example_vi) &&
            "Vietnamese example has no accents");

        if (rejectionReason) {
          console.warn(
            `[data] Skipped ${card.chinese || "(blank)"}: ${rejectionReason}.`,
          );
          continue;
        }

        collected.set(card.chinese, card);
      }

      console.log(
        `[data] ${spec.name}: collected ${collected.size}/${spec.count}.`,
      );

      if (
        collected.size < spec.count &&
        (fallbackCards[spec.id]?.length || 0) >= spec.count - collected.size
      ) {
        break;
      }
    } catch (error) {
      console.warn(
        `Retrying ${spec.id} (${attempt}/8):`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  for (const fallback of fallbackCards[spec.id] || []) {
    if (
      collected.size >= spec.count ||
      excludedWords.includes(fallback.chinese) ||
      collected.has(fallback.chinese)
    ) {
      continue;
    }

    collected.set(fallback.chinese, normalizeCard(fallback));
    console.log(`[data] Added fallback term ${fallback.chinese}.`);
  }

  return validateCategory(spec, Array.from(collected.values()), new Set(excludedWords));
}

async function buildVocabulary() {
  const expectedTotal = categories.reduce(
    (total, category) => total + category.count,
    0,
  );

  if (expectedTotal !== 300) {
    throw new Error(`Category counts must total 300, received ${expectedTotal}.`);
  }

  let cached = readCache();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 180_000,
  });

  for (const spec of categories) {
    const cachedCategory = cached.filter((card) => card.category === spec.id);
    const cardsOutsideCategory = cached.filter(
      (card) => card.category !== spec.id,
    );
    const excludedWords = new Set(
      cardsOutsideCategory.map((card) => card.chinese),
    );

    try {
      validateCategory(spec, cachedCategory, excludedWords);
      console.log(`[data] Reusing ${spec.name}: ${spec.count} words.`);
      continue;
    } catch {
      cached = cardsOutsideCategory;
    }

    const generated = await generateCategory(
      openai,
      spec,
      cached.map((card) => card.chinese),
    );
    cached.push(...generated);
    saveCache(cached);
    console.log(`[data] Generated ${spec.name}: ${generated.length} words.`);
  }

  const ordered = categories.flatMap((spec) =>
    cached.filter((card) => card.category === spec.id),
  );

  if (
    ordered.length !== 300 ||
    new Set(ordered.map((card) => card.chinese)).size !== 300 ||
    new Set(ordered.map((card) => card.example_cn)).size !== 300
  ) {
    throw new Error("Factory vocabulary must contain 300 unique complete cards.");
  }

  return ordered;
}

async function buildCards(vocabulary: GeneratedCard[]) {
  async function createCard(card: GeneratedCard, index: number) {
    const position = index + 1;
    console.log(`[audio ${position}/300] ${card.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      getOrCreateTemplateSpeech(templateSlug, "word", card.chinese),
      getOrCreateTemplateSpeech(templateSlug, "sentence", card.example_cn),
    ]);

    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Could not create complete audio for ${card.chinese}.`);
    }

    return {
      ...card,
      position,
      wordAudioUrl,
      sentenceAudioUrl,
    } satisfies FactoryCard;
  }

  const cards: FactoryCard[] = [];

  for (
    let index = 0;
    index < vocabulary.length;
    index += audioConcurrency
  ) {
    const completed = await Promise.all(
      vocabulary
        .slice(index, index + audioConcurrency)
        .map((card, offset) => createCard(card, index + offset)),
    );
    cards.push(...completed);
  }

  return cards;
}

function buildMigration(cards: FactoryCard[]) {
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

  return `-- Add a reusable 300-word factory Chinese deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  'Tiếng Trung nhà máy/xưởng - 300 từ',
  '300 từ vựng tiếng Trung thực tế về máy móc, dây chuyền, thao tác sản xuất, kiểm tra chất lượng, lỗi sản phẩm, bảo trì, kho vận và an toàn lao động. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và audio tạo sẵn.',
  'Nhà máy'
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

  const vocabulary = await buildVocabulary();
  const cards = await buildCards(vocabulary);
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  console.log(`Created ${outputPath} with ${cards.length} complete cards.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
