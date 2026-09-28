create table if not exists public.project_app_legal (
  project_id uuid primary key references public.projects(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  version integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  last_notice jsonb,
  updated_at timestamptz not null default now()
);

alter table public.project_app_legal enable row level security;

drop policy if exists "app_legal_select_own" on public.project_app_legal;
drop policy if exists "app_legal_insert_own" on public.project_app_legal;
drop policy if exists "app_legal_update_own" on public.project_app_legal;

create policy "app_legal_select_own"
  on public.project_app_legal
  for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "app_legal_insert_own"
  on public.project_app_legal
  for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "app_legal_update_own"
  on public.project_app_legal
  for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

grant select, insert, update on public.project_app_legal to authenticated;
grant all on public.project_app_legal to service_role;
