-- Ayrshare unified social API credentials

alter table public.user_settings
  add column if not exists ayrshare_api_key_ciphertext text,
  add column if not exists ayrshare_private_key_ciphertext text,
  add column if not exists ayrshare_domain text,
  add column if not exists ayrshare_connected_at timestamptz;

create table if not exists public.project_ayrshare (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_key_ciphertext text,
  ref_id text,
  title text,
  linked_platforms text[] not null default '{}',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_ayrshare enable row level security;

drop policy if exists "ayrshare_select_own" on public.project_ayrshare;
drop policy if exists "ayrshare_insert_own" on public.project_ayrshare;
drop policy if exists "ayrshare_update_own" on public.project_ayrshare;
drop policy if exists "ayrshare_delete_own" on public.project_ayrshare;

create policy "ayrshare_select_own"
  on public.project_ayrshare for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "ayrshare_insert_own"
  on public.project_ayrshare for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "ayrshare_update_own"
  on public.project_ayrshare for update
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

create policy "ayrshare_delete_own"
  on public.project_ayrshare for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
