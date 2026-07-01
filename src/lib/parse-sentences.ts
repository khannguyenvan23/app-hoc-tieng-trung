export type SentenceImportItem = {
  sentence_cn: string;
};

export function parseSentenceText(input: string): SentenceImportItem[] {
  const seen = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((sentence) => {
      if (seen.has(sentence)) {
        return false;
      }
      seen.add(sentence);
      return true;
    })
    .map((sentence_cn) => ({ sentence_cn }));
}
