export const siteConfig = {
  name: "Tiếng Trung Hihi",
  url: "https://www.tiengtrunghihi.com",
  description:
    "Học từ vựng tiếng Trung HSK bằng flashcard, audio, luyện câu, chép chính tả và lặp lại ngắt quãng.",
  keywords: [
    "học tiếng Trung",
    "từ vựng HSK",
    "HSK1",
    "HSK2",
    "flashcard tiếng Trung",
    "SRS tiếng Trung",
    "pinyin",
    "luyện câu tiếng Trung",
    "luyện chép chính tả tiếng Trung",
  ],
} as const;

export function absoluteSiteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
