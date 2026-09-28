-- Encrypted Anthropic Admin API key per user (Claude Use)

alter table public.user_settings
  add column if not exists anthropic_admin_key_ciphertext text,
  add column if not exists anthropic_connected_at timestamptz;
