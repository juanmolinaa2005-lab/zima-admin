-- OAuth app credentials per project + platform (Redes)

create table if not exists public.project_social_apps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null
    check (platform in ('tiktok', 'instagram', 'facebook', 'youtube', 'x')),
  client_id text not null,
  client_secret_ciphertext text not null,
  redirect_uri text,
  scopes text[] not null default '{}',
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, platform)
);

create index if not exists project_social_apps_project_user_idx
  on public.project_social_apps (project_id, user_id);

alter table public.project_social_apps enable row level security;

drop policy if exists "social_apps_select_own" on public.project_social_apps;
drop policy if exists "social_apps_insert_own" on public.project_social_apps;
drop policy if exists "social_apps_update_own" on public.project_social_apps;
drop policy if exists "social_apps_delete_own" on public.project_social_apps;

create policy "social_apps_select_own"
  on public.project_social_apps for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_apps_insert_own"
  on public.project_social_apps for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_apps_update_own"
  on public.project_social_apps for update
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

create policy "social_apps_delete_own"
  on public.project_social_apps for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Track publish jobs
create table if not exists public.project_social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.project_social_accounts(id) on delete cascade,
  platform text not null,
  caption text,
  video_url text,
  status text not null default 'pending'
    check (status in ('pending', 'uploading', 'published', 'failed')),
  external_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_social_posts_project_idx
  on public.project_social_posts (project_id, user_id, created_at desc);

alter table public.project_social_posts enable row level security;

drop policy if exists "social_posts_select_own" on public.project_social_posts;
drop policy if exists "social_posts_insert_own" on public.project_social_posts;
drop policy if exists "social_posts_update_own" on public.project_social_posts;
drop policy if exists "social_posts_delete_own" on public.project_social_posts;

create policy "social_posts_select_own"
  on public.project_social_posts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_posts_insert_own"
  on public.project_social_posts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_posts_update_own"
  on public.project_social_posts for update
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

create policy "social_posts_delete_own"
  on public.project_social_posts for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
