alter table public.template_cards
  add column if not exists word_audio_url text,
  add column if not exists sentence_audio_url text;

alter table public.template_sentence_cards
  add column if not exists sentence_audio_url text;
