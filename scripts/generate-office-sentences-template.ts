import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
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
  requiredSituations: string[];
};

type HighlightWord = {
  chinese: string;
  pinyin: string;
  meaning_vi: string;
};

type GeneratedSentence = {
  category: string;
  sentence_cn: string;
  sentence_pinyin: string;
  sentence_vi: string;
  vocabulary: HighlightWord[];
};

type OfficeSentenceCard = GeneratedSentence & {
  position: number;
  sentenceAudioUrl: string;
};

const isFactoryTemplate = process.argv.includes("--factory");
const templateSlug = isFactoryTemplate
  ? "nha-may-xuong-150-cau"
  : "giao-tiep-cong-so-150-cau";
const outputPath = isFactoryTemplate
  ? "supabase/migrations/044_factory_150_sentences.sql"
  : "supabase/migrations/043_office_communication_150_sentences.sql";
const cachePath = path.join(
  os.tmpdir(),
  isFactoryTemplate
    ? "tiengtrunghihi-factory-150-sentences.json"
    : "tiengtrunghihi-office-communication-150-sentences.json",
);
const expectedTotal = 150;
const audioConcurrency = 3;
const execFileAsync = promisify(execFile);
let useEdgeTtsOnly = false;
const templateName = isFactoryTemplate
  ? "Nhà máy/xưởng - 150 câu"
  : "Giao tiếp công sở - 150 câu";
const templateDescription = isFactoryTemplate
  ? "150 câu tiếng Trung theo tình huống nhà máy và xưởng sản xuất: giao ca, vận hành máy, kiểm tra chất lượng, báo lỗi, bảo trì, an toàn lao động và phối hợp sản xuất. Mỗi câu có pinyin, nghĩa tiếng Việt, từ mới được highlight và audio tạo sẵn."
  : "150 câu tiếng Trung theo tình huống công sở: trao đổi công việc, giao nhiệm vụ, báo tiến độ, họp, xin nghỉ và nhắn tin với đồng nghiệp. Mỗi câu có pinyin, nghĩa tiếng Việt, từ mới được highlight và audio tạo sẵn.";

