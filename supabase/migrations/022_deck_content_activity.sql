alter table public.decks
  add column if not exists last_card_added_at timestamp with time zone,
  add column if not exists last_sentence_added_at timestamp with time zone;

update public.decks deck
set last_card_added_at = coalesce(
  (
    select max(card.created_at)
    from public.cards card
    where card.deck_id = deck.id
  ),
  deck.created_at
)
where deck.last_card_added_at is null;

update public.decks deck
set last_sentence_added_at = coalesce(
  (
    select max(sentence_card.created_at)
    from public.sentence_cards sentence_card
    where sentence_card.deck_id = deck.id
  ),
  deck.created_at
)
where deck.last_sentence_added_at is null;

alter table public.decks
  alter column last_card_added_at set default now(),
  alter column last_sentence_added_at set default now();

create index if not exists decks_user_last_card_added_idx
  on public.decks(user_id, last_card_added_at desc);

create index if not exists decks_user_last_sentence_added_idx
  on public.decks(user_id, last_sentence_added_at desc);

create or replace function public.touch_deck_last_card_added_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.decks
  set last_card_added_at = greatest(
    coalesce(last_card_added_at, '-infinity'::timestamptz),
    coalesce(new.created_at, now())
  )
  where id = new.deck_id;

  return new;
end;
$$;

create or replace function public.touch_deck_last_sentence_added_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.decks
  set last_sentence_added_at = greatest(
    coalesce(last_sentence_added_at, '-infinity'::timestamptz),
    coalesce(new.created_at, now())
  )
  where id = new.deck_id;

  return new;
end;
$$;

drop trigger if exists cards_touch_deck_last_card_added_at on public.cards;
create trigger cards_touch_deck_last_card_added_at
  after insert on public.cards
  for each row
  execute function public.touch_deck_last_card_added_at();

drop trigger if exists sentence_cards_touch_deck_last_sentence_added_at on public.sentence_cards;
create trigger sentence_cards_touch_deck_last_sentence_added_at
  after insert on public.sentence_cards
  for each row
  execute function public.touch_deck_last_sentence_added_at();
