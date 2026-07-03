# Hanzi Cards

MVP web app for learning Chinese vocabulary with flashcards, AI-generated pinyin/examples, TTS audio, and spaced repetition.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage
- OpenAI for card generation and TTS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project and run the SQL in:

```text
supabase/migrations/001_initial_schema.sql
```

The migration creates `decks`, `cards`, `reviews`, RLS policies, and a public `card-audio` storage bucket.

3. Copy env variables:

```bash
cp .env.example .env.local
```

Fill:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_CONTACT_PHONE=
```

`OPENAI_API_KEY` is optional for local UI testing. Without it, import still creates cards with fallback data but no audio.

4. Run locally:

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

This app can be deployed as a normal Next.js project on Vercel.

1. Push the project to GitHub.
2. In Vercel, choose **Add New Project** and import the GitHub repo.
3. Add these environment variables in **Project Settings > Environment Variables**:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
NEXT_PUBLIC_CONTACT_PHONE=
```

4. Use the default build settings:

```text
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

5. Deploy, then open the generated Vercel URL.

Before production use, make sure Supabase has all SQL migrations applied:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_example_pinyin.sql
supabase/migrations/003_sentence_cards.sql
```

For Supabase Auth, add the deployed site URL to **Authentication > URL Configuration**:

```text
Site URL: https://your-project.vercel.app
Redirect URLs: https://your-project.vercel.app/**
```

## Routes

- `/login` - sign in or sign up with Supabase Auth
- `/pricing` - public credit pricing and phone/Zalo contact page
- `/dashboard` - list decks
- `/decks/new` - create a deck
- `/decks/[deckId]` - view deck cards
- `/decks/[deckId]/import` - paste vocabulary and generate flashcards
- `/study` - review due cards

## API

### `POST /api/generate-card`

Requires `Authorization: Bearer <supabase_access_token>`.

```json
{
  "chinese": "好吃"
}
```

### `POST /api/import-vocabulary`

```json
{
  "deckId": "uuid",
  "items": [{ "chinese": "好吃" }]
}
```

AI generates Vietnamese meaning, pinyin, and examples for each Chinese word. The import creates cards, generates audio when `OPENAI_API_KEY` is set, uploads audio to Supabase Storage, and creates review rows.

### `POST /api/review`

```json
{
  "cardId": "uuid",
  "rating": "again"
}
```

Review schedule:

- `again`: 10 minutes
- `hard`: 1 day
- `good`: 3 days
- `easy`: 7 days

## Notes

- API routes validate input with Zod.
- Client pages use Supabase Auth session and RLS for user data.
- Server API routes use the Supabase service role key after validating the user access token.
