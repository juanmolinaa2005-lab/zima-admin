-- Exact API payloads (frame + video) sent for each influencer video.

alter table public.estudio_influencer_videos
  add column if not exists api_trace jsonb;
