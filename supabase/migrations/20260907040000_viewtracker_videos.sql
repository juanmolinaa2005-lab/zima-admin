-- Tracked social videos and accounts for ViewTracker.

create table if not exists public.project_tracked_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  platform text,
  video_id text,
  title text,
  author text,
  thumbnail_url text,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_tracked_videos_url_len check (char_length(trim(url)) between 8 and 2000)
);

create unique index if not exists project_tracked_videos_url_uidx
  on public.project_tracked_videos (project_id, user_id, url);

create index if not exists project_tracked_videos_project_user_idx
  on public.project_tracked_videos (project_id, user_id, created_at desc);

alter table public.project_tracked_videos enable row level security;

drop policy if exists "tracked_videos_select_own" on public.project_tracked_videos;
drop policy if exists "tracked_videos_insert_own" on public.project_tracked_videos;
drop policy if exists "tracked_videos_update_own" on public.project_tracked_videos;
drop policy if exists "tracked_videos_delete_own" on public.project_tracked_videos;

create policy "tracked_videos_select_own"
  on public.project_tracked_videos for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_videos_insert_own"
  on public.project_tracked_videos for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_videos_update_own"
  on public.project_tracked_videos for update
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

create policy "tracked_videos_delete_own"
  on public.project_tracked_videos for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create table if not exists public.project_tracked_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  platform text,
  username text,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint project_tracked_accounts_url_len check (char_length(trim(url)) between 8 and 2000)
);

create unique index if not exists project_tracked_accounts_url_uidx
  on public.project_tracked_accounts (project_id, user_id, url);

create index if not exists project_tracked_accounts_project_user_idx
  on public.project_tracked_accounts (project_id, user_id, created_at desc);

alter table public.project_tracked_accounts enable row level security;

drop policy if exists "tracked_accounts_select_own" on public.project_tracked_accounts;
drop policy if exists "tracked_accounts_insert_own" on public.project_tracked_accounts;
drop policy if exists "tracked_accounts_delete_own" on public.project_tracked_accounts;

create policy "tracked_accounts_select_own"
  on public.project_tracked_accounts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_accounts_insert_own"
  on public.project_tracked_accounts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "tracked_accounts_delete_own"
  on public.project_tracked_accounts for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
