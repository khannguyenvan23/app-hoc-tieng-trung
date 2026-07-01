import OpenAI from "openai";
import { z } from "zod";
import type { GeneratedCard, GeneratedSentenceCard } from "@/lib/types";

const generatedCardSchema = z.object({
  chinese: z.string().min(1),
  pinyin: z.string().min(1),
  meaning_vi: z.string().min(1),
  example_cn: z.string().min(1),
  example_pinyin: z.string().min(1),
  example_vi: z.string().min(1),
});

const generatedSentenceCardSchema = z.object({
  sentence_cn: z.string().min(1),
  sentence_pinyin: z.string().min(1),
  sentence_vi: z.string().min(1),
  vocab_items: z
    .array(
      z.object({
        chinese: z.string().min(1),
        pinyin: z.string().min(1),
        meaning_vi: z.string().min(1),
      }),
    )
    .min(1),
});

export async function generateCardData(
  chinese: string,
  meaningVi?: string,
): Promise<GeneratedCard> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      chinese,
      pinyin: "",
      meaning_vi: meaningVi || "Cần thêm OPENAI_API_KEY để AI tự tạo nghĩa.",
      example_cn: `${chinese}。`,
      example_pinyin: "",
      example_vi: meaningVi || "Cần thêm OPENAI_API_KEY để AI tự tạo câu ví dụ.",
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Bạn là giáo viên tiếng Trung cho người Việt trình độ HSK2-HSK3. Tạo dữ liệu flashcard. Nếu người dùng không cung cấp nghĩa tiếng Việt, hãy tự suy luận nghĩa thông dụng nhất. Pinyin phải có dấu thanh. Câu ví dụ tiếng Trung phải đơn giản, tự nhiên, phù hợp HSK2-HSK3. example_pinyin là pinyin có dấu thanh cho toàn bộ câu ví dụ. Dịch tiếng Việt phải tự nhiên và có dấu đầy đủ. Chỉ trả về JSON hợp lệ, không giải thích thêm.",
      },
      {
        role: "user",
        content: `Input:
Chinese: ${chinese}
Meaning Vietnamese: ${meaningVi || "(not provided, please generate)"}

Output JSON:
{
  "chinese": "...",
  "pinyin": "...",
  "meaning_vi": "...",
  "example_cn": "...",
  "example_pinyin": "...",
  "example_vi": "..."
}`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return generatedCardSchema.parse(JSON.parse(content));
}

export async function generateSentenceCardData(
  sentenceCn: string,
): Promise<GeneratedSentenceCard> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      sentence_cn: sentenceCn,
      sentence_pinyin: "",
      sentence_vi: "Cần thêm OPENAI_API_KEY để AI tự tạo nghĩa câu.",
      vocab_items: [],
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Bạn là giáo viên tiếng Trung cho người Việt trình độ HSK2-HSK3. Tạo dữ liệu luyện câu. sentence_pinyin là pinyin có dấu thanh cho toàn bộ câu. sentence_vi là bản dịch tiếng Việt tự nhiên, có dấu đầy đủ. vocab_items là các từ/cụm từ quan trọng trong câu, mỗi mục có chinese, pinyin có dấu thanh, meaning_vi. Chỉ trả về JSON hợp lệ, không giải thích thêm.",
      },
      {
        role: "user",
        content: `Input sentence:
${sentenceCn}

Output JSON:
{
  "sentence_cn": "...",
  "sentence_pinyin": "...",
  "sentence_vi": "...",
  "vocab_items": [
    { "chinese": "...", "pinyin": "...", "meaning_vi": "..." }
  ]
}`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return generatedSentenceCardSchema.parse(JSON.parse(content));
}

export async function generateSentenceFromWord(
  word: string,
): Promise<GeneratedSentenceCard> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      sentence_cn: word,
      sentence_pinyin: "",
      sentence_vi: "Cần thêm OPENAI_API_KEY để AI tự tạo câu.",
      vocab_items: [],
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Bạn là giáo viên tiếng Trung cho người Việt trình độ HSK2-HSK3. Người dùng đưa một từ tiếng Trung đơn lẻ. Hãy tạo một câu tiếng Trung đơn giản, tự nhiên, có chứa đúng từ đó hoặc dạng cụm từ phù hợp của từ đó. Tạo sentence_pinyin có dấu thanh cho toàn bộ câu, sentence_vi là bản dịch tiếng Việt tự nhiên có dấu đầy đủ. vocab_items là các từ/cụm từ quan trọng trong câu, bao gồm từ mục tiêu, mỗi mục có chinese, pinyin có dấu thanh, meaning_vi. Chỉ trả về JSON hợp lệ, không giải thích thêm.",
      },
      {
        role: "user",
        content: `Target word:
${word}

Output JSON:
{
  "sentence_cn": "...",
  "sentence_pinyin": "...",
  "sentence_vi": "...",
  "vocab_items": [
    { "chinese": "...", "pinyin": "...", "meaning_vi": "..." }
  ]
}`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return generatedSentenceCardSchema.parse(JSON.parse(content));
}
