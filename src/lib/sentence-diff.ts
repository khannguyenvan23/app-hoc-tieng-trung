export type SentenceDiffStatus = "correct" | "wrong" | "missing" | "extra";

export type SentenceDiffItem = {
  actual: string | null;
  expected: string | null;
  status: SentenceDiffStatus;
};

export type SentenceDiffResult = {
  counts: Record<SentenceDiffStatus, number>;
  items: SentenceDiffItem[];
};

const punctuationOnlyPattern = /^[\p{P}\p{S}\s]+$/u;

function tokenizeChineseSentence(value: string) {
  const normalized = value.normalize("NFKC").trim();

  if (!normalized) {
    return [];
  }

  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("zh-Hans", {
      granularity: "word",
    });

    return Array.from(segmenter.segment(normalized), ({ segment }) => segment)
      .map((segment) => segment.trim())
      .filter(
        (segment) => segment && !punctuationOnlyPattern.test(segment),
      );
  }

  return Array.from(normalized).filter(
    (character) =>
      character.trim() && !punctuationOnlyPattern.test(character),
  );
}

function tokensMatch(left: string, right: string) {
  return left.toLocaleLowerCase("zh-CN") === right.toLocaleLowerCase("zh-CN");
}

function tokenSimilarity(left: string, right: string) {
  const leftCharacters = Array.from(left.toLocaleLowerCase("zh-CN"));
  const rightCharacters = new Set(
    Array.from(right.toLocaleLowerCase("zh-CN")),
  );

  if (leftCharacters.length === 0 || rightCharacters.size === 0) {
    return 0;
  }

  const matchingCharacters = leftCharacters.filter((character) =>
    rightCharacters.has(character),
  ).length;

  return matchingCharacters / Math.max(leftCharacters.length, rightCharacters.size);
}

export function compareChineseSentences(
  expectedSentence: string,
  actualSentence: string,
): SentenceDiffResult {
  const expectedTokens = tokenizeChineseSentence(expectedSentence);
  const actualTokens = tokenizeChineseSentence(actualSentence);
  const rows = expectedTokens.length + 1;
  const columns = actualTokens.length + 1;
  const distances = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  );

  for (let expectedIndex = 0; expectedIndex < rows; expectedIndex += 1) {
    distances[expectedIndex][0] = expectedIndex;
  }

  for (let actualIndex = 0; actualIndex < columns; actualIndex += 1) {
    distances[0][actualIndex] = actualIndex;
  }

  for (let expectedIndex = 1; expectedIndex < rows; expectedIndex += 1) {
    for (let actualIndex = 1; actualIndex < columns; actualIndex += 1) {
      const substitutionCost = tokensMatch(
        expectedTokens[expectedIndex - 1],
        actualTokens[actualIndex - 1],
      )
        ? 0
        : 1;

      distances[expectedIndex][actualIndex] = Math.min(
        distances[expectedIndex - 1][actualIndex] + 1,
        distances[expectedIndex][actualIndex - 1] + 1,
        distances[expectedIndex - 1][actualIndex - 1] + substitutionCost,
      );
    }
  }

  const reversedItems: SentenceDiffItem[] = [];
  let expectedIndex = expectedTokens.length;
  let actualIndex = actualTokens.length;

  while (expectedIndex > 0 || actualIndex > 0) {
    if (
      expectedIndex > 0 &&
      actualIndex > 0 &&
      tokensMatch(
        expectedTokens[expectedIndex - 1],
        actualTokens[actualIndex - 1],
      ) &&
      distances[expectedIndex][actualIndex] ===
        distances[expectedIndex - 1][actualIndex - 1]
    ) {
      reversedItems.push({
        actual: actualTokens[actualIndex - 1],
        expected: expectedTokens[expectedIndex - 1],
        status: "correct",
      });
      expectedIndex -= 1;
      actualIndex -= 1;
      continue;
    }

    const canSubstitute =
      expectedIndex > 0 &&
      actualIndex > 0 &&
      distances[expectedIndex][actualIndex] ===
        distances[expectedIndex - 1][actualIndex - 1] + 1;
    const canMarkMissing =
      expectedIndex > 0 &&
      distances[expectedIndex][actualIndex] ===
        distances[expectedIndex - 1][actualIndex] + 1;
    const canMarkExtra =
      actualIndex > 0 &&
      distances[expectedIndex][actualIndex] ===
        distances[expectedIndex][actualIndex - 1] + 1;

    if (canSubstitute && canMarkExtra && actualIndex > 1) {
      const expectedToken = expectedTokens[expectedIndex - 1];
      const currentSimilarity = tokenSimilarity(
        expectedToken,
        actualTokens[actualIndex - 1],
      );
      const previousSimilarity = tokenSimilarity(
        expectedToken,
        actualTokens[actualIndex - 2],
      );

      if (previousSimilarity > currentSimilarity) {
        reversedItems.push({
          actual: actualTokens[actualIndex - 1],
          expected: null,
          status: "extra",
        });
        actualIndex -= 1;
        continue;
      }
    }

    if (canSubstitute && canMarkMissing && expectedIndex > 1) {
      const actualToken = actualTokens[actualIndex - 1];
      const currentSimilarity = tokenSimilarity(
        expectedTokens[expectedIndex - 1],
        actualToken,
      );
      const previousSimilarity = tokenSimilarity(
        expectedTokens[expectedIndex - 2],
        actualToken,
      );

      if (previousSimilarity > currentSimilarity) {
        reversedItems.push({
          actual: null,
          expected: expectedTokens[expectedIndex - 1],
          status: "missing",
        });
        expectedIndex -= 1;
        continue;
      }
    }

    if (canSubstitute) {
      reversedItems.push({
        actual: actualTokens[actualIndex - 1],
        expected: expectedTokens[expectedIndex - 1],
        status: "wrong",
      });
      expectedIndex -= 1;
      actualIndex -= 1;
      continue;
    }

    if (canMarkMissing) {
      reversedItems.push({
        actual: null,
        expected: expectedTokens[expectedIndex - 1],
        status: "missing",
      });
      expectedIndex -= 1;
      continue;
    }

    reversedItems.push({
      actual: actualTokens[actualIndex - 1],
      expected: null,
      status: "extra",
    });
    actualIndex -= 1;
  }

  const items = reversedItems.reverse();
  const counts: SentenceDiffResult["counts"] = {
    correct: 0,
    wrong: 0,
    missing: 0,
    extra: 0,
  };

  items.forEach((item) => {
    counts[item.status] += 1;
  });

  return { counts, items };
}
