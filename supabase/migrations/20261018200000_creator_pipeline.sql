-- Outreach pipeline for real creators: stage plus a log of every contact (first touch and follow-ups).

alter table public.project_tracked_creators
  add column if not exists stage text not null default 'new',
  add column if not exists profile_url text,
  add column if not exists platform text,
  add column if not exists source text,
  add column if not exists notes text,
  add column if not exists touches jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.project_tracked_creators
  drop constraint if exists project_tracked_creators_stage_check;

alter table public.project_tracked_creators
  add constraint project_tracked_creators_stage_check
  check (stage in ('new', 'contacted', 'engaged', 'pitched', 'closed', 'lost'));
