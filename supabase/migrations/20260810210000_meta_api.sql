-- Meta (Facebook) App credentials for Instagram Graph API

alter table public.user_settings
  add column if not exists meta_app_id text,
  add column if not exists meta_app_secret_ciphertext text,
  add column if not exists meta_connected_at timestamptz;
