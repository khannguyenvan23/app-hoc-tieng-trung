create table if not exists public.user_study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_new_card_limit integer not null default 10,
  daily_new_sentence_limit integer not null default 5,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint daily_new_card_limit_range check (
    daily_new_card_limit >= 0 and daily_new_card_limit <= 100
  ),
  constraint daily_new_sentence_limit_range check (
    daily_new_sentence_limit >= 0 and daily_new_sentence_limit <= 100
  )
);

alter table public.user_study_settings enable row level security;

drop policy if exists "Users can read own study settings" on public.user_study_settings;
create policy "Users can read own study settings"
  on public.user_study_settings for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own study settings" on public.user_study_settings;
create policy "Users can insert own study settings"
  on public.user_study_settings for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own study settings" on public.user_study_settings;
create policy "Users can update own study settings"
  on public.user_study_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
