alter table public.estudio_influencer_videos
  add column if not exists reference_video_url text;
