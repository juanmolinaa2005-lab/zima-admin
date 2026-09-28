-- ViewTracker request email templates (per user, per project)

create table if not exists public.project_request_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_email text not null default '',
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_request_templates_project_user_idx
  on public.project_request_templates (project_id, user_id);

alter table public.project_request_templates enable row level security;

drop policy if exists "request_templates_select_own" on public.project_request_templates;
drop policy if exists "request_templates_insert_own" on public.project_request_templates;
drop policy if exists "request_templates_update_own" on public.project_request_templates;
drop policy if exists "request_templates_delete_own" on public.project_request_templates;

create policy "request_templates_select_own"
  on public.project_request_templates
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "request_templates_insert_own"
  on public.project_request_templates
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "request_templates_update_own"
  on public.project_request_templates
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "request_templates_delete_own"
  on public.project_request_templates
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
