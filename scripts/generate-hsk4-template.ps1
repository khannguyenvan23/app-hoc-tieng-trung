param(
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\supabase\migrations\018_hsk4_600_words.sql")
)

$ErrorActionPreference = "Stop"
$sourceUrl = "https://mychinese.vn/tu-vung-hsk-4.html"
$html = (Invoke-WebRequest -UseBasicParsing $sourceUrl).Content
$matches = [regex]::Matches(
  $html,
  '<tr><td>(\d+)</td><td>(.*?)</td><td>(.*?)</td><td>(.*?)</td></tr>',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

function ConvertFrom-HtmlCell([string]$Value) {
  $withoutTags = $Value -replace '<[^>]+>', ''
  $decoded = [System.Net.WebUtility]::HtmlDecode($withoutTags)
  return (($decoded -replace '\s+', ' ').Trim())
}

function ConvertTo-SqlLiteral([string]$Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

function ConvertFrom-Base64Utf8([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

$rows = @(
  $matches | ForEach-Object {
    [pscustomobject]@{
      Position = [int]$_.Groups[1].Value
      Chinese = ConvertFrom-HtmlCell $_.Groups[2].Value
      Pinyin = ConvertFrom-HtmlCell $_.Groups[3].Value
      Meaning = ConvertFrom-HtmlCell $_.Groups[4].Value
    }
  }
)

if ($rows.Count -ne 600) {
  throw "Expected 600 HSK4 rows, found $($rows.Count)."
}

$uniqueWords = @($rows.Chinese | Sort-Object -Unique)
if ($uniqueWords.Count -ne 600) {
  throw "Expected 600 unique HSK4 words, found $($uniqueWords.Count)."
}

$expectedPositions = 1..600
$actualPositions = @($rows.Position | Sort-Object)
if ((Compare-Object $expectedPositions $actualPositions).Count -ne 0) {
  throw "HSK4 positions must cover every number from 1 to 600."
}

$valueLines = for ($index = 0; $index -lt $rows.Count; $index += 1) {
  $row = $rows[$index]
  $suffix = if ($index -eq $rows.Count - 1) { '' } else { ',' }
  "    ($(ConvertTo-SqlLiteral $row.Chinese), $(ConvertTo-SqlLiteral $row.Pinyin), $(ConvertTo-SqlLiteral $row.Meaning), $($row.Position))$suffix"
}

$deckName = ConvertFrom-Base64Utf8 "SFNLNCBjxqEgYuG6o24="
$deckDescription = ConvertFrom-Base64Utf8 "QuG7mSA2MDAgdOG7qyB24buxbmcgSFNLNCBjxqEgYuG6o24sIG7hu5FpIHRp4bq/cCBzYXUgSFNLMSwgSFNLMiB2w6AgSFNLMy4="

$header = @"
-- HSK 2.0 Level 4: 600 level-specific words (1,200 cumulative through HSK4).
-- Vietnamese gloss source: $sourceUrl
insert into public.template_decks (slug, name, description, level)
values (
  'hsk4-co-ban',
  '$deckName',
  '$deckDescription',
  'HSK4'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  level = excluded.level;

with target_deck as (
  select id from public.template_decks where slug = 'hsk4-co-ban'
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
"@

$footer = @"
) as word(chinese, pinyin, meaning_vi, position)
on conflict (template_deck_id, chinese) do update
set
  pinyin = excluded.pinyin,
  meaning_vi = excluded.meaning_vi,
  position = excluded.position;
"@

$sql = $header + [Environment]::NewLine + ($valueLines -join [Environment]::NewLine) + [Environment]::NewLine + $footer
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.File]::WriteAllText($resolvedOutputPath, $sql, $utf8NoBom)

Write-Output "Generated $resolvedOutputPath with $($rows.Count) HSK4 words."
