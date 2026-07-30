alter table public.user_study_settings
  add column if not exists learn_ahead_limit_minutes integer not null default 0;

update public.user_study_settings
set learn_ahead_limit_minutes = coalesce(learn_ahead_limit_minutes, 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'learn_ahead_limit_minutes_range'
  ) then
    alter table public.user_study_settings
      add constraint learn_ahead_limit_minutes_range
      check (
        learn_ahead_limit_minutes >= 0
        and learn_ahead_limit_minutes <= 1440
      );
  end if;
end $$;
