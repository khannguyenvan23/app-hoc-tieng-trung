alter table public.user_study_settings
  add column if not exists learning_steps text not null default '10m',
  add column if not exists graduating_interval_days integer not null default 1,
  add column if not exists easy_interval_days integer not null default 4,
  add column if not exists insertion_order text not null default 'sequential',
  add column if not exists review_again_interval_minutes integer not null default 10,
  add column if not exists hard_interval_multiplier numeric not null default 1.2,
  add column if not exists starting_ease_factor numeric not null default 2.5,
  add column if not exists minimum_ease_factor numeric not null default 1.3,
  add column if not exists maximum_interval_days integer not null default 365;

update public.user_study_settings
set
  learning_steps = coalesce(nullif(trim(learning_steps), ''), '10m'),
  graduating_interval_days = coalesce(graduating_interval_days, 1),
  easy_interval_days = coalesce(easy_interval_days, 4),
  insertion_order = coalesce(nullif(trim(insertion_order), ''), 'sequential'),
  review_again_interval_minutes = coalesce(review_again_interval_minutes, 10),
  hard_interval_multiplier = coalesce(hard_interval_multiplier, 1.2),
  starting_ease_factor = coalesce(starting_ease_factor, 2.5),
  minimum_ease_factor = coalesce(minimum_ease_factor, 1.3),
  maximum_interval_days = coalesce(maximum_interval_days, 365);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'learning_steps_format'
  ) then
    alter table public.user_study_settings
      add constraint learning_steps_format
      check (learning_steps ~ '^([0-9]+[mhd])([[:space:]]+[0-9]+[mhd]){0,7}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'graduating_interval_days_range'
  ) then
    alter table public.user_study_settings
      add constraint graduating_interval_days_range
      check (graduating_interval_days >= 1 and graduating_interval_days <= 365);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'easy_interval_days_range'
  ) then
    alter table public.user_study_settings
      add constraint easy_interval_days_range
      check (easy_interval_days >= 1 and easy_interval_days <= 365);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'insertion_order_value'
  ) then
    alter table public.user_study_settings
      add constraint insertion_order_value
      check (insertion_order in ('sequential', 'random'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'review_again_interval_minutes_range'
  ) then
    alter table public.user_study_settings
      add constraint review_again_interval_minutes_range
      check (
        review_again_interval_minutes >= 1
        and review_again_interval_minutes <= 1440
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'hard_interval_multiplier_range'
  ) then
    alter table public.user_study_settings
      add constraint hard_interval_multiplier_range
      check (hard_interval_multiplier >= 1 and hard_interval_multiplier <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'starting_ease_factor_range'
  ) then
    alter table public.user_study_settings
      add constraint starting_ease_factor_range
      check (starting_ease_factor >= 1.3 and starting_ease_factor <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'minimum_ease_factor_range'
  ) then
    alter table public.user_study_settings
      add constraint minimum_ease_factor_range
      check (minimum_ease_factor >= 1.1 and minimum_ease_factor <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'maximum_interval_days_range'
  ) then
    alter table public.user_study_settings
      add constraint maximum_interval_days_range
      check (maximum_interval_days >= 1 and maximum_interval_days <= 3650);
  end if;
end $$;
