-- Start frame generated from the 6 identity refs, plus estimated USD for the job.

alter table public.estudio_influencer_videos
  add column if not exists start_image_url text,
  add column if not exists estimated_cost_usd numeric,
  add column if not exists frame_cost_usd numeric;
