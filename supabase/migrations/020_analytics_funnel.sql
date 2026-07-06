create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'page_view',
      'signup_submitted',
      'email_verified',
      'first_study',
      'daily_active',
      'returned_next_day'
    )
  ),
  anonymous_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamp with time zone not null default now()
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_user_name_idx
  on public.analytics_events(user_id, event_name)
  where user_id is not null;

create index if not exists analytics_events_anonymous_created_idx
  on public.analytics_events(anonymous_id, created_at desc)
  where anonymous_id is not null;

alter table public.analytics_events enable row level security;

-- Analytics is written and read only by server routes using the service role.
-- No browser-facing RLS policy is intentionally created.

with first_studies as (
  select user_id, min(first_reviewed_at) as first_studied_at
  from (
    select user_id, first_reviewed_at
    from public.reviews
    where first_reviewed_at is not null
    union all
    select user_id, first_reviewed_at
    from public.sentence_reviews
    where first_reviewed_at is not null
  ) learned
  group by user_id
)
insert into public.analytics_events (
  event_name,
  user_id,
  dedupe_key,
  created_at
)
select
  'first_study',
  user_id,
  'first_study:' || user_id::text,
  first_studied_at
from first_studies
on conflict (dedupe_key) do nothing;

with first_studies as (
  select user_id, min(first_reviewed_at) as first_studied_at
  from (
    select user_id, first_reviewed_at
    from public.reviews
    where first_reviewed_at is not null
    union all
    select user_id, first_reviewed_at
    from public.sentence_reviews
    where first_reviewed_at is not null
  ) learned
  group by user_id
)
insert into public.analytics_events (
  event_name,
  user_id,
  dedupe_key,
  created_at
)
select
  'returned_next_day',
  studies.user_id,
  'returned_next_day:' || studies.user_id::text,
  studies.first_studied_at
from first_studies studies
join auth.users users on users.id = studies.user_id
where
  timezone('Asia/Ho_Chi_Minh', studies.first_studied_at)::date =
  timezone('Asia/Ho_Chi_Minh', users.created_at)::date + 1
on conflict (dedupe_key) do nothing;
