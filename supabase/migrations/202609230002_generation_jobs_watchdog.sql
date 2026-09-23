create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.wake_stalled_generation_jobs()
returns integer
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_base_url text;
  v_worker_secret text;
  v_count integer := 0;
  v_job record;
begin
  select decrypted_secret into v_base_url
  from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  select decrypted_secret into v_worker_secret
  from vault.decrypted_secrets where name = 'job_worker_secret' limit 1;

  if coalesce(v_base_url, '') = '' or coalesce(v_worker_secret, '') = '' then
    raise warning 'generation job watchdog secrets are not configured in Vault';
    return 0;
  end if;

  for v_job in
    select id
    from public.generation_jobs
    where status = 'running'
      and updated_at < now() - interval '2 minutes'
      and (lease_until is null or lease_until < now())
  loop
    perform net.http_post(
      url := rtrim(v_base_url, '/') || '/api/jobs?action=tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Worker-Secret', v_worker_secret
      ),
      body := jsonb_build_object('jobId', v_job.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.wake_stalled_generation_jobs() from public, anon, authenticated;
grant execute on function public.wake_stalled_generation_jobs() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'wake-stalled-generation-jobs';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'wake-stalled-generation-jobs',
    '* * * * *',
    'select public.wake_stalled_generation_jobs()'
  );
end;
$$;

-- 적용 전에 Vault에 두 비밀을 등록한다.
-- select vault.create_secret('https://fp-system.vercel.app', 'app_base_url');
-- select vault.create_secret('<JOB_WORKER_SECRET과 동일한 값>', 'job_worker_secret');
-- 확인: select * from cron.job where jobname = 'wake-stalled-generation-jobs';
