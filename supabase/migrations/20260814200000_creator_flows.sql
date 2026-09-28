-- Creator Studio flows (steps will be added later)

create table if not exists public.project_creator_flows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled flow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_creator_flows_name_len check (char_length(trim(name)) between 1 and 80)
);

create index if not exists project_creator_flows_project_idx
  on public.project_creator_flows (project_id, updated_at desc);

alter table public.project_creator_flows enable row level security;

create policy "creator_flows_select_own"
  on public.project_creator_flows
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "creator_flows_insert_own"
  on public.project_creator_flows
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "creator_flows_update_own"
  on public.project_creator_flows
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

create policy "creator_flows_delete_own"
  on public.project_creator_flows
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