const officeCategories: CategorySpec[] = [
  {
    id: "daily-communication",
    name: "Giao tiếp hằng ngày tại văn phòng",
    count: 25,
    scope:
      "Chào hỏi, bắt đầu ngày làm việc, trao đổi nhanh, nhờ hỗ trợ, bàn giao tài liệu, xác nhận đã nhận thông tin và kết thúc ngày làm việc.",
    requiredSituations: [
      "chào đồng nghiệp",
      "hỏi lịch hôm nay",
      "nhờ hỗ trợ",
      "mượn tài liệu",
      "gửi tập tin",
      "xác nhận đã nhận",
      "bàn giao công việc",
      "trao đổi trực tiếp",
      "giờ nghỉ trưa",
      "tan làm",
    ],
  },
  {
    id: "tasks-deadlines",
    name: "Giao việc, kế hoạch và thời hạn",
    count: 25,
    scope:
      "Nhận nhiệm vụ, làm rõ yêu cầu, chia nhỏ công việc, phân công trách nhiệm, đặt ưu tiên, lập kế hoạch và thống nhất thời hạn.",
    requiredSituations: [
      "giao nhiệm vụ mới",
      "làm rõ yêu cầu",
      "người phụ trách",
      "mức độ ưu tiên",
      "thời hạn hoàn thành",
      "điều chỉnh kế hoạch",
      "phân chia công việc",
      "ước tính thời gian",
      "xác nhận phạm vi",
      "xin thêm thời gian",
    ],
  },
  {
    id: "progress-problems",
    name: "Báo tiến độ và xử lý vấn đề",
    count: 25,
    scope:
      "Báo cáo phần đã hoàn thành, việc còn lại, chậm tiến độ, nguyên nhân, rủi ro, lỗi phát sinh, phương án xử lý và đề nghị hỗ trợ.",
    requiredSituations: [
      "báo tiến độ",
      "đã hoàn thành",
      "đang xử lý",
      "chậm tiến độ",
      "gặp trở ngại",
      "phát hiện lỗi",
      "đánh giá rủi ro",
      "đề xuất phương án",
      "cần hỗ trợ",
      "thông báo kết quả",
    ],
  },
  {
    id: "meetings-decisions",
    name: "Họp, thuyết trình và ra quyết định",
    count: 25,
    scope:
      "Mời họp, xác nhận thời gian, trình bày ý kiến, đặt câu hỏi, đồng ý hoặc phản biện lịch sự, ghi biên bản, phân công sau họp và chốt quyết định.",
    requiredSituations: [
      "mời họp",
      "đổi lịch họp",
      "chương trình họp",
      "bắt đầu trình bày",
      "nêu quan điểm",
      "đặt câu hỏi",
      "đồng ý",
      "ý kiến khác",
      "kết luận cuộc họp",
      "biên bản họp",
    ],
  },
  {
    id: "attendance-leave",
    name: "Chấm công, xin nghỉ và công tác",
    count: 25,
    scope:
      "Đi muộn, về sớm, xin nghỉ phép hoặc nghỉ ốm, làm thêm giờ, làm việc từ xa, đổi ca, đi công tác và bàn giao khi vắng mặt.",
    requiredSituations: [
      "xin nghỉ phép",
      "nghỉ ốm",
      "đi muộn",
      "về sớm",
      "làm thêm giờ",
      "đổi ca",
      "làm việc từ xa",
      "đi công tác",
      "chấm công",
      "bàn giao khi nghỉ",
    ],
  },
  {
    id: "messages-collaboration",
    name: "Email, nhắn tin và phối hợp đồng nghiệp",
    count: 25,
    scope:
      "Soạn email, nhắn tin nhóm, gửi tệp đính kèm, nhắc phản hồi, thêm người liên quan, phối hợp liên phòng ban, phản hồi góp ý và theo dõi việc cần làm.",
    requiredSituations: [
      "tiêu đề email",
      "tệp đính kèm",
      "gửi nhầm người",
      "nhắc phản hồi",
      "nhóm chat công việc",
      "đánh dấu người liên quan",
      "phối hợp liên phòng ban",
      "phản hồi góp ý",
      "cập nhật tài liệu",
      "xác nhận bằng văn bản",
    ],
  },
];

