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

type ShoppingCard = GeneratedCard & {
  position: number;
  wordAudioUrl: string;
  sentenceAudioUrl: string;
};

const templateSlug = "mua-sam-thanh-toan-150";
const outputPath =
  "supabase/migrations/040_shopping_payment_150_words.sql";
const cachePath = path.join(
  os.tmpdir(),
  "tiengtrunghihi-shopping-payment-150-cards.json",
);
const audioConcurrency = 3;
const expectedTotal = 150;

const categories: CategorySpec[] = [
  {
    id: "products-stores",
    name: "Sản phẩm và cửa hàng",
    count: 25,
    scope:
      "Tên sản phẩm, loại cửa hàng và thao tác chọn, mua, đặt trước, kiểm tra hàng trong ngữ cảnh mua sắm trực tiếp.",
    requiredTopics: [
      "cửa hàng",
      "siêu thị",
      "trung tâm thương mại",
      "quầy hàng",
      "sản phẩm",
      "thương hiệu",
      "mẫu mã",
      "hàng có sẵn",
      "hết hàng",
      "đặt trước",
      "chọn hàng",
      "giỏ mua sắm",
    ],
  },
  {
    id: "price-promotions",
    name: "Giá cả và khuyến mãi",
    count: 25,
    scope:
      "Hỏi giá, so sánh giá, mặc cả, giảm giá, ưu đãi thành viên, mã giảm giá, hóa đơn và thuế.",
    requiredTopics: [
      "giá",
      "giá gốc",
      "giá khuyến mãi",
      "giảm giá",
      "mặc cả",
      "đắt",
      "rẻ",
      "mã giảm giá",
      "phiếu ưu đãi",
      "thẻ thành viên",
      "hóa đơn",
      "thuế",
    ],
  },
  {
    id: "size-color-fitting",
    name: "Kích cỡ, màu sắc và thử đồ",
    count: 25,
    scope:
      "Kích cỡ quần áo và giày, màu sắc, chất liệu, kiểu dáng, phòng thử đồ, đổi cỡ và mức độ vừa vặn.",
    requiredTopics: [
      "kích cỡ",
      "cỡ nhỏ",
      "cỡ vừa",
      "cỡ lớn",
      "số giày",
      "màu sắc",
      "chất liệu",
      "kiểu dáng",
      "phòng thử đồ",
      "thử đồ",
      "vừa vặn",
      "rộng",
      "chật",
    ],
  },
  {
    id: "payments",
    name: "Thanh toán và thanh toán điện tử",
    count: 25,
    scope:
      "Thanh toán tiền mặt, thẻ, QR, ví điện tử, chuyển khoản, mật khẩu, xác nhận và xử lý lỗi giao dịch.",
    requiredTopics: [
      "thanh toán",
      "tiền mặt",
      "thẻ ngân hàng",
      "thẻ tín dụng",
      "quét mã QR",
      "Alipay",
      "WeChat Pay",
      "ví điện tử",
      "chuyển khoản",
      "mã thanh toán",
      "giao dịch thành công",
      "thanh toán thất bại",
    ],
  },
  {
    id: "orders-delivery",
    name: "Đặt hàng và giao nhận",
    count: 25,
    scope:
      "Mua sắm trực tuyến, giỏ hàng, đặt đơn, địa chỉ, phí vận chuyển, theo dõi và nhận hàng.",
    requiredTopics: [
      "mua hàng trực tuyến",
      "giỏ hàng",
      "đặt hàng",
      "đơn hàng",
      "địa chỉ nhận hàng",
      "phí vận chuyển",
      "miễn phí vận chuyển",
      "giao hàng",
      "giao nhanh",
      "mã vận đơn",
      "theo dõi đơn hàng",
      "nhận hàng",
    ],
  },
  {
    id: "returns-refunds",
    name: "Đổi trả, hoàn tiền và chăm sóc khách hàng",
    count: 25,
    scope:
      "Đổi hàng, trả hàng, hoàn tiền, bảo hành, khiếu nại, hàng lỗi và liên hệ dịch vụ khách hàng.",
    requiredTopics: [
      "đổi hàng",
      "trả hàng",
      "hoàn tiền",
      "hoàn tiền toàn bộ",
      "hoàn tiền một phần",
      "chính sách đổi trả",
      "thời hạn đổi trả",
      "hàng bị lỗi",
      "hàng bị hỏng",
      "bảo hành",
      "khiếu nại",
      "dịch vụ khách hàng",
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
  购物发票: {
    chinese: "购物小票",
    pinyin: "gòuwù xiǎopiào",
    meaning_vi: "biên lai mua hàng",
    example_cn: "退货时请出示购物小票。",
    example_pinyin: "Tuìhuò shí qǐng chūshì gòuwù xiǎopiào.",
    example_vi: "Khi trả hàng, vui lòng xuất trình biên lai mua hàng.",
  },
  半袖: {
    chinese: "短袖",
    pinyin: "duǎnxiù",
    meaning_vi: "áo tay ngắn",
    example_cn: "夏天我想买一件透气的短袖。",
    example_pinyin: "Xiàtiān wǒ xiǎng mǎi yí jiàn tòuqì de duǎnxiù.",
    example_vi: "Mùa hè tôi muốn mua một chiếc áo tay ngắn thoáng khí.",
  },
  折扣: {
    example_cn: "这件商品有百分之二十的折扣。",
    example_pinyin:
      "Zhè jiàn shāngpǐn yǒu bǎi fēn zhī èrshí de zhékòu.",
    example_vi: "Sản phẩm này được giảm giá hai mươi phần trăm.",
  },
  试衣服: {
    example_cn: "我想先试衣服，再决定要不要买。",
    example_pinyin:
      "Wǒ xiǎng xiān shì yīfu, zài juédìng yào bú yào mǎi.",
    example_vi:
      "Tôi muốn thử quần áo trước rồi mới quyết định có mua hay không.",
  },
  面试: {
    chinese: "试衣",
    pinyin: "shìyī",
    meaning_vi: "thử đồ",
    example_cn: "她在试衣间试衣，看看外套是否合身。",
    example_pinyin:
      "Tā zài shìyījiān shìyī, kànkan wàitào shìfǒu héshēn.",
    example_vi:
      "Cô ấy thử đồ trong phòng thử để xem áo khoác có vừa không.",
  },
  二维码扫码: {
    chinese: "二维码",
    pinyin: "èrwéimǎ",
    meaning_vi: "mã QR",
    example_cn: "请出示付款二维码，收银员会帮您扫码。",
    example_pinyin:
      "Qǐng chūshì fùkuǎn èrwéimǎ, shōuyínyuán huì bāng nín sǎomǎ.",
    example_vi:
      "Vui lòng đưa mã QR thanh toán, thu ngân sẽ quét mã giúp bạn.",
  },
  快捷键: {
    chinese: "支付限额",
    pinyin: "zhīfù xiàn'é",
    meaning_vi: "hạn mức thanh toán",
    example_cn: "这张银行卡的每日支付限额是一万元。",
    example_pinyin:
      "Zhè zhāng yínhángkǎ de měirì zhīfù xiàn'é shì yí wàn yuán.",
    example_vi:
      "Hạn mức thanh toán mỗi ngày của thẻ ngân hàng này là mười nghìn tệ.",
  },
  订单号码: {
    pinyin: "dìngdān hàomǎ",
    meaning_vi: "số đơn hàng",
    example_vi:
      "Vui lòng cung cấp số đơn hàng để tra cứu thông tin vận chuyển của gói hàng.",
  },
  客户投诉: {
    pinyin: "kèhù tóusù",
    meaning_vi: "khiếu nại của khách hàng",
    example_cn: "客服人员当天处理了这起客户投诉。",
    example_pinyin:
      "Kèfù rényuán dāngtiān chǔlǐ le zhè qǐ kèhù tóusù.",
    example_vi:
      "Nhân viên chăm sóc khách hàng đã xử lý khiếu nại này ngay trong ngày.",
  },
  丢失凭证: {
    chinese: "购物凭证",
    pinyin: "gòuwù píngzhèng",
    meaning_vi: "chứng từ mua hàng",
    example_cn: "申请保修时需要提供购物凭证。",
    example_pinyin: "Shēnqǐng bǎoxiū shí xūyào tígōng gòuwù píngzhèng.",
    example_vi: "Khi yêu cầu bảo hành, bạn cần cung cấp chứng từ mua hàng.",
  },
  售后维修: {
    pinyin: "shòuhòu wéixiū",
    meaning_vi: "sửa chữa sau bán hàng",
    example_vi:
      "Tivi bị hỏng, khách hàng được hưởng dịch vụ sửa chữa sau bán hàng miễn phí.",
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
          name: "shopping_payment_vocabulary_cards",
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
            "Bạn là giáo viên tiếng Trung thương mại cho người Việt. Hãy tạo từ vựng tiếng Trung giản thể thực tế về mua sắm và thanh toán. Mỗi mục là một từ hoặc cụm từ hữu ích, không phải cả câu. Pinyin của từ và câu phải có đầy đủ dấu thanh, không dùng số thanh điệu. Nghĩa và bản dịch tiếng Việt phải tự nhiên, có dấu. Câu ví dụ phải dài khoảng 8-24 chữ Hán, chứa nguyên văn từ mục tiêu, kết thúc bằng dấu câu tiếng Trung và mô tả một tình huống mua hàng cụ thể. Các câu phải đa dạng, không lặp công thức chung. Không tạo từ đồng nghĩa gần như trùng hẳn với mục đã bị cấm. Giữ category đúng id được yêu cầu.",
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

      const card = {
        ...normalizeCard(rawCard),
        category: spec.id,
      };
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
      `Bộ mua sắm phải có đúng ${expectedTotal} từ và câu ví dụ duy nhất.`,
    );
  }

  return ordered;
}

async function buildCards(vocabulary: GeneratedCard[]) {
  async function createCard(card: GeneratedCard, index: number) {
    const position = index + 1;
    console.log(`[audio ${position}/${expectedTotal}] ${card.chinese}`);
    const [wordAudioUrl, sentenceAudioUrl] = await Promise.all([
      getOrCreateTemplateSpeech(templateSlug, "word", card.chinese),
      getOrCreateTemplateSpeech(templateSlug, "sentence", card.example_cn),
    ]);

    if (!wordAudioUrl || !sentenceAudioUrl) {
      throw new Error(`Không tạo đủ hai audio cho ${card.chinese}.`);
    }

    return {
      ...card,
      position,
      wordAudioUrl,
      sentenceAudioUrl,
    } satisfies ShoppingCard;
  }

  const cards: ShoppingCard[] = [];
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

function buildMigration(cards: ShoppingCard[]) {
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

  return `-- Add a reusable 150-word shopping and payment deck with pre-generated audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  'Mua sắm và thanh toán - 150 từ',
  '150 từ vựng tiếng Trung thực tế về giá cả, kích cỡ, khuyến mãi, đặt hàng, thanh toán điện tử, đổi trả và hoàn tiền. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.',
  'Mua sắm'
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

delete from public.template_cards
where template_deck_id = (
  select id
  from public.template_decks
  where slug = '${templateSlug}'
)
and chinese not in (${activeWords});
`;
}

async function syncTemplate(cards: ShoppingCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: "Mua sắm và thanh toán - 150 từ",
        description:
          "150 từ vựng tiếng Trung thực tế về giá cả, kích cỡ, khuyến mãi, đặt hàng, thanh toán điện tử, đổi trả và hoàn tiền. Mỗi từ có pinyin, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh và hai audio tạo sẵn.",
        level: "Mua sắm",
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
    const { error: deleteError } = await supabase
      .from("template_cards")
      .delete()
      .in("id", staleCardIds);

    if (deleteError) {
      throw deleteError;
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

  console.log(`[sync] Đã đồng bộ ${count} thẻ lên Supabase.`);

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
    const { error: removeError } = await supabase.storage
      .from("card-audio")
      .remove(staleAudioPaths);

    if (removeError) {
      throw removeError;
    }
  }

  console.log(
    `[sync] Đã dọn ${staleCardIds.length} thẻ và ${staleAudioPaths.length} audio cũ.`,
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
