-- Replicate API key (primary video gen) + which provider owns each influencer video job.

alter table public.user_settings
  add column if not exists replicate_api_key_ciphertext text,
  add column if not exists replicate_connected_at timestamptz;

alter table public.estudio_influencer_videos
  add column if not exists video_provider text;
