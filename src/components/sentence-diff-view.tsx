// Per-token breakdown of a typed answer against the expected Chinese, shared by
// the word and sentence study pages so both give the same "which characters did
// I get right/wrong/miss" feedback. Kept in one place because the two study
// pages are near-twins and must not drift.

import { alignPinyinToCharacters } from "@/lib/pinyin-align";
import type {
  SentenceDiffItem,
  SentenceDiffResult,
  SentenceDiffStatus,
} from "@/lib/sentence-diff";

const sentenceDiffLabels: Record<SentenceDiffStatus, string> = {
  correct: "Đúng",
  wrong: "Sai",
  missing: "Thiếu",
  extra: "Gõ dư",
};

const sentenceDiffStyles: Record<SentenceDiffStatus, string> = {
  correct:
    "border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 text-teal-900 dark:text-teal-200",
  wrong:
    "border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/15 text-red-900 dark:text-red-200",
  missing:
    "border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200",
  extra:
    "border-zinc-300 dark:border-white/15 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300",
};

function countChineseTokenCharacters(token: string | null | undefined) {
  if (!token) {
    return 0;
  }

  return Array.from(token.normalize("NFKC")).filter(
    (character) => !/^[\p{P}\p{S}\s]+$/u.test(character),
  ).length;
}

function getSentenceDiffPinyin(
  items: SentenceDiffItem[],
  sentenceCn: string | null | undefined,
  sentencePinyin: string | null | undefined,
) {
  // One syllable per Han character, or null when the pinyin cannot be split to
  // match the sentence — in that case show nothing rather than a wrong reading.
  const characterPinyin = alignPinyinToCharacters(sentenceCn, sentencePinyin);

  if (!characterPinyin) {
    return items.map(() => "");
  }

  let characterIndex = 0;

  return items.map((item) => {
    if (!item.expected) {
      return "";
    }

    const characterCount = countChineseTokenCharacters(item.expected);
    const tokenPinyin = characterPinyin.slice(
      characterIndex,
      characterIndex + characterCount,
    );
    characterIndex += characterCount;
    return tokenPinyin.join(" ");
  });
}

function SentenceDiffToken({
  item,
  pinyin,
}: {
  item: SentenceDiffItem;
  pinyin?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-2.5 py-1.5 text-left sm:block sm:min-w-14 sm:text-center ${sentenceDiffStyles[item.status]}`}
    >
      {pinyin ? (
        <div className="text-[11px] font-medium leading-tight text-teal-800 dark:text-teal-300">
          {pinyin}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-1 text-lg font-semibold sm:justify-center">
        {item.status === "wrong" ? (
          <>
            <span className="line-through opacity-70">{item.actual}</span>
            <span aria-hidden="true">→</span>
            <span>{item.expected}</span>
          </>
        ) : (
          <span className={item.status === "extra" ? "line-through" : ""}>
            {item.actual || item.expected}
          </span>
        )}
      </div>
      {item.status !== "missing" ? (
        <div className="text-right text-[11px] font-medium sm:mt-0.5 sm:text-center">
          {sentenceDiffLabels[item.status]}
        </div>
      ) : null}
    </div>
  );
}

// The full "Kết quả từng từ" panel: a counts summary plus one coloured token per
// character/word, with aligned pinyin above the expected reading.
export function SentenceDiffBreakdown({
  diff,
  chinese,
  pinyin,
}: {
  diff: SentenceDiffResult;
  chinese: string | null | undefined;
  pinyin: string | null | undefined;
}) {
  const pinyinByItem = getSentenceDiffPinyin(diff.items, chinese, pinyin);

  return (
    <div className="app-surface mt-3 rounded-xl p-3">
      <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Kết quả từng từ
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Đúng {diff.counts.correct} · Sai {diff.counts.wrong} · Thiếu{" "}
          {diff.counts.missing} · Gõ dư {diff.counts.extra}
        </p>
      </div>
      <div className="mt-2 grid gap-1.5 sm:flex sm:flex-wrap">
        {diff.items.map((item, itemIndex) => (
          <SentenceDiffToken
            item={item}
            key={`${item.status}-${itemIndex}-${item.actual || ""}-${item.expected || ""}`}
            pinyin={pinyinByItem[itemIndex]}
          />
        ))}
      </div>
    </div>
  );
}