const factoryCategories: CategorySpec[] = [
  {
    id: "shift-handover",
    name: "Giao ca và tiếp nhận công việc",
    count: 25,
    scope:
      "Điểm danh đầu ca, bàn giao sản lượng, tình trạng máy, nguyên liệu, đơn hàng, dụng cụ, vấn đề tồn đọng và xác nhận người tiếp nhận.",
    requiredSituations: [
      "điểm danh đầu ca",
      "bàn giao ca",
      "kiểm tra nhật ký sản xuất",
      "báo sản lượng ca trước",
      "bàn giao tình trạng máy",
      "bàn giao nguyên liệu",
      "bàn giao dụng cụ",
      "thông báo việc tồn đọng",
      "xác nhận người tiếp nhận",
      "kết thúc ca",
    ],
  },
  {
    id: "machine-operation",
    name: "Vận hành máy và dây chuyền",
    count: 25,
    scope:
      "Khởi động, dừng máy, cài đặt thông số, cấp nguyên liệu, thay khuôn, điều chỉnh tốc độ, quan sát bảng điều khiển, vệ sinh và tuân thủ quy trình vận hành.",
    requiredSituations: [
      "kiểm tra trước khi khởi động",
      "khởi động máy",
      "dừng máy đúng quy trình",
      "cài đặt thông số",
      "điều chỉnh tốc độ",
      "cấp nguyên liệu",
      "thay khuôn",
      "theo dõi bảng điều khiển",
      "vệ sinh thiết bị",
      "ghi chép dữ liệu vận hành",
    ],
  },
  {
    id: "quality-inspection",
    name: "Kiểm tra chất lượng sản phẩm",
    count: 25,
    scope:
      "Lấy mẫu, đo kích thước, kiểm tra ngoại quan, đối chiếu tiêu chuẩn, phân loại đạt hoặc không đạt, cách ly hàng lỗi, ghi phiếu và xác nhận chất lượng.",
    requiredSituations: [
      "lấy mẫu kiểm tra",
      "đo kích thước",
      "kiểm tra ngoại quan",
      "đối chiếu tiêu chuẩn",
      "phát hiện sai lệch",
      "phân loại sản phẩm",
      "cách ly hàng lỗi",
      "ghi phiếu kiểm tra",
      "kiểm tra lại",
      "xác nhận xuất hàng",
    ],
  },
  {
    id: "faults-maintenance",
    name: "Báo lỗi, xử lý sự cố và bảo trì",
    count: 25,
    scope:
      "Nhận biết tiếng động, nhiệt độ hoặc rung bất thường, dừng máy khẩn cấp, báo kỹ thuật, mô tả lỗi, khoanh vùng nguyên nhân, sửa chữa, thay linh kiện và chạy thử.",
    requiredSituations: [
      "phát hiện tiếng động lạ",
      "nhiệt độ bất thường",
      "máy rung mạnh",
      "dừng máy khẩn cấp",
      "báo nhân viên kỹ thuật",
      "mô tả mã lỗi",
      "kiểm tra nguyên nhân",
      "thay linh kiện",
      "bảo trì định kỳ",
      "chạy thử sau sửa chữa",
    ],
  },
  {
    id: "workplace-safety",
    name: "An toàn lao động và phòng ngừa rủi ro",
    count: 25,
    scope:
      "Trang bị bảo hộ, khóa nguồn, khu vực nguy hiểm, phòng cháy, hóa chất, nâng hạ, lối thoát hiểm, báo tai nạn và xử lý tình huống mất an toàn.",
    requiredSituations: [
      "mặc đồ bảo hộ",
      "đội mũ và đeo kính",
      "khóa nguồn trước bảo trì",
      "không tháo tấm chắn",
      "biển cảnh báo",
      "sử dụng hóa chất",
      "nâng hạ hàng hóa",
      "lối thoát hiểm",
      "báo sự cố an toàn",
      "sơ cứu tai nạn",
    ],
  },
  {
    id: "production-coordination",
    name: "Phối hợp sản xuất và báo cáo tiến độ",
    count: 25,
    scope:
      "Nhận kế hoạch sản xuất, xác nhận đơn hàng, thiếu nguyên liệu, điều chỉnh nhân lực, báo sản lượng, chậm tiến độ, phối hợp kho và chất lượng, đóng gói và giao hàng.",
    requiredSituations: [
      "nhận kế hoạch sản xuất",
      "xác nhận đơn hàng",
      "kiểm tra tồn kho",
      "báo thiếu nguyên liệu",
      "điều chỉnh nhân lực",
      "báo sản lượng",
      "báo chậm tiến độ",
      "phối hợp bộ phận kho",
      "đóng gói thành phẩm",
      "chuẩn bị giao hàng",
    ],
  },
];

const categories = isFactoryTemplate
  ? factoryCategories
  : officeCategories;

const highlightWordSchema = z.object({
  chinese: z.string().min(1),
  pinyin: z.string().min(1),
  meaning_vi: z.string().min(1),
});

const responseSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().min(1),
      sentence_cn: z.string().min(3),
      sentence_pinyin: z.string().min(3),
      sentence_vi: z.string().min(3),
      vocabulary: z.array(highlightWordSchema).min(1).max(3),
    }),
  ),
});

const officeDataCorrections: Record<
  string,
  Partial<GeneratedSentence>
