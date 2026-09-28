-- Live fal.ai queue status so the studio can tell real jobs from local placeholders.

alter table public.estudio_influencer_videos
  add column if not exists provider_status text,
  add column if not exists queue_position integer;
