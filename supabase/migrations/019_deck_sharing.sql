create table if not exists public.deck_shares (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null unique references public.decks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.decks
  add column if not exists source_share_id uuid
  references public.deck_shares(id) on delete set null;

create index if not exists deck_shares_owner_id_idx
  on public.deck_shares(owner_id);

create unique index if not exists decks_user_source_share_unique_idx
  on public.decks(user_id, source_share_id)
  where source_share_id is not null;

alter table public.deck_shares enable row level security;

drop policy if exists "Users can read own deck shares" on public.deck_shares;
create policy "Users can read own deck shares"
  on public.deck_shares for select
  using (owner_id = auth.uid());

drop policy if exists "Users can create own deck shares" on public.deck_shares;
create policy "Users can create own deck shares"
  on public.deck_shares for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.decks
      where decks.id = deck_shares.deck_id
        and decks.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own deck shares" on public.deck_shares;
create policy "Users can update own deck shares"
  on public.deck_shares for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users can delete own deck shares" on public.deck_shares;
create policy "Users can delete own deck shares"
  on public.deck_shares for delete
  using (owner_id = auth.uid());