> = {
  "午休时间到了，请大家及时休息。": {
    sentence_vi: "Đến giờ nghỉ trưa rồi, mọi người nghỉ ngơi một chút nhé.",
  },
  "目前我们正在解决软件开发中的几个关键BUG。": {
    sentence_cn: "目前我们正在解决软件开发中的几个关键缺陷。",
    sentence_pinyin:
      "Mùqián wǒmen zhèngzài jiějué ruǎnjiàn kāifā zhōng de jǐ gè guānjiàn quēxiàn.",
    sentence_vi:
      "Hiện tại chúng tôi đang xử lý một số lỗi quan trọng trong phần mềm.",
    vocabulary: [
      {
        chinese: "关键缺陷",
        pinyin: "guānjiàn quēxiàn",
        meaning_vi: "lỗi quan trọng, khiếm khuyết nghiêm trọng",
      },
    ],
  },
  "由于团队成员缺乏经验，导致任务进展出现了瓶颈。": {
    sentence_vi:
      "Do các thành viên trong nhóm còn thiếu kinh nghiệm nên tiến độ công việc gặp điểm nghẽn.",
  },
  "请将任务分解并合理分配给团队成员，确保效率。": {
    sentence_vi:
      "Hãy chia nhỏ và phân công nhiệm vụ hợp lý cho các thành viên để bảo đảm hiệu quả.",
  },
  "今天的会议程序将包括项目进展和预算审核。": {
    sentence_cn: "今天的会议议程包括项目进展和预算审核。",
    sentence_pinyin:
      "Jīntiān de huìyì yìchéng bāokuò xiàngmù jìnzhǎn hé yùsuàn shěnhé.",
    sentence_vi:
      "Chương trình họp hôm nay gồm tiến độ dự án và phần xét duyệt ngân sách.",
    vocabulary: [
      {
        chinese: "会议议程",
        pinyin: "huìyì yìchéng",
        meaning_vi: "chương trình, nội dung cuộc họp",
      },
      {
        chinese: "项目进展",
        pinyin: "xiàngmù jìnzhǎn",
        meaning_vi: "tiến độ dự án",
      },
      {
        chinese: "预算审核",
        pinyin: "yùsuàn shěnhé",
        meaning_vi: "xét duyệt ngân sách",
      },
    ],
  },
  "请大家务必在会议结束后填写会议纪要。": {
    sentence_cn: "请记录员在会议结束后整理会议纪要。",
    sentence_pinyin:
      "Qǐng jìlùyuán zài huìyì jiéshù hòu zhěnglǐ huìyì jìyào.",
    sentence_vi:
      "Sau cuộc họp, vui lòng nhờ người ghi biên bản tổng hợp nội dung cuộc họp.",
    vocabulary: [
      {
        chinese: "记录员",
        pinyin: "jìlùyuán",
        meaning_vi: "người ghi biên bản",
      },
      {
        chinese: "整理",
        pinyin: "zhěnglǐ",
        meaning_vi: "sắp xếp, tổng hợp",
      },
      {
        chinese: "会议纪要",
        pinyin: "huìyì jìyào",
        meaning_vi: "biên bản cuộc họp",
      },
    ],
  },
  "今天因为天气原因，交通繁忙导致同事们普遍迟到。": {
    sentence_vi:
      "Hôm nay do thời tiết và giao thông đông đúc nên nhiều đồng nghiệp đến muộn.",
  },
  "收到您的邮件，我会尽快安排对接相关工作。": {
    sentence_vi:
      "Tôi đã nhận được email và sẽ sớm sắp xếp người phối hợp công việc liên quan.",
  },
  "请遵守邮件礼仪，避免使用过于随意的语言。": {
    sentence_vi:
      "Vui lòng tuân thủ phép lịch sự khi viết email và tránh dùng ngôn ngữ quá tùy tiện.",
  },
  "总结今天会议，我们达成了几个重要共识。": {
    sentence_vi:
      "Tổng kết cuộc họp hôm nay, chúng ta đã đạt được một số đồng thuận quan trọng.",
  },
};
const dataCorrections = isFactoryTemplate
  ? {}
  : officeDataCorrections;

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

function stripFormatting(value: string) {
  return value.replaceAll("**", "").replaceAll("__", "").trim();
}

function normalizeHighlight(word: HighlightWord): HighlightWord {
  return {
    chinese: stripFormatting(word.chinese).replace(/\s+/g, ""),
    pinyin: stripFormatting(word.pinyin).replace(/\s+/g, " "),
    meaning_vi: stripFormatting(word.meaning_vi),
  };
}

