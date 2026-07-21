from __future__ import annotations

import argparse
import re
import tempfile
import urllib.request
from pathlib import Path

import pdfplumber


SOURCE_URL = (
    "https://mychinese.vn/wp-content/uploads/2021/10/"
    "25000-tu-vung-hsk-6-MYCHINESE.VN.pdf"
)


def clean_text(parts: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def extract_rows(pdf_path: Path) -> list[tuple[int, str, str, str]]:
    rows: list[tuple[int, str, str, str]] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
            anchors = sorted(
                (
                    word
                    for word in words
                    if 65 <= float(word["x0"]) <= 105
                    and re.fullmatch(r"\d{1,4}", str(word["text"]))
                    and 1 <= int(str(word["text"])) <= 2500
                ),
                key=lambda word: float(word["top"]),
            )

            for index, anchor in enumerate(anchors):
                top = float(anchor["top"])
                lower_bound = (
                    (float(anchors[index - 1]["top"]) + top) / 2
                    if index > 0
                    else max(0, top - 24)
                )
                upper_bound = (
                    (top + float(anchors[index + 1]["top"])) / 2
                    if index + 1 < len(anchors)
                    else min(float(page.height), top + 28)
                )
                row_words = [
                    word
                    for word in words
                    if lower_bound <= float(word["top"]) < upper_bound
                ]
                row_words.sort(key=lambda word: (float(word["top"]), float(word["x0"])))

                chinese = clean_text(
                    [
                        str(word["text"])
                        for word in row_words
                        if 105 <= float(word["x0"]) < 190
                    ]
                ).replace(" ", "")
                pinyin = clean_text(
                    [
                        str(word["text"])
                        for word in row_words
                        if 190 <= float(word["x0"]) < 338
                    ]
                )
                meaning = clean_text(
                    [
                        str(word["text"])
                        for word in row_words
                        if float(word["x0"]) >= 338
                    ]
                )
                rows.append((int(str(anchor["text"])), chinese, pinyin, meaning))

    rows.sort(key=lambda row: row[0])
    return rows


def validate_rows(rows: list[tuple[int, str, str, str]]) -> None:
    positions = [row[0] for row in rows]
    if positions != list(range(1, 2501)):
        missing = sorted(set(range(1, 2501)) - set(positions))
        duplicates = sorted(
            position for position in set(positions) if positions.count(position) > 1
        )
        raise ValueError(
            f"Expected positions 1..2500; missing={missing[:20]}, "
            f"duplicates={duplicates[:20]}, rows={len(rows)}"
        )

    empty_rows = [position for position, chinese, pinyin, meaning in rows if not all((chinese, pinyin, meaning))]
    if empty_rows:
        raise ValueError(f"Rows with empty fields: {empty_rows[:20]}")

    chinese_words = [row[1] for row in rows]
    duplicate_words = sorted(
        word for word in set(chinese_words) if chinese_words.count(word) > 1
    )
    if duplicate_words:
        raise ValueError(f"Duplicate Chinese words: {duplicate_words[:20]}")


def build_sql(rows: list[tuple[int, str, str, str]]) -> str:
    values = ",\n".join(
        "    ("
        + ", ".join(
            (
                sql_literal(chinese),
                sql_literal(pinyin),
                sql_literal(meaning),
                str(position),
            )
        )
        + ")"
        for position, chinese, pinyin, meaning in rows
    )

    return f"""-- HSK 2.0 Level 6: 2,500 level-specific words (5,000 cumulative through HSK6).
-- Vietnamese gloss source: {SOURCE_URL}
insert into public.template_decks (slug, name, description, level)
values (
  'hsk6-co-ban',
  'HSK6 cơ bản',
  'Bộ 2.500 từ vựng HSK6 cơ bản, nối tiếp sau HSK1 đến HSK5.',
  'HSK6'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = 'hsk6-co-ban'
)
insert into public.template_cards (
  template_deck_id,
  chinese,
  pinyin,
  meaning_vi,
  position
)
select
  target_deck.id,
  word.chinese,
  word.pinyin,
  word.meaning_vi,
  word.position
from target_deck
cross join (
  values
{values}
) as word(chinese, pinyin, meaning_vi, position)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  position = excluded.position;
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the HSK6 template migration.")
    parser.add_argument("output", type=Path)
    parser.add_argument("--pdf", type=Path)
    args = parser.parse_args()

    if args.pdf:
        pdf_path = args.pdf
    else:
        pdf_path = Path(tempfile.gettempdir()) / "hsk6-mychinese.pdf"
        urllib.request.urlretrieve(SOURCE_URL, pdf_path)

    rows = extract_rows(pdf_path)
    validate_rows(rows)
    args.output.write_text(build_sql(rows), encoding="utf-8", newline="\n")
    print(f"Generated {args.output.resolve()} with {len(rows)} HSK6 words.")


if __name__ == "__main__":
    main()
