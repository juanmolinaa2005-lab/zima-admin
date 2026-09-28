-- Encrypted Superwall organization API key (Analytics · Billing)

alter table public.user_settings
  add column if not exists superwall_api_key_ciphertext text,
  add column if not exists superwall_org_id text,
  add column if not exists superwall_application_id text,
  add column if not exists superwall_connected_at timestamptz;