function normalizeSentence(card: GeneratedSentence): GeneratedSentence {
  const normalized = {
    category: stripFormatting(card.category),
    sentence_cn: stripFormatting(card.sentence_cn).replace(/\s+/g, ""),
    sentence_pinyin: stripFormatting(card.sentence_pinyin).replace(
      /\s+/g,
      " ",
    ),
    sentence_vi: stripFormatting(card.sentence_vi),
    vocabulary: card.vocabulary.map(normalizeHighlight),
  };
  return {
    ...normalized,
    ...dataCorrections[normalized.sentence_cn],
  };
}

function rejectionReason(
  card: GeneratedSentence,
  forbiddenSentences: Set<string>,
  collectedSentences: Set<string>,
) {
  if (forbiddenSentences.has(card.sentence_cn)) {
    return "câu đã xuất hiện ở nhóm khác";
  }
  if (collectedSentences.has(card.sentence_cn)) {
    return "câu bị trùng trong nhóm";
  }
  if (!/[\u3002\uff01\uff1f]$/u.test(card.sentence_cn)) {
    return "câu tiếng Trung thiếu dấu câu";
  }
  if (!hasToneMark(card.sentence_pinyin)) {
    return "pinyin của câu chưa có dấu thanh";
  }
  if (!hasVietnameseAccent(card.sentence_vi)) {
    return "nghĩa tiếng Việt chưa có dấu";
  }
  if (card.vocabulary.length < 1 || card.vocabulary.length > 3) {
    return "mỗi câu phải có từ một đến ba từ mới";
  }

  const seenWords = new Set<string>();
  for (const word of card.vocabulary) {
    if (seenWords.has(word.chinese)) {
      return "từ highlight bị trùng trong cùng câu";
    }
    if (!card.sentence_cn.includes(word.chinese)) {
      return `từ highlight ${word.chinese} không có trong câu`;
    }
    if (!hasToneMark(word.pinyin)) {
      return `pinyin của từ ${word.chinese} chưa có dấu thanh`;
    }
    if (!hasVietnameseAccent(word.meaning_vi)) {
      return `nghĩa của từ ${word.chinese} chưa có dấu`;
    }
    seenWords.add(word.chinese);
  }
  return null;
}

function validateCategory(
  spec: CategorySpec,
  cards: GeneratedSentence[],
  excludedSentences: Set<string>,
) {
  if (cards.length !== spec.count) {
    throw new Error(
      `${spec.name}: cần ${spec.count} câu, hiện có ${cards.length}.`,
    );
  }

  const normalized = cards.map((card) => ({
    ...normalizeSentence(card),
    category: spec.id,
  }));
  const collectedSentences = new Set<string>();
  for (const card of normalized) {
    const reason = rejectionReason(
      card,
      excludedSentences,
      collectedSentences,
    );
    if (reason) {
      throw new Error(`${spec.name} - ${card.sentence_cn}: ${reason}.`);
    }
    collectedSentences.add(card.sentence_cn);
  }
  return normalized;
}

function readCache() {
  if (!fs.existsSync(cachePath)) {
    return [] satisfies GeneratedSentence[];
  }
  const parsed = responseSchema.parse(
    JSON.parse(fs.readFileSync(cachePath, "utf8")),
  );
  return parsed.items.map(normalizeSentence);
}

function saveCache(cards: GeneratedSentence[]) {
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ items: cards }, null, 2),
    "utf8",
  );
}

