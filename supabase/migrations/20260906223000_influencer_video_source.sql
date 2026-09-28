-- Raw Kling/fal output, before overlay or TikTok beauty pass.

alter table public.estudio_influencer_videos
  add column if not exists source_video_url text;
