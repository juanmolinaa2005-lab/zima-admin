-- Extra metrics so ViewTracker tables match viewtrack.app.

alter table public.project_tracked_videos
  add column if not exists saves bigint not null default 0,
  add column if not exists duration_seconds integer,
  add column if not exists posted_at timestamptz,
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists views_prev bigint not null default 0;

alter table public.project_tracked_accounts
  add column if not exists display_name text,
  add column if not exists creator_name text,
  add column if not exists followers bigint not null default 0,
  add column if not exists last_refreshed_at timestamptz;

create table if not exists public.project_tracked_creators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  labels text,
  status text not null default 'Not Invited',
  created_at timestamptz not null default now(),
  constraint project_tracked_creators_name_len check (char_length(trim(name)) between 1 and 120)
);

create index if not exists project_tracked_creators_project_user_idx
  on public.project_tracked_creators (project_id, user_id, created_at desc);

alter table public.project_tracked_creators enable row level security;

drop policy if exists "tracked_creators_select_own" on public.project_tracked_creators;
drop policy if exists "tracked_creators_insert_own" on public.project_tracked_creators;
drop policy if exists "tracked_creators_update_own" on public.project_tracked_creators;
drop policy if exists "tracked_creators_delete_own" on public.project_tracked_creators;

create policy "tracked_creators_select_own"
  on public.project_tracked_creators for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_creators_insert_own"
  on public.project_tracked_creators for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_creators_update_own"
  on public.project_tracked_creators for update
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

create policy "tracked_creators_delete_own"
  on public.project_tracked_creators for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