async function generateCategory(
  openai: OpenAI,
  spec: CategorySpec,
  excludedSentences: string[],
) {
  const collected = new Map<string, GeneratedSentence>();
  const forbiddenSentences = new Set(excludedSentences);

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
          name: isFactoryTemplate
            ? "factory_situational_sentences"
            : "office_communication_sentences",
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
                    "sentence_cn",
                    "sentence_pinyin",
                    "sentence_vi",
                    "vocabulary",
                  ],
                  properties: {
                    category: { type: "string" },
                    sentence_cn: { type: "string" },
                    sentence_pinyin: { type: "string" },
                    sentence_vi: { type: "string" },
                    vocabulary: {
                      type: "array",
                      minItems: 1,
                      maxItems: 3,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["chinese", "pinyin", "meaning_vi"],
                        properties: {
                          chinese: { type: "string" },
                          pinyin: { type: "string" },
                          meaning_vi: { type: "string" },
                        },
                      },
                    },
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
          content: isFactoryTemplate
            ? "Bạn là giáo viên tiếng Trung chuyên ngành nhà máy và xưởng sản xuất cho người Việt đi làm. Hãy tạo các câu tiếng Trung giản thể tự nhiên, chính xác và thực tế mà công nhân, tổ trưởng, kỹ thuật viên và nhân viên chất lượng thường dùng. Ưu tiên cách nói rõ ràng, dễ áp dụng tại hiện trường; không tạo khẩu hiệu chung chung và không đưa hướng dẫn nguy hiểm trái quy trình. Câu phải dài khoảng 8-30 chữ Hán, diễn đạt trọn ý, không dùng tên người hay tên công ty cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới, chữ viết tắt tiếng Anh hoặc ký hiệu định dạng vào câu. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và dùng đúng thuật ngữ sản xuất. Mỗi câu chọn 1-3 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ đó phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu."
            : "Bạn là giáo viên tiếng Trung công sở cho người Việt. Hãy tạo các câu tiếng Trung giản thể tự nhiên, lịch sự và thực tế trong môi trường văn phòng hiện đại. Câu phải dài khoảng 8-28 chữ Hán, diễn đạt trọn ý, không dùng tên người hay tên công ty cụ thể và không lặp công thức. Chỉ trả văn bản thuần, tuyệt đối không chèn Markdown, dấu **, dấu gạch dưới hoặc ký hiệu định dạng vào câu. Pinyin phải có đầy đủ dấu thanh, không dùng số thanh điệu. Bản dịch tiếng Việt phải tự nhiên, có dấu và đúng sắc thái công việc. Mỗi câu chọn 1-3 từ hoặc cụm từ mới quan trọng trong trường vocabulary để app highlight; mỗi từ đó phải xuất hiện nguyên văn, liên tục trong sentence_cn, có pinyin dấu thanh và nghĩa tiếng Việt. Không highlight từ quá cơ bản như 我, 你, 的, 了. Giữ category đúng id được yêu cầu.",
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
            situations_that_must_be_well_represented:
              spec.requiredSituations,
            forbidden_duplicate_sentences: [
              ...excludedSentences,
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
      const card = { ...normalizeSentence(rawCard), category: spec.id };
      const reason = rejectionReason(
        card,
        forbiddenSentences,
        new Set(collected.keys()),
      );
      if (reason) {
        console.warn(
          `[data] Bỏ ${card.sentence_cn || "(trống)"}: ${reason}.`,
        );
        continue;
      }
      collected.set(card.sentence_cn, card);
    }

    console.log(
      `[data] ${spec.name}: ${collected.size}/${spec.count} câu hợp lệ.`,
    );
    if (collected.size < spec.count) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }

  return validateCategory(
    spec,
    Array.from(collected.values()),
    forbiddenSentences,
  );
}

