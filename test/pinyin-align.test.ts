import assert from "node:assert/strict";
import test from "node:test";
import {
  alignPinyinToCharacters,
  countChineseCharacters,
  splitPinyinSyllables,
} from "../src/lib/pinyin-align.ts";

test("multi-character pinyin words are split into one syllable per character", () => {
  assert.deepEqual(splitPinyinSyllables("cāntīng"), ["cān", "tīng"]);
  assert.deepEqual(splitPinyinSyllables("yǒumíng"), ["yǒu", "míng"]);
  assert.deepEqual(splitPinyinSyllables("xǐhuān"), ["xǐ", "huān"]);
  assert.deepEqual(splitPinyinSyllables("zhèlǐ"), ["zhè", "lǐ"]);
  assert.deepEqual(splitPinyinSyllables("chīfàn"), ["chī", "fàn"]);
  assert.deepEqual(splitPinyinSyllables("gōngyuán"), ["gōng", "yuán"]);
  assert.deepEqual(splitPinyinSyllables("duō"), ["duō"]);
  assert.deepEqual(splitPinyinSyllables("ér"), ["ér"]);
});

test("the sentence that drifted now lines up one syllable per character", () => {
  // Regression: pinyin is stored per word, so counting characters against
  // whitespace tokens shifted every reading after the first 2-character word.
  const sentence = "这家餐厅很有名，很多人喜欢来这里吃饭。";
  const pinyin = "Zhè jiā cāntīng hěn yǒumíng, hěn duō rén xǐhuān lái zhèlǐ chīfàn.";

  const aligned = alignPinyinToCharacters(sentence, pinyin);

  assert.ok(aligned, "expected the sentence to align");
  assert.equal(aligned.length, countChineseCharacters(sentence));
  assert.deepEqual(aligned, [
    "Zhè",
    "jiā",
    "cān",
    "tīng",
    "hěn",
    "yǒu",
    "míng",
    "hěn",
    "duō",
    "rén",
    "xǐ",
    "huān",
    "lái",
    "zhè",
    "lǐ",
    "chī",
    "fàn",
  ]);
});

test("alignment refuses to guess when the syllables cannot match", () => {
  // Wrong syllable count must yield null so the UI hides pinyin instead of
  // printing a reading under the wrong character.
  assert.equal(alignPinyinToCharacters("我家住在城市的西边。", "wǒ jiā"), null);
  assert.equal(alignPinyinToCharacters("我家", null), null);
  assert.equal(alignPinyinToCharacters("", "wǒ"), null);
  // Unparseable pinyin (no vowel) must not be force-fitted either.
  assert.equal(alignPinyinToCharacters("我家", "bcd fgh"), null);
});

test("numeric tone marks stay attached to their syllable", () => {
  assert.deepEqual(splitPinyinSyllables("hao3"), ["hao3"]);
  assert.deepEqual(alignPinyinToCharacters("你好", "ni3 hao3"), ["ni3", "hao3"]);
});

test("a fully aligned simple sentence keeps character order", () => {
  const aligned = alignPinyinToCharacters(
    "我家住在城市的西边。",
    "Wǒ jiā zhù zài chéngshì de xībiān.",
  );

  assert.deepEqual(aligned, [
    "Wǒ",
    "jiā",
    "zhù",
    "zài",
    "chéng",
    "shì",
    "de",
    "xī",
    "biān",
  ]);
});
