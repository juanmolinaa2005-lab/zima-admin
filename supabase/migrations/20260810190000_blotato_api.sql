-- Blotato API key (TikTok / social via Blotato)

alter table public.user_settings
  add column if not exists blotato_api_key_ciphertext text,
  add column if not exists blotato_connected_at timestamptz;
