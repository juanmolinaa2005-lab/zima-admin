-- The Ad Library token now lives in the Supabase secret META_AD_LIBRARY (Edge Function meta-ads).
alter table public.user_settings drop column if exists meta_ads_token_ciphertext;
alter table public.user_settings drop column if exists meta_ads_token_expires_at;
