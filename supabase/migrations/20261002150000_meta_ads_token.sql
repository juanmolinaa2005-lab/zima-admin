-- Token for Meta Ad Library API searches in Market.
alter table public.user_settings add column if not exists meta_ads_token_ciphertext text;
alter table public.user_settings add column if not exists meta_ads_token_expires_at timestamptz;
