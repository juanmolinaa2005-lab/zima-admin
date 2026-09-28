-- Regular OpenAI API key (images / AI). Separate from Admin key used for spend.

alter table public.user_settings
  add column if not exists openai_api_key_ciphertext text,
  add column if not exists openai_api_connected_at timestamptz;
