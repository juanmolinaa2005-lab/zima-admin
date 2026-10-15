-- Contenido planificado, campañas de paid ads, creativos, métricas diarias y enlaces UTM con contador de clics.

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  platform text not null default 'tiktok',
  format text not null default 'video',
  pillar text,
  status text not null default 'idea'
    check (status in ('idea', 'script', 'production', 'review', 'scheduled', 'published')),
  scheduled_at timestamptz,
  hook text,
  script text,
  caption text,
  hashtags text[] not null default '{}',
  asset_url text,
  published_url text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_posts_project_idx on public.content_posts (project_id, scheduled_at);
alter table public.content_posts enable row level security;
drop policy if exists "content_posts owner" on public.content_posts;
create policy "content_posts owner" on public.content_posts
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  platform text not null default 'meta',
  objective text not null default 'conversions',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  daily_budget numeric(12, 2) not null default 0,
  total_budget numeric(12, 2),
  target_cpa numeric(12, 2),
  currency text not null default 'USD',
  start_date date,
  end_date date,
  audience text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_project_idx on public.ad_campaigns (project_id, created_at desc);
alter table public.ad_campaigns enable row level security;
drop policy if exists "ad_campaigns owner" on public.ad_campaigns;
create policy "ad_campaigns owner" on public.ad_campaigns
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  format text not null default 'video',
  hook text,
  angle text,
  primary_text text,
  headline text,
  cta text,
  asset_url text,
  status text not null default 'testing' check (status in ('draft', 'testing', 'winner', 'loser', 'paused')),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_creatives_project_idx on public.ad_creatives (project_id, created_at desc);
alter table public.ad_creatives enable row level security;
drop policy if exists "ad_creatives owner" on public.ad_creatives;
create policy "ad_creatives owner" on public.ad_creatives
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create table if not exists public.ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  creative_id uuid references public.ad_creatives (id) on delete cascade,
  day date not null,
  spend numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(12, 2) not null default 0,
  revenue numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists ad_metrics_daily_unique_idx
  on public.ad_metrics_daily (campaign_id, coalesce(creative_id, '00000000-0000-0000-0000-000000000000'::uuid), day);
create index if not exists ad_metrics_daily_project_day_idx on public.ad_metrics_daily (project_id, day desc);
alter table public.ad_metrics_daily enable row level security;
drop policy if exists "ad_metrics_daily owner" on public.ad_metrics_daily;
create policy "ad_metrics_daily owner" on public.ad_metrics_daily
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create table if not exists public.marketing_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  code text not null unique check (code ~ '^[a-z0-9]{4,16}$'),
  name text not null check (char_length(name) between 1 and 160),
  base_url text not null check (base_url ~* '^https?://'),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  clicks bigint not null default 0,
  last_click_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_links_project_idx on public.marketing_links (project_id, created_at desc);
alter table public.marketing_links enable row level security;
drop policy if exists "marketing_links owner" on public.marketing_links;
create policy "marketing_links owner" on public.marketing_links
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

-- El enlace corto público solo puede sumar un clic y leer el destino final, nada más.
create or replace function public.track_marketing_link_click(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare link public.marketing_links; target text; params text[] := '{}';
begin
  update public.marketing_links set clicks = clicks + 1, last_click_at = now()
    where code = lower(p_code) returning * into link;
  if not found then return null; end if;
  if coalesce(link.utm_source, '') <> '' then params := params || ('utm_source=' || link.utm_source); end if;
  if coalesce(link.utm_medium, '') <> '' then params := params || ('utm_medium=' || link.utm_medium); end if;
  if coalesce(link.utm_campaign, '') <> '' then params := params || ('utm_campaign=' || link.utm_campaign); end if;
  if coalesce(link.utm_content, '') <> '' then params := params || ('utm_content=' || link.utm_content); end if;
  if coalesce(link.utm_term, '') <> '' then params := params || ('utm_term=' || link.utm_term); end if;
  target := link.base_url;
  if array_length(params, 1) > 0 then
    target := target || case when position('?' in target) > 0 then '&' else '?' end || array_to_string(params, '&');
  end if;
  return target;
end $$;
revoke all on function public.track_marketing_link_click(text) from public;
grant execute on function public.track_marketing_link_click(text) to anon, authenticated;
