-- ViewTracker outreach / request registry (email + profile)

create table if not exists public.project_outreach_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'profile')),
  status text not null default 'sent'
    check (status in ('sent', 'pending', 'opened', 'replied', 'declined', 'no_response')),
  recipient_name text,
  to_email text,
  profile_url text,
  avatar_url text,
  platform text,
  subject text,
  body text,
  from_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_outreach_requests_project_user_idx
  on public.project_outreach_requests (project_id, user_id, created_at desc);

alter table public.project_outreach_requests enable row level security;

drop policy if exists "outreach_select_own" on public.project_outreach_requests;
drop policy if exists "outreach_insert_own" on public.project_outreach_requests;
drop policy if exists "outreach_update_own" on public.project_outreach_requests;
drop policy if exists "outreach_delete_own" on public.project_outreach_requests;

create policy "outreach_select_own"
  on public.project_outreach_requests
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "outreach_insert_own"
  on public.project_outreach_requests
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "outreach_update_own"
  on public.project_outreach_requests
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

create policy "outreach_delete_own"
  on public.project_outreach_requests
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
