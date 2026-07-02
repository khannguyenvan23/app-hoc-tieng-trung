alter table public.reviews
  add column if not exists weak_score integer not null default 0,
  add column if not exists lapse_count integer not null default 0,
  add column if not exists weak_since timestamp with time zone;

alter table public.sentence_reviews
  add column if not exists weak_score integer not null default 0,
  add column if not exists lapse_count integer not null default 0,
  add column if not exists weak_since timestamp with time zone;

create index if not exists reviews_user_weak_idx
  on public.reviews(user_id, weak_score desc, updated_at desc)
  where weak_score >= 2;

create index if not exists sentence_reviews_user_weak_idx
  on public.sentence_reviews(user_id, weak_score desc, updated_at desc)
  where weak_score >= 2;
