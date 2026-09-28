-- Google OAuth client for YouTube Data API v3 (upload + channel)

alter table public.user_settings
  add column if not exists youtube_client_id text,
  add column if not exists youtube_client_secret_ciphertext text,
  add column if not exists youtube_connected_at timestamptz;
