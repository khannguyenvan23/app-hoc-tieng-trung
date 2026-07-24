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

type HousingCard = GeneratedCard & {
  position: number;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const templateSlug = "thue-nha-sinh-hoat-trung-quoc-150";
const outputPath =
  "supabase/migrations/042_housing_china_150_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  "tiengtrunghihi-housing-china-150-cards.json",
);
const expectedTotal = 150;
const audioConcurrency = 3;

const categories: CategorySpec[] = [
  {
    id: "search-renting",
    name: "Tìm và thuê nhà",
    count: 25,
    scope:
      "Tìm nguồn nhà, xem nhà, mô tả loại phòng, vị trí, nội thất và trao đổi với chủ nhà hoặc môi giới trước khi thuê.",
    requiredTopics: [
      "房源",
      "租房",
      "看房",
      "中介",
      "房东",
      "租客",
      "合租",
      "整租",
      "单间",
      "一室一厅",
      "小区",
      "地铁附近",
      "家具齐全",
      "拎包入住",
      "入住日期",
    ],
  },
  {
    id: "contract-payments",
    name: "Hợp đồng và thanh toán",
    count: 25,
    scope:
      "Tiền thuê, tiền cọc, kỳ thanh toán, ký và gia hạn hợp đồng, trả nhà, biên lai, chuyển khoản và các khoản phí minh bạch.",
    requiredTopics: [
      "房租",
      "押金",
      "租赁合同",
      "签合同",
      "合同期",
      "月租",
      "季付",
      "年付",
      "付款日期",
      "续租",
      "退租",
      "违约金",
      "收据",
      "转账",
      "退押金",
    ],
  },
  {
    id: "utilities-facilities",
    name: "Điện nước và tiện ích",
    count: 25,
    scope:
      "Các hóa đơn sinh hoạt, đồng hồ đo, internet, thiết bị gia dụng, thang máy, kiểm soát ra vào và tiện ích của tòa nhà.",
    requiredTopics: [
      "水费",
      "电费",
      "燃气费",
      "物业费",
      "网费",
      "水表",
      "电表",
      "热水器",
      "空调",
      "暖气",
      "洗衣机",
      "冰箱",
      "电梯",
      "门禁",
      "停车位",
    ],
  },
  {
    id: "repairs-management",
    name: "Sửa chữa và ban quản lý",
    count: 25,
    scope:
      "Báo hỏng, rò rỉ, mất điện nước, khóa cửa, đường ống, đồ điện và phối hợp với ban quản lý hoặc thợ sửa tại nhà.",
    requiredTopics: [
      "维修",
      "报修",
      "漏水",
      "停电",
      "停水",
      "下水道堵塞",
      "空调坏了",
      "门锁坏了",
      "灯泡",
      "水管",
      "物业",
      "维修人员",
      "上门维修",
      "维修费",
      "紧急情况",
    ],
  },
  {
    id: "neighbors-community",
    name: "Hàng xóm và khu dân cư",
    count: 25,
    scope:
      "Giao tiếp với hàng xóm, tiếng ồn, giờ sinh hoạt, vệ sinh, an ninh, khách đến thăm và quy định chung của khu dân cư.",
    requiredTopics: [
      "邻居",
      "楼上",
      "楼下",
      "隔壁",
      "噪音",
      "安静",
      "扰民",
      "社区",
      "小区管理",
      "垃圾分类",
      "垃圾桶",
      "快递柜",
      "公告",
      "保安",
      "访客",
    ],
  },
  {
    id: "delivery-moving",
    name: "Giao hàng và chuyển nhà",
    count: 25,
    scope:
      "Ghi địa chỉ, nhận đồ ăn và bưu kiện, mã lấy hàng, giao tận cửa, chuyển nhà, đóng gói và lắp đặt đồ nội thất.",
    requiredTopics: [
      "快递",
      "外卖",
      "收货地址",
      "门牌号",
      "单元",
      "楼层",
      "配送员",
      "放门口",
      "送货上门",
      "取件码",
      "签收",
      "搬家",
      "搬家公司",
      "纸箱",
      "预约送货",
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
  房源: {
    meaning_vi: "tin đăng nhà cho thuê, nguồn nhà đang cho thuê",
  },
  单合同: {
    chinese: "房型",
    pinyin: "fángxíng",
    meaning_vi: "loại hình căn hộ, kiểu phòng",
    example_cn: "中介介绍了几种不同的房型供我们选择。",
    example_pinyin:
      "Zhōngjiè jièshào le jǐ zhǒng bùtóng de fángxíng gōng wǒmen xuǎnzé.",
    example_vi:
      "Môi giới giới thiệu vài loại hình căn hộ khác nhau để chúng tôi lựa chọn.",
  },
  热水供应: {
    pinyin: "rèshuǐ gōngyìng",
  },
  电灯短路: {
    chinese: "电路短路",
    pinyin: "diànlù duǎnlù",
    meaning_vi: "chập mạch điện",
    example_cn: "厨房发生电路短路后，物业立即断开了电源。",
    example_pinyin:
      "Chúfáng fāshēng diànlù duǎnlù hòu, wùyè lìjí duànkāi le diànyuán.",
    example_vi:
      "Sau khi bếp bị chập mạch điện, ban quản lý lập tức ngắt nguồn điện.",
  },
  充电接口: {
    chinese: "插座故障",
    pinyin: "chāzuò gùzhàng",
    meaning_vi: "ổ cắm điện bị hỏng",
    example_cn: "卧室出现插座故障，手机一直无法充电。",
    example_pinyin:
      "Wòshì chūxiàn chāzuò gùzhàng, shǒujī yìzhí wúfǎ chōngdiàn.",
    example_vi:
      "Ổ cắm điện trong phòng ngủ bị hỏng nên điện thoại không thể sạc.",
  },
  礼貌: {
    chinese: "邻里关系",
    pinyin: "línlǐ guānxì",
    meaning_vi: "quan hệ láng giềng",
    example_cn: "大家互相体谅，才能保持良好的邻里关系。",
    example_pinyin:
      "Dàjiā hùxiāng tǐliàng, cái néng bǎochí liánghǎo de línlǐ guānxì.",
    example_vi:
      "Mọi người thông cảm cho nhau thì mới duy trì được quan hệ láng giềng tốt.",
  },
  访客邀请: {
    chinese: "住户群",
    pinyin: "zhùhù qún",
    meaning_vi: "nhóm chat cư dân",
    example_cn: "物业会在住户群里发布停水和维修通知。",
    example_pinyin:
      "Wùyè huì zài zhùhù qún lǐ fābù tíngshuǐ hé wéixiū tōngzhī.",
    example_vi:
      "Ban quản lý sẽ đăng thông báo mất nước và sửa chữa trong nhóm chat cư dân.",
  },
  外卖: {
    example_cn: "我今天晚上点了外卖，预计半小时内送到。",
    example_pinyin:
      "Wǒ jīntiān wǎnshang diǎn le wàimài, yùjì bàn xiǎoshí nèi sòngdào.",
    example_vi:
      "Tối nay tôi đặt đồ ăn giao tận nơi, dự kiến sẽ đến trong vòng nửa tiếng.",
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
          name: "housing_china_vocabulary_cards",
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
            "Bạn là giáo viên tiếng Trung chuyên dạy người Việt thuê nhà và sinh hoạt tại Trung Quốc. Hãy tạo từ hoặc cụm từ tiếng Trung giản thể thực tế, thường gặp; không tạo cả câu làm mục từ. Pinyin của từ và câu phải có đầy đủ dấu thanh, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu. Câu ví dụ dài khoảng 8-24 chữ Hán, chứa nguyên văn từ mục tiêu, kết thúc bằng dấu câu tiếng Trung và có ngữ cảnh cụ thể, hữu ích khi thuê nhà hoặc sinh hoạt. Không đưa lời khuyên pháp lý tuyệt đối; các khoản tiền và điều khoản phải được diễn đạt rõ ràng. Các câu phải đa dạng, không lặp công thức. Không tạo mục gần như đồng nghĩa với từ đã bị cấm. Giữ category đúng id được yêu cầu.",
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
    throw new Error(
      `Các nhóm phải có tổng ${expectedTotal} thẻ, hiện là ${total}.`,
    );
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
      `Bộ thuê nhà phải có đúng ${expectedTotal} từ và câu ví dụ duy nhất.`,
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
    } satisfies HousingCard;
  }

  const cards: HousingCard[] = [];
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

function buildMigration(cards: HousingCard[]) {
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

  return `-- Add a reusable 150-word China housing and daily-life deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  'Thuê nhà và sinh hoạt tại Trung Quốc - 150 từ',
  '150 từ vựng tiếng Trung thực tế về tìm và thuê nhà, tiền nhà, điện nước, hợp đồng, sửa chữa, hàng xóm, giao hàng và chuyển nhà. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.',
  'Thuê nhà'
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

async function syncTemplate(cards: HousingCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: "Thuê nhà và sinh hoạt tại Trung Quốc - 150 từ",
        description:
          "150 từ vựng tiếng Trung thực tế về tìm và thuê nhà, tiền nhà, điện nước, hợp đồng, sửa chữa, hàng xóm, giao hàng và chuyển nhà. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.",
        level: "Thuê nhà",
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
