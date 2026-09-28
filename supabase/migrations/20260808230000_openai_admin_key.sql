-- Encrypted OpenAI Admin API key per user (Use)

alter table public.user_settings
  add column if not exists openai_admin_key_ciphertext text,
  add column if not exists openai_connected_at timestamptz;
