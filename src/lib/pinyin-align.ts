// Stored pinyin follows normal orthography, where a multi-character word is one
// whitespace token ("餐厅" -> "cāntīng"). Anything that lines pinyin up with
// individual Han characters must therefore split those words into syllables
// first, otherwise every multi-character word eats an extra token and the whole
// sentence drifts out of alignment.

const HAN_PATTERN = /\p{Script=Han}/gu;

const PINYIN_INITIAL = "(?:zh|ch|sh|[bpmfdtnlgkhjqrxzcsyw])";
const PINYIN_VOWEL = "[aāáǎàeēéěèiīíǐìoōóǒòuūúǔùüǖǘǚǜvê]";
// The trailing digit keeps numeric tone marks ("hao3") attached to their
// syllable instead of dropping the tone.
const PINYIN_SYLLABLE = new RegExp(
  `^${PINYIN_INITIAL}?${PINYIN_VOWEL}+(?:ng|n|r)?[1-5]?`,
  "i",
);

export function countChineseCharacters(value: string | null | undefined) {
  return value ? (value.normalize("NFC").match(HAN_PATTERN) || []).length : 0;
}

// Split one pinyin word into syllables, e.g. "cāntīng" -> ["cān", "tīng"].
// Returns [] when the word cannot be parsed confidently.
export function splitPinyinSyllables(word: string): string[] {
  const syllables: string[] = [];
  let rest = word.normalize("NFC");

  while (rest) {
    const match = PINYIN_SYLLABLE.exec(rest);

    if (!match || !match[0]) {
      return [];
    }

    syllables.push(match[0]);
    rest = rest.slice(match[0].length);
  }

  return syllables;
}

// One pinyin syllable per Han character, or null when we cannot prove the
// alignment is right. Callers must render nothing on null — showing a syllable
// under the wrong character actively teaches the wrong reading.
export function alignPinyinToCharacters(
  sentenceCn: string | null | undefined,
  sentencePinyin: string | null | undefined,
): string[] | null {
  if (!sentenceCn || !sentencePinyin) {
    return null;
  }

  const characterCount = countChineseCharacters(sentenceCn);

  if (characterCount === 0) {
    return null;
  }

  const words = sentencePinyin
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}0-9]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const syllables: string[] = [];

  for (const word of words) {
    const parts = splitPinyinSyllables(word);

    if (parts.length === 0) {
      return null;
    }

    syllables.push(...parts);
  }

  return syllables.length === characterCount ? syllables : null;
}
