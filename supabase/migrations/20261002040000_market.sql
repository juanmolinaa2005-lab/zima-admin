-- Market: saved items per project (keywords, tracked apps, swipe files) and daily public App Store snapshots.

create table if not exists public.market_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_items_kind check (kind in ('keyword', 'my_app', 'competitor', 'onboarding', 'ad', 'organic')),
  constraint market_items_key_len check (char_length(key) between 1 and 600)
);

create unique index if not exists market_items_project_kind_key_uidx
  on public.market_items (project_id, kind, key);

create index if not exists market_items_kind_idx on public.market_items (kind);

alter table public.market_items enable row level security;

drop policy if exists "market_items_all_own" on public.market_items;

create policy "market_items_all_own"
  on public.market_items for all
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

-- Public App Store data, written and read only by the server (service role).
create table if not exists public.market_chart_snapshots (
  country text not null,
  genre text not null default '',
  chart text not null,
  day date not null,
  ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (country, genre, chart, day)
);

create table if not exists public.market_app_snapshots (
  app_id text not null,
  country text not null,
  day date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (app_id, country, day)
);

alter table public.market_chart_snapshots enable row level security;
alter table public.market_app_snapshots enable row level security;
