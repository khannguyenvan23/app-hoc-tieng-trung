create table if not exists public.sentence_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  sentence_cn text not null,
  sentence_pinyin text,
  sentence_vi text,
  vocab_json jsonb,
  sentence_audio_url text,
  created_at timestamp with time zone default now()
);

create table if not exists public.sentence_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_card_id uuid not null references public.sentence_cards(id) on delete cascade,
  next_review_at timestamp with time zone default now(),
  interval_days numeric default 0,
  ease_factor numeric default 2.5,
  review_count integer default 0,
  last_rating text,
  updated_at timestamp with time zone default now(),
  unique (user_id, sentence_card_id)
);

create index if not exists sentence_cards_user_id_idx
  on public.sentence_cards(user_id);
create index if not exists sentence_cards_deck_id_idx
  on public.sentence_cards(deck_id);
create index if not exists sentence_reviews_user_due_idx
  on public.sentence_reviews(user_id, next_review_at);

alter table public.sentence_cards enable row level security;
alter table public.sentence_reviews enable row level security;

drop policy if exists "Users can read own sentence cards" on public.sentence_cards;
create policy "Users can read own sentence cards"
  on public.sentence_cards for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own sentence cards" on public.sentence_cards;
create policy "Users can insert own sentence cards"
  on public.sentence_cards for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own sentence cards" on public.sentence_cards;
create policy "Users can update own sentence cards"
  on public.sentence_cards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own sentence cards" on public.sentence_cards;
create policy "Users can delete own sentence cards"
  on public.sentence_cards for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own sentence reviews" on public.sentence_reviews;
create policy "Users can read own sentence reviews"
  on public.sentence_reviews for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own sentence reviews" on public.sentence_reviews;
create policy "Users can insert own sentence reviews"
  on public.sentence_reviews for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own sentence reviews" on public.sentence_reviews;
create policy "Users can update own sentence reviews"
  on public.sentence_reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own sentence reviews" on public.sentence_reviews;
create policy "Users can delete own sentence reviews"
  on public.sentence_reviews for delete
  using (user_id = auth.uid());
