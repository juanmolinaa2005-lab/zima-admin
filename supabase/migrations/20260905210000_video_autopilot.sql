-- One-click UGC autopilot runs. Isolated from Influencers V1 drafts.
-- Writes go through service_role after requireProjectOwner; clients may only SELECT their rows.

create table if not exists public.estudio_video_autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  influencer_id uuid not null references public.estudio_influencers(id) on delete cascade,
  client_request_id text not null,
  idea text not null,
  status text not null default 'queued',
  stage text not null default 'queued',
  progress integer not null default 0,
  video_url text,
  asset_id uuid references public.project_gallery_assets(id) on delete set null,
  error text,
  state jsonb not null default '{}'::jsonb,
  fal_request_id text,
  lock_token uuid,
  locked_at timestamptz,
  attempt integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estudio_autopilot_status_check
    check (status in ('queued', 'running', 'done', 'failed')),
  constraint estudio_autopilot_stage_check
    check (stage in (
      'queued',
      'validate',
      'influencer',
      'research',
      'plan',
      'frames',
      'clips',
      'montage',
      'done'
    )),
  constraint estudio_autopilot_progress_check
    check (progress >= 0 and progress <= 100),
  constraint estudio_autopilot_idea_len
    check (char_length(trim(idea)) between 8 and 500),
  constraint estudio_autopilot_request_len
    check (char_length(trim(client_request_id)) between 8 and 80)
);

create unique index if not exists estudio_autopilot_request_uidx
  on public.estudio_video_autopilot_runs (project_id, user_id, influencer_id, client_request_id);

create index if not exists estudio_autopilot_project_idx
  on public.estudio_video_autopilot_runs (project_id, created_at desc);

create index if not exists estudio_autopilot_influencer_idx
  on public.estudio_video_autopilot_runs (project_id, influencer_id, created_at desc);

create index if not exists estudio_autopilot_work_idx
  on public.estudio_video_autopilot_runs (status, lock_token, locked_at, updated_at)
  where status in ('queued', 'running');

create unique index if not exists estudio_autopilot_fal_request_uidx
  on public.estudio_video_autopilot_runs (fal_request_id)
  where fal_request_id is not null;

alter table public.estudio_video_autopilot_runs enable row level security;

drop policy if exists "estudio_autopilot_select_own" on public.estudio_video_autopilot_runs;
drop policy if exists "estudio_autopilot_insert_own" on public.estudio_video_autopilot_runs;
drop policy if exists "estudio_autopilot_update_own" on public.estudio_video_autopilot_runs;
drop policy if exists "estudio_autopilot_delete_own" on public.estudio_video_autopilot_runs;

create policy "estudio_autopilot_select_own"
  on public.estudio_video_autopilot_runs for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

revoke all on public.estudio_video_autopilot_runs from anon;
revoke all on public.estudio_video_autopilot_runs from authenticated;
grant select on public.estudio_video_autopilot_runs to authenticated;
