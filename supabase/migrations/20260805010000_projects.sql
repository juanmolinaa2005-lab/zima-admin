-- projects + tools (applied remotely)

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  supabase_project_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_tools (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists project_tools_project_id_idx on public.project_tools(project_id);

alter table public.projects enable row level security;
alter table public.project_tools enable row level security;
