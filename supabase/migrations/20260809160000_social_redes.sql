-- Social accounts auth (Redes) — isolation via dedicated proxies + fingerprints

create table if not exists public.project_social_proxies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  protocol text not null default 'http'
    check (protocol in ('http', 'https', 'socks5')),
  host text not null,
  port integer not null check (port > 0 and port <= 65535),
  username_ciphertext text,
  password_ciphertext text,
  country text,
  provider text,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'error')),
  last_check_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_social_proxies_project_user_idx
  on public.project_social_proxies (project_id, user_id);

create table if not exists public.project_social_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null
    check (platform in ('tiktok', 'instagram', 'facebook', 'youtube', 'x')),
  display_name text,
  username text,
  external_id text,
  avatar_url text,
  auth_method text not null default 'pending'
    check (auth_method in ('oauth', 'session', 'pending')),
  status text not null default 'pending'
    check (status in (
      'pending',
      'active',
      'needs_reauth',
      'limited',
      'blocked',
      'disconnected'
    )),
  proxy_id uuid references public.project_social_proxies(id) on delete set null,
  fingerprint_seed text not null default gen_random_uuid()::text,
  tokens_ciphertext text,
  scopes text[] not null default '{}',
  connected_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_social_accounts_project_user_idx
  on public.project_social_accounts (project_id, user_id, created_at desc);

create index if not exists project_social_accounts_platform_idx
  on public.project_social_accounts (project_id, platform);

create unique index if not exists project_social_accounts_proxy_unique
  on public.project_social_accounts (proxy_id)
  where proxy_id is not null;

create unique index if not exists project_social_accounts_platform_username_unique
  on public.project_social_accounts (project_id, platform, lower(username))
  where username is not null and username <> '';

-- RLS proxies
alter table public.project_social_proxies enable row level security;

drop policy if exists "social_proxies_select_own" on public.project_social_proxies;
drop policy if exists "social_proxies_insert_own" on public.project_social_proxies;
drop policy if exists "social_proxies_update_own" on public.project_social_proxies;
drop policy if exists "social_proxies_delete_own" on public.project_social_proxies;

create policy "social_proxies_select_own"
  on public.project_social_proxies for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_proxies_insert_own"
  on public.project_social_proxies for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_proxies_update_own"
  on public.project_social_proxies for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_proxies_delete_own"
  on public.project_social_proxies for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- RLS accounts
alter table public.project_social_accounts enable row level security;

drop policy if exists "social_accounts_select_own" on public.project_social_accounts;
drop policy if exists "social_accounts_insert_own" on public.project_social_accounts;
drop policy if exists "social_accounts_update_own" on public.project_social_accounts;
drop policy if exists "social_accounts_delete_own" on public.project_social_accounts;

create policy "social_accounts_select_own"
  on public.project_social_accounts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_accounts_insert_own"
  on public.project_social_accounts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_accounts_update_own"
  on public.project_social_accounts for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "social_accounts_delete_own"
  on public.project_social_accounts for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
