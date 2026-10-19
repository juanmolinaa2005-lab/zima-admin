-- Contracts with creators, generated from a few parameters.

create table if not exists public.project_creator_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid references public.project_tracked_creators(id) on delete set null,
  creator_name text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_creator_contracts_project_idx
  on public.project_creator_contracts (project_id, created_at desc);

alter table public.project_creator_contracts enable row level security;

drop policy if exists "creator_contracts_owner" on public.project_creator_contracts;
create policy "creator_contracts_owner" on public.project_creator_contracts for all to authenticated
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));
