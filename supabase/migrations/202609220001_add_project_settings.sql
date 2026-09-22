alter table public.projects
  add column if not exists settings jsonb not null default '{}'::jsonb;
