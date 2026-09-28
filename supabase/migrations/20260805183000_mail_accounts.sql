-- Titan / IMAP mail accounts (per user, per project)

create table if not exists public.project_mail_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  password_ciphertext text not null,
  imap_host text not null default 'imap.hostinger.com',
  imap_port int not null default 993,
  smtp_host text not null default 'smtp.hostinger.com',
  smtp_port int not null default 465,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, email)
);

create index if not exists project_mail_accounts_project_user_idx
  on public.project_mail_accounts (project_id, user_id);

alter table public.project_mail_accounts enable row level security;

drop policy if exists "mail_accounts_select_own" on public.project_mail_accounts;
drop policy if exists "mail_accounts_insert_own" on public.project_mail_accounts;
drop policy if exists "mail_accounts_update_own" on public.project_mail_accounts;
drop policy if exists "mail_accounts_delete_own" on public.project_mail_accounts;

create policy "mail_accounts_select_own"
  on public.project_mail_accounts
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "mail_accounts_insert_own"
  on public.project_mail_accounts
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "mail_accounts_update_own"
  on public.project_mail_accounts
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (user_id = auth.uid());

create policy "mail_accounts_delete_own"
  on public.project_mail_accounts
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
