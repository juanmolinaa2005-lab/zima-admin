-- Página pública del producto (vantko.com/<slug>), suscriptores y novedades.
create table if not exists public.product_pages (
  project_id uuid primary key references public.projects (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  published boolean not null default false,
  title text check (title is null or char_length(title) <= 80),
  tagline text check (tagline is null or char_length(tagline) <= 160),
  description text check (description is null or char_length(description) <= 1000),
  website_url text check (website_url is null or char_length(website_url) <= 500),
  ios_url text check (ios_url is null or char_length(ios_url) <= 500),
  android_url text check (android_url is null or char_length(android_url) <= 500),
  collect_emails boolean not null default true,
  accent text not null default '#111114' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_subscribers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  created_at timestamptz not null default now(),
  unique (project_id, email)
);
create index if not exists page_subscribers_project_idx on public.page_subscribers (project_id, created_at desc);

create table if not exists public.page_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists page_updates_project_idx on public.page_updates (project_id, created_at desc);

alter table public.product_pages enable row level security;
alter table public.page_subscribers enable row level security;
alter table public.page_updates enable row level security;

drop policy if exists "product_pages_owner" on public.product_pages;
create policy "product_pages_owner" on public.product_pages for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "page_subscribers_owner" on public.page_subscribers;
create policy "page_subscribers_owner" on public.page_subscribers for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "page_updates_owner" on public.page_updates;
create policy "page_updates_owner" on public.page_updates for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
