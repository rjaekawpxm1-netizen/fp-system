alter table public.projects
  add column if not exists owner_id uuid references auth.users(id) default auth.uid();

alter table public.projects enable row level security;

drop policy if exists projects_select_owner on public.projects;
drop policy if exists projects_insert_owner on public.projects;
drop policy if exists projects_update_owner on public.projects;
drop policy if exists projects_delete_owner on public.projects;

create policy projects_select_owner on public.projects for select to authenticated
  using (owner_id = auth.uid());
create policy projects_insert_owner on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy projects_update_owner on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete_owner on public.projects for delete to authenticated
  using (owner_id = auth.uid());

-- 기존 owner_id IS NULL 행은 의도적으로 어떤 사용자에게도 공개하지 않는다.
-- 배포 관리자가 소유자를 확인한 뒤 다음 형태로 명시적으로 백필해야 한다.
-- update public.projects set owner_id = '<auth.users.id>' where id in (...);
