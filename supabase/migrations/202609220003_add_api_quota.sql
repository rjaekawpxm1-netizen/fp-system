create table if not exists public.api_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0,
  last_requested_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.api_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  accepted boolean not null,
  reason text not null
);

alter table public.api_usage_daily enable row level security;
alter table public.api_audit_log enable row level security;

create or replace function public.consume_api_quota(p_daily_limit integer default 200)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then return false; end if;

  insert into public.api_usage_daily(user_id, usage_date, request_count, last_requested_at)
  values (v_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.api_usage_daily.request_count + 1,
        last_requested_at = now()
    where public.api_usage_daily.request_count < p_daily_limit
  returning request_count into v_count;

  if v_count is null then
    insert into public.api_audit_log(user_id, accepted, reason)
    values (v_user_id, false, 'daily_quota_exceeded');
    return false;
  end if;

  insert into public.api_audit_log(user_id, accepted, reason)
  values (v_user_id, true, 'accepted');
  return true;
end;
$$;

revoke all on function public.consume_api_quota(integer) from public, anon;
grant execute on function public.consume_api_quota(integer) to authenticated;
