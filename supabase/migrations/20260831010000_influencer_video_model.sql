-- fal.ai model used to render queued influencer videos (Kling O3 Omni).

alter table public.estudio_influencer_videos
  add column if not exists model_id text;

create index if not exists estudio_influencer_videos_queue_idx
  on public.estudio_influencer_videos (created_at)
  where status = 'queued' and request_id is null;
