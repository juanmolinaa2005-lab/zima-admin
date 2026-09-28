create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  supabase_access_token text,
  supabase_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
