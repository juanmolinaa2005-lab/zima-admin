alter table public.launch_profiles
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists onboarded_at timestamptz;
