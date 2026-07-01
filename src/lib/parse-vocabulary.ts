export type VocabularyItem = {
  chinese: string;
};

export function parseVocabularyText(input: string): VocabularyItem[] {
  const seen = new Set<string>();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]?.trim())
    .filter((chinese): chinese is string => Boolean(chinese))
    .filter((chinese) => {
      if (seen.has(chinese)) {
        return false;
      }
      seen.add(chinese);
      return true;
    })
    .map((chinese) => ({ chinese }));
}
