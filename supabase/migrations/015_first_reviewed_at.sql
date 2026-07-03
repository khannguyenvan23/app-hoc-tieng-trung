alter table public.reviews
  add column if not exists first_reviewed_at timestamp with time zone;

alter table public.sentence_reviews
  add column if not exists first_reviewed_at timestamp with time zone;

create index if not exists reviews_user_first_reviewed_idx
  on public.reviews(user_id, first_reviewed_at)
  where first_reviewed_at is not null;

create index if not exists sentence_reviews_user_first_reviewed_idx
  on public.sentence_reviews(user_id, first_reviewed_at)
  where first_reviewed_at is not null;
