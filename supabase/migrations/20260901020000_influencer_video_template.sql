-- Per-job Omni duration and optional template action / extra details.

alter table public.estudio_influencer_videos
  add column if not exists duration text default '10',
  add column if not exists action text,
  add column if not exists extra text;
