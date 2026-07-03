alter table public.user_credits
  alter column credit_balance set default 100,
  alter column lifetime_credits set default 100,
  alter column monthly_credit_limit set default 100;

with upgraded_users as (
  update public.user_credits
  set credit_balance = credit_balance + 50,
      lifetime_credits = 100,
      monthly_credit_limit = greatest(monthly_credit_limit, 100),
      updated_at = now()
  where plan = 'free'
    and lifetime_credits = 50
  returning user_id, credit_balance
)
insert into public.credit_events (
  user_id,
  event_type,
  credit_delta,
  balance_after,
  metadata
)
select
  user_id,
  'free_starting_credits_upgrade',
  50,
  credit_balance,
  '{"from":50,"to":100}'::jsonb
from upgraded_users;
