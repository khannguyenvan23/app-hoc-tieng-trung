alter table public.user_study_settings
  alter column learn_ahead_limit_minutes set default 0;

-- Migration 080 initially used 20. Reset that value so rating intervals are
-- exact unless a learner explicitly opts into learning ahead.
update public.user_study_settings
set
  learn_ahead_limit_minutes = 0,
  updated_at = now()
where learn_ahead_limit_minutes = 20;
