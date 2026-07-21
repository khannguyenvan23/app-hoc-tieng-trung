@AGENTS.md

# Tieng Trung Hihi

Vietnamese-language Chinese-learning app: SRS flashcards (words + sentences),
audio, dictation and writing practice. Next.js App Router + Supabase + Tailwind v4.

**All user-facing copy is Vietnamese.** Code identifiers and comments are English.

## Start here

`docs/code-map.md` is the reading guide — it maps screens to APIs to tables to
logic files, and has a debug checklist per bug type. Read it before opening
source files. Keep it updated when you add a lib file or change SRS behaviour.

## Commands

```bash
npm run test:srs   # SRS + sentence diff + pinyin alignment tests
npm run sim:srs    # simulate a learner over 365 days, checks SRS invariants
npm run lint
npm run build
npx tsc --noEmit
```

Before finishing any change: `npx tsc --noEmit`, `npm run lint`, and
`npm run test:srs`. Run `npm run build` for anything touching CSS or routing.

## The two study pages are near-twins

`src/app/study/page.tsx` (words) and `src/app/study-sentences/page.tsx`
(sentences) share almost identical logic. **A fix in one almost always belongs
in the other.** Check both before declaring a change done.

Each page has **two separate data-loading paths**:

- `loadReviews()` — runs when the queue empties or a learning-step timer fires.
- a large `useEffect` — runs on page load / F5 and on deck change.

Both must stay in sync. Session progress was once restored in only one of them,
which made the progress bar reset to 1% on every reload.

## SRS rules

Core: `src/lib/review.ts`, `getNextReview()`. Read `test/srs-logic.test.ts`
first — it reads as the spec.

- **`learning_step` decides the phase, not `interval_days`.**
  `-1` = graduated review card; `>= 0` = stepping through learning/relearning.
- While relearning, `interval_days` holds the interval to restore afterwards.
- Ease never changes during learning/relearning, and drops only once per lapse.
- `hard < good < easy` must hold at every interval (guarded by a property test).
- Fuzz (`applyReviewFuzz`) runs **in the API routes only**, never inside
  `getNextReview`, so the interval preview on the rating buttons stays stable.

Never reintroduce the assumption that `interval_days <= 0` means "learning" —
that was the old model and it is wrong now.

## Queue loading

`src/lib/due-reviews.ts` runs **two separate queries** — learned cards and new
cards. Do not merge them back into one query with a shared row limit: new rows
carry their creation time in `next_review_at`, so a deck of old unstudied cards
starves every due review out of the limit.

## Database

Migrations live in `supabase/migrations/`, applied **by hand** through the
Supabase SQL editor — there is no CLI or migration runner in this repo. Write
migrations idempotently (`add column if not exists`, guarded `update`).

New columns must degrade gracefully: the app still runs when a migration has not
been applied yet (see how `learning_step` and the weak-queue columns are probed
in the review API routes).

## Styling

Tailwind v4, no config file. `src/app/globals.css` holds the design tokens.

- Use `--radius-sm/md/lg` and `--shadow-sm/md/lg`. Do not add one-off border
  radius or box-shadow values.
- Dark mode keys off `[data-theme="dark"]` on `<html>` (set by
  `theme-toggle.tsx`), declared via `@custom-variant dark` — not
  `prefers-color-scheme` directly.
- **Always add light and dark together**, e.g. `bg-white dark:bg-[#171a19]`.
  Text with no explicit colour inherits `--foreground`, which flips in dark
  mode; if the surface has no dark variant you get light text on a light
  background.
- Respect `prefers-reduced-motion` when adding animation.

## Scope

Do not add features, refactors, or files beyond what was asked. When you spot a
real problem outside the current task, say so and let the user decide.
