import assert from "node:assert/strict";
import test from "node:test";
import { compareChineseSentences } from "../src/lib/sentence-diff.ts";

test("empty dictation answer is shown as one missing sentence, not many extra words", () => {
  const result = compareChineseSentences("我们先做作业，再说别的事情。", "");

  assert.equal(result.counts.correct, 0);
  assert.equal(result.counts.wrong, 0);
  assert.equal(result.counts.extra, 0);
  assert.equal(result.counts.missing, 1);
  assert.deepEqual(result.items, [
    {
      actual: null,
      expected: "我们先做作业,再说别的事情。",
      status: "missing",
    },
  ]);
});

test("dictation diff still catches a missing character inside a partial answer", () => {
  const result = compareChineseSentences("这样做很简单。", "这样很简单");

  assert.equal(result.counts.extra, 0);
  assert.ok(
    result.items.some(
      (item) => item.status === "missing" && item.expected?.includes("做"),
    ),
  );
});