async function buildSentences() {
  const total = categories.reduce(
    (sum, category) => sum + category.count,
    0,
  );
  if (total !== expectedTotal) {
    throw new Error(
      `Các nhóm phải có tổng ${expectedTotal} câu, hiện là ${total}.`,
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
    const excludedSentences = new Set(
      otherCards.map((card) => card.sentence_cn),
    );

    try {
      validateCategory(spec, categoryCards, excludedSentences);
      console.log(`[data] Dùng cache ${spec.name}: ${spec.count} câu.`);
      continue;
    } catch {
      cached = otherCards;
    }

    const generated = await generateCategory(
      openai,
      spec,
      cached.map((card) => card.sentence_cn),
    );
    cached.push(...generated);
    saveCache(cached);
  }

  const ordered = categories.flatMap((spec) =>
    cached.filter((card) => card.category === spec.id),
  );
  if (
    ordered.length !== expectedTotal ||
    new Set(ordered.map((card) => card.sentence_cn)).size !== expectedTotal
  ) {
    throw new Error(
      `${templateName} phải có đúng ${expectedTotal} câu duy nhất.`,
    );
  }
  saveCache(ordered);
  return ordered;
}

async function createAudioWithRetry(text: string) {
  if (useEdgeTtsOnly) {
    return createTemplateSpeechWithEdge(text);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await getOrCreateTemplateSpeech(
        templateSlug,
        "sentence",
        text,
      );
    } catch (error) {
      lastError = error;
      const quotaExceeded =
        error instanceof OpenAI.APIError &&
        (error.status === 429 || error.code === "insufficient_quota");
      if (quotaExceeded) {
        useEdgeTtsOnly = true;
        console.warn(
          "[audio] OpenAI TTS đã hết hạn mức, chuyển sang Microsoft Edge TTS.",
        );
        break;
      }
      console.warn(`[audio] Thử lại lần ${attempt}/4 cho: ${text}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  try {
    return await createTemplateSpeechWithEdge(text);
  } catch (fallbackError) {
    throw new AggregateError(
      [lastError, fallbackError],
      `Không thể tạo audio cho: ${text}`,
    );
  }
}

async function createTemplateSpeechWithEdge(text: string) {
  const textHash = createHash("sha256")
    .update(text)
    .digest("hex")
    .slice(0, 24);
  const audioPath = `templates/${templateSlug}/sentence-${textHash}.mp3`;
  const temporaryPath = path.join(
    os.tmpdir(),
    `${templateSlug}-${textHash}.mp3`,
  );

  try {
    await execFileAsync(
      "python",
      [
        "-m",
        "edge_tts",
        "--voice",
        "zh-CN-XiaoxiaoNeural",
        "--text",
        text,
        "--write-media",
        temporaryPath,
      ],
      { timeout: 120_000, windowsHide: true },
    );
    const audio = fs.readFileSync(temporaryPath);
    if (audio.length === 0) {
      throw new Error("Microsoft Edge TTS trả về file audio trống.");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from("card-audio")
      .upload(audioPath, audio, {
        cacheControl: "31536000",
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (error) {
      throw error;
    }
    return supabase.storage.from("card-audio").getPublicUrl(audioPath).data
      .publicUrl;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

async function buildCards(sentences: GeneratedSentence[]) {
  async function createCard(
    sentence: GeneratedSentence,
    index: number,
  ) {
    const position = index + 1;
    console.log(`[audio ${position}/${expectedTotal}] ${sentence.sentence_cn}`);
    const sentenceAudioUrl = await createAudioWithRetry(
      sentence.sentence_cn,
    );
    if (!sentenceAudioUrl) {
      throw new Error(`Không tạo được audio cho ${sentence.sentence_cn}.`);
    }
    return {
      ...sentence,
      position,
      sentenceAudioUrl,
    } satisfies OfficeSentenceCard;
  }

  const cards: OfficeSentenceCard[] = [];
  for (
    let index = 0;
    index < sentences.length;
    index += audioConcurrency
  ) {
    cards.push(
      ...(await Promise.all(
        sentences
          .slice(index, index + audioConcurrency)
          .map((sentence, offset) =>
            createCard(sentence, index + offset),
          ),
      )),
    );
  }
  return cards;
}

function buildMigration(cards: OfficeSentenceCard[]) {
  const values = cards
    .map(
      (card) =>
        `    (${[
          card.sentence_cn,
          card.sentence_pinyin,
          card.sentence_vi,
          JSON.stringify(card.vocabulary),
          card.sentenceAudioUrl,
        ]
          .map(sqlLiteral)
          .join(", ")}, ${card.position})`,
    )
    .join(",\n");
  const activeSentences = cards
    .map((card) => sqlLiteral(card.sentence_cn))
    .join(", ");

  return `-- Add a reusable 150-sentence situational deck with highlighted vocabulary and audio.
insert into public.template_decks (slug, name, description, level)
values (
  '${templateSlug}',
  ${sqlLiteral(templateName)},
  ${sqlLiteral(templateDescription)},
  'Luyện câu'
)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = '${templateSlug}'
)
insert into public.template_sentence_cards (
  template_deck_id, sentence_cn, sentence_pinyin, sentence_vi,
  vocab_json, sentence_audio_url, position
)
select
  target_deck.id, card.sentence_cn, card.sentence_pinyin,
  card.sentence_vi, card.vocab_json::jsonb,
  card.sentence_audio_url, card.position
from target_deck
cross join (
  values
${values}
) as card(
  sentence_cn, sentence_pinyin, sentence_vi,
  vocab_json, sentence_audio_url, position
)
on conflict (template_deck_id, sentence_cn) do update
set
  sentence_pinyin = excluded.sentence_pinyin,
  sentence_vi = excluded.sentence_vi,
  vocab_json = excluded.vocab_json,
  sentence_audio_url = excluded.sentence_audio_url,
  position = excluded.position;

delete from public.template_sentence_cards
where template_deck_id = (
  select id from public.template_decks where slug = '${templateSlug}'
)
and sentence_cn not in (${activeSentences});
`;
}

async function syncTemplate(cards: OfficeSentenceCard[]) {
  const supabase = createSupabaseAdminClient();
  const { data: deck, error: deckError } = await supabase
    .from("template_decks")
    .upsert(
      {
        slug: templateSlug,
        name: templateName,
        description: templateDescription,
        level: "Luyện câu",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (deckError || !deck) {
    throw deckError || new Error("Không thể tạo bộ luyện câu mẫu.");
  }

  const rows = cards.map((card) => ({
    template_deck_id: deck.id,
    sentence_cn: card.sentence_cn,
    sentence_pinyin: card.sentence_pinyin,
    sentence_vi: card.sentence_vi,
    vocab_json: card.vocabulary,
    sentence_audio_url: card.sentenceAudioUrl,
    position: card.position,
  }));

  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await supabase
      .from("template_sentence_cards")
      .upsert(rows.slice(index, index + 50), {
        onConflict: "template_deck_id,sentence_cn",
      });
    if (error) {
      throw error;
    }
  }

  const activeSentences = new Set(
    cards.map((card) => card.sentence_cn),
  );
  const { data: existingCards, error: existingError } = await supabase
    .from("template_sentence_cards")
    .select("id,sentence_cn")
    .eq("template_deck_id", deck.id);
  if (existingError) {
    throw existingError;
  }

  const staleCardIds = (existingCards || [])
    .filter((card) => !activeSentences.has(card.sentence_cn))
    .map((card) => card.id);
  if (staleCardIds.length > 0) {
    const { error } = await supabase
      .from("template_sentence_cards")
      .delete()
      .in("id", staleCardIds);
    if (error) {
      throw error;
    }
  }

  const { count, error: countError } = await supabase
    .from("template_sentence_cards")
    .select("id", { count: "exact", head: true })
    .eq("template_deck_id", deck.id);
  if (countError) {
    throw countError;
  }
  if (count !== expectedTotal) {
    throw new Error(
      `Supabase cần có ${expectedTotal} câu, hiện có ${count ?? 0}.`,
    );
  }

  const activeAudioFiles = new Set(
    cards.map((card) =>
      new URL(card.sentenceAudioUrl).pathname.split("/").at(-1),
    ),
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
    `[sync] Đã đồng bộ ${count} câu; dọn ${staleCardIds.length} câu và ${staleAudioPaths.length} audio cũ.`,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  const sentences = await buildSentences();
  const cards = await buildCards(sentences);
  fs.writeFileSync(outputPath, buildMigration(cards), "utf8");
  await syncTemplate(cards);
  console.log(`Đã tạo ${outputPath} với ${cards.length} câu đầy đủ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
