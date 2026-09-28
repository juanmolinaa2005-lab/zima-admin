-- Influencer studio: gallery folder + generated UGC videos.

alter table public.estudio_influencers
  add column if not exists folder_id uuid
    references public.project_gallery_folders(id) on delete set null;

create index if not exists estudio_influencers_folder_idx
  on public.estudio_influencers (folder_id)
  where folder_id is not null;

create table if not exists public.estudio_influencer_videos (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.estudio_influencers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  script text not null default '',
  prompt text not null default '',
  request_id text,
  status text not null default 'queued',
  video_url text,
  asset_id uuid references public.project_gallery_assets(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estudio_influencer_videos_inf_idx
  on public.estudio_influencer_videos (influencer_id, created_at desc);

create index if not exists estudio_influencer_videos_poll_idx
  on public.estudio_influencer_videos (created_at)
  where status in ('queued', 'in_progress', 'saving')
    and video_url is null;

alter table public.estudio_influencer_videos enable row level security;

drop policy if exists "estudio_inf_videos_select_own" on public.estudio_influencer_videos;
drop policy if exists "estudio_inf_videos_insert_own" on public.estudio_influencer_videos;
drop policy if exists "estudio_inf_videos_update_own" on public.estudio_influencer_videos;
drop policy if exists "estudio_inf_videos_delete_own" on public.estudio_influencer_videos;

create policy "estudio_inf_videos_select_own"
  on public.estudio_influencer_videos for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_videos_insert_own"
  on public.estudio_influencer_videos for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_videos_update_own"
  on public.estudio_influencer_videos for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_videos_delete_own"
  on public.estudio_influencer_videos for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

grant select, insert, update, delete on public.estudio_influencer_videos to authenticated;
