-- Opt-in flag for the daily "you have cards due" email, plus a stable token so
-- each reminder can carry a one-click unsubscribe link. Default OFF — never
-- email a learner who did not ask for it.

alter table public.user_study_settings
  add column if not exists email_reminders_enabled boolean not null default false;

alter table public.user_study_settings
  add column if not exists reminder_unsubscribe_token uuid not null default gen_random_uuid();

update public.user_study_settings
set
  email_reminders_enabled = coalesce(email_reminders_enabled, false),
  reminder_unsubscribe_token = coalesce(reminder_unsubscribe_token, gen_random_uuid());

create unique index if not exists user_study_settings_unsubscribe_token_idx
  on public.user_study_settings(reminder_unsubscribe_token);
