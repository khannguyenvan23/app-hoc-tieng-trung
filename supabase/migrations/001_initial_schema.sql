create extension if not exists pgcrypto;

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  chinese text not null,
  pinyin text,
  meaning_vi text,
  example_cn text,
  example_pinyin text,
  example_vi text,
  word_audio_url text,
  sentence_audio_url text,
  created_at timestamp with time zone default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  next_review_at timestamp with time zone default now(),
  interval_days numeric default 0,
  ease_factor numeric default 2.5,
  review_count integer default 0,
  last_rating text,
  updated_at timestamp with time zone default now(),
  unique (user_id, card_id)
);

create index if not exists decks_user_id_idx on public.decks(user_id);
create index if not exists cards_user_id_idx on public.cards(user_id);
create index if not exists cards_deck_id_idx on public.cards(deck_id);
create index if not exists reviews_user_due_idx
  on public.reviews(user_id, next_review_at);

alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Users can read own decks" on public.decks;
create policy "Users can read own decks"
  on public.decks for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own decks" on public.decks;
create policy "Users can insert own decks"
  on public.decks for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own decks" on public.decks;
create policy "Users can update own decks"
  on public.decks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own decks" on public.decks;
create policy "Users can delete own decks"
  on public.decks for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own cards" on public.cards;
create policy "Users can read own cards"
  on public.cards for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own cards" on public.cards;
create policy "Users can insert own cards"
  on public.cards for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards"
  on public.cards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards"
  on public.cards for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own reviews" on public.reviews;
create policy "Users can read own reviews"
  on public.reviews for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own reviews" on public.reviews;
create policy "Users can insert own reviews"
  on public.reviews for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own reviews" on public.reviews;
create policy "Users can update own reviews"
  on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own reviews" on public.reviews;
create policy "Users can delete own reviews"
  on public.reviews for delete
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('card-audio', 'card-audio', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can read card audio" on storage.objects;
create policy "Users can read card audio"
  on storage.objects for select
  using (bucket_id = 'card-audio');

drop policy if exists "Users can upload own card audio" on storage.objects;
create policy "Users can upload own card audio"
  on storage.objects for insert
  with check (
    bucket_id = 'card-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own card audio" on storage.objects;
create policy "Users can update own card audio"
  on storage.objects for update
  using (
    bucket_id = 'card-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
