-- Repair HSK5 decks copied before the API fetched template cards with pagination.
-- Supabase/PostgREST returns 1,000 rows by default, so some user decks may be
-- missing the final 300 HSK5 cards.
with hsk5_user_decks as (
  select
    decks.id,
    decks.user_id
  from public.decks
  where decks.source_template_slug = 'hsk5-co-ban'
    or (decks.source_template_slug is null and decks.name = 'HSK5 cơ bản')
),
missing_template_cards as (
  select
    user_deck.user_id,
    user_deck.id as deck_id,
    template_card.chinese,
    template_card.pinyin,
    template_card.meaning_vi,
    template_card.example_cn,
    template_card.example_pinyin,
    template_card.example_vi,
    template_card.word_audio_url,
    template_card.sentence_audio_url
  from hsk5_user_decks as user_deck
  join public.template_decks as template_deck
    on template_deck.slug = 'hsk5-co-ban'
  join public.template_cards as template_card
    on template_card.template_deck_id = template_deck.id
  where not exists (
    select 1
    from public.cards as existing_card
    where existing_card.deck_id = user_deck.id
      and existing_card.user_id = user_deck.user_id
      and existing_card.chinese = template_card.chinese
  )
),
inserted_cards as (
  insert into public.cards (
    user_id,
    deck_id,
    chinese,
    pinyin,
    meaning_vi,
    example_cn,
    example_pinyin,
    example_vi,
    word_audio_url,
    sentence_audio_url
  )
  select
    user_id,
    deck_id,
    chinese,
    pinyin,
    meaning_vi,
    example_cn,
    example_pinyin,
    example_vi,
    word_audio_url,
    sentence_audio_url
  from missing_template_cards
  returning id, user_id
)
insert into public.reviews (user_id, card_id, next_review_at)
select
  inserted_cards.user_id,
  inserted_cards.id,
  now() - interval '1 minute'
from inserted_cards
on conflict (user_id, card_id) do nothing;
