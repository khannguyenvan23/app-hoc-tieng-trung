create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  credit_balance integer not null default 50 check (credit_balance >= 0),
  lifetime_credits integer not null default 50 check (lifetime_credits >= 0),
  monthly_credit_limit integer not null default 50 check (monthly_credit_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  credit_delta integer not null,
  balance_after integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;
alter table public.credit_events enable row level security;

drop policy if exists "Users can read own credits" on public.user_credits;
create policy "Users can read own credits"
  on public.user_credits
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own credit events" on public.credit_events;
create policy "Users can read own credit events"
  on public.credit_events
  for select
  using (auth.uid() = user_id);

create or replace function public.ensure_user_credits(p_user_id uuid)
returns public.user_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_row public.user_credits;
begin
  insert into public.user_credits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into credit_row
  from public.user_credits
  where user_id = p_user_id;

  return credit_row;
end;
$$;

create or replace function public.spend_user_credits(
  p_user_id uuid,
  p_credits integer,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(success boolean, balance integer, required integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  new_balance integer;
begin
  if p_credits <= 0 then
    select credit_balance
    into current_balance
    from public.ensure_user_credits(p_user_id);

    return query select true, current_balance, 0;
    return;
  end if;

  perform public.ensure_user_credits(p_user_id);

  select credit_balance
  into current_balance
  from public.user_credits
  where user_id = p_user_id
  for update;

  if current_balance < p_credits then
    return query select false, current_balance, p_credits;
    return;
  end if;

  update public.user_credits
  set credit_balance = credit_balance - p_credits,
      updated_at = now()
  where user_id = p_user_id
  returning credit_balance into new_balance;

  insert into public.credit_events (
    user_id,
    event_type,
    credit_delta,
    balance_after,
    metadata
  )
  values (
    p_user_id,
    p_event_type,
    -p_credits,
    new_balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select true, new_balance, p_credits;
end;
$$;

create or replace function public.add_user_credits(
  p_user_id uuid,
  p_credits integer,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_credits <= 0 then
    select credit_balance
    into new_balance
    from public.ensure_user_credits(p_user_id);

    return query select new_balance;
    return;
  end if;

  perform public.ensure_user_credits(p_user_id);

  update public.user_credits
  set credit_balance = credit_balance + p_credits,
      lifetime_credits = lifetime_credits + p_credits,
      updated_at = now()
  where user_id = p_user_id
  returning credit_balance into new_balance;

  insert into public.credit_events (
    user_id,
    event_type,
    credit_delta,
    balance_after,
    metadata
  )
  values (
    p_user_id,
    p_event_type,
    p_credits,
    new_balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select new_balance;
end;
$$;

grant execute on function public.ensure_user_credits(uuid) to authenticated, service_role;
grant execute on function public.spend_user_credits(uuid, integer, text, jsonb) to authenticated, service_role;
grant execute on function public.add_user_credits(uuid, integer, text, jsonb) to authenticated, service_role;
