create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('domains', 'functions', 'fp')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'awaiting_confirmation', 'paused_quota', 'completed', 'failed', 'cancelled')),
  step integer not null default 0,
  total_steps integer,
  state jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists generation_jobs_one_active_per_project
  on public.generation_jobs(project_id)
  where status in ('queued', 'running', 'awaiting_confirmation', 'paused_quota');

create index if not exists generation_jobs_owner_updated_idx
  on public.generation_jobs(owner_id, updated_at desc);

alter table public.generation_jobs enable row level security;

drop policy if exists generation_jobs_select_owner on public.generation_jobs;
create policy generation_jobs_select_owner
  on public.generation_jobs
  for select
  to authenticated
  using (owner_id = auth.uid());

create or replace function public.consume_api_quota_for_user(
  p_user_id uuid,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null then return false; end if;

  insert into public.api_usage_daily(user_id, usage_date, request_count, last_requested_at)
  values (p_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.api_usage_daily.request_count + 1,
        last_requested_at = now()
    where public.api_usage_daily.request_count < p_daily_limit
  returning request_count into v_count;

  if v_count is null then
    insert into public.api_audit_log(user_id, accepted, reason)
    values (p_user_id, false, 'daily_quota_exceeded');
    return false;
  end if;

  insert into public.api_audit_log(user_id, accepted, reason)
  values (p_user_id, true, 'accepted');
  return true;
end;
$$;

revoke all on function public.consume_api_quota_for_user(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_quota_for_user(uuid, integer)
  to service_role;

-- 사람이 실행할 확인 쿼리:
-- select to_regclass('public.generation_jobs') as generation_jobs_table;
-- select relrowsecurity from pg_class where oid = 'public.generation_jobs'::regclass;
-- select to_regprocedure('public.consume_api_quota_for_user(uuid,integer)') as quota_function;
