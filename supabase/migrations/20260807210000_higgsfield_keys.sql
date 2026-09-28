-- Encrypted Higgsfield API credentials per user (Marketing Studio)

alter table public.user_settings
  add column if not exists higgsfield_key_ciphertext text,
  add column if not exists higgsfield_connected_at timestamptz;
