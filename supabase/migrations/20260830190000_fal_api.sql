-- Encrypted fal.ai API key (Creator Estudio · Influencers / GPT Image 2)

alter table public.user_settings
  add column if not exists fal_api_key_ciphertext text,
  add column if not exists fal_connected_at timestamptz;
