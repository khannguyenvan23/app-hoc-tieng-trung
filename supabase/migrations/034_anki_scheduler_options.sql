alter table public.user_study_settings
  add column if not exists easy_bonus numeric not null default 1.3,
  add column if not exists interval_modifier numeric not null default 1,
  add column if not exists relearning_steps text not null default '10m',
  add column if not exists new_interval_percentage numeric not null default 0,
  add column if not exists minimum_lapse_interval_days integer not null default 1;

update public.user_study_settings
set
  easy_bonus = coalesce(easy_bonus, 1.3),
  interval_modifier = coalesce(interval_modifier, 1),
  relearning_steps = coalesce(nullif(trim(relearning_steps), ''), '10m'),
  new_interval_percentage = coalesce(new_interval_percentage, 0),
  minimum_lapse_interval_days = coalesce(minimum_lapse_interval_days, 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'easy_bonus_range'
  ) then
    alter table public.user_study_settings
      add constraint easy_bonus_range
      check (easy_bonus >= 1 and easy_bonus <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'interval_modifier_range'
  ) then
    alter table public.user_study_settings
      add constraint interval_modifier_range
      check (interval_modifier >= 0.1 and interval_modifier <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'relearning_steps_format'
  ) then
    alter table public.user_study_settings
      add constraint relearning_steps_format
      check (relearning_steps ~ '^([0-9]+[mhd])([[:space:]]+[0-9]+[mhd]){0,7}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'new_interval_percentage_range'
  ) then
    alter table public.user_study_settings
      add constraint new_interval_percentage_range
      check (
        new_interval_percentage >= 0
        and new_interval_percentage <= 100
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'minimum_lapse_interval_days_range'
  ) then
    alter table public.user_study_settings
      add constraint minimum_lapse_interval_days_range
      check (
        minimum_lapse_interval_days >= 1
        and minimum_lapse_interval_days <= 365
      );
  end if;
end $$;
