-- Encrypted login credentials for connected social profiles (vault).
-- Secrets are only returned after re-entering the Zima login password.

create table if not exists public.project_account_credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null
    check (platform in ('tiktok', 'instagram', 'facebook', 'youtube', 'x')),
  source text not null default 'native'
    check (source in ('native', 'blotato')),
  external_key text not null,
  display_name text,
  handle text,
  login_user_ciphertext text,
  login_password_ciphertext text,
  notes_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, platform, source, external_key)
);

create index if not exists project_account_credentials_project_user_idx
  on public.project_account_credentials (project_id, user_id);

alter table public.project_account_credentials enable row level security;

drop policy if exists "account_creds_select_own" on public.project_account_credentials;
drop policy if exists "account_creds_insert_own" on public.project_account_credentials;
drop policy if exists "account_creds_update_own" on public.project_account_credentials;
drop policy if exists "account_creds_delete_own" on public.project_account_credentials;

create policy "account_creds_select_own"
  on public.project_account_credentials for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "account_creds_insert_own"
  on public.project_account_credentials for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "account_creds_update_own"
  on public.project_account_credentials for update
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

create policy "account_creds_delete_own"
  on public.project_account_credentials for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
