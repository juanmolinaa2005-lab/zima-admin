-- Shared Stats connectors (built once, reused) + per-project sources.

create table if not exists public.stats_connectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website_url text not null,
  host text not null,
  kind text not null check (kind in ('revenue', 'cost', 'mixed')),
  summary text,
  builtin text check (builtin in ('superwall', 'openai', 'claude')),
  credentials_schema jsonb not null default '[]'::jsonb,
  fetch_spec jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stats_connectors_host_idx
  on public.stats_connectors (host);

create table if not exists public.stats_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  connector_id uuid not null references public.stats_connectors(id) on delete cascade,
  credentials_ciphertext text,
  created_at timestamptz not null default now(),
  constraint stats_sources_project_connector unique (project_id, connector_id)
);

create index if not exists stats_sources_project_idx
  on public.stats_sources (project_id, created_at);

alter table public.stats_connectors enable row level security;
alter table public.stats_sources enable row level security;

drop policy if exists "stats_connectors_select" on public.stats_connectors;
create policy "stats_connectors_select"
  on public.stats_connectors for select
  to authenticated
  using (true);

drop policy if exists "stats_connectors_insert" on public.stats_connectors;
create policy "stats_connectors_insert"
  on public.stats_connectors for insert
  to authenticated
  with check (created_by = auth.uid() and builtin is null);

drop policy if exists "stats_connectors_update" on public.stats_connectors;
create policy "stats_connectors_update"
  on public.stats_connectors for update
  to authenticated
  using (created_by = auth.uid() and builtin is null)
  with check (created_by = auth.uid() and builtin is null);

drop policy if exists "stats_sources_select" on public.stats_sources;
create policy "stats_sources_select"
  on public.stats_sources for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "stats_sources_insert" on public.stats_sources;
create policy "stats_sources_insert"
  on public.stats_sources for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "stats_sources_update" on public.stats_sources;
create policy "stats_sources_update"
  on public.stats_sources for update
  to authenticated
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

drop policy if exists "stats_sources_delete" on public.stats_sources;
create policy "stats_sources_delete"
  on public.stats_sources for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

grant select, insert, update on public.stats_connectors to authenticated;
grant select, insert, update, delete on public.stats_sources to authenticated;

insert into public.stats_connectors (
  slug, name, website_url, host, kind, summary, builtin, credentials_schema
)
values
  (
    'superwall',
    'Superwall',
    'https://superwall.com',
    'superwall.com',
    'revenue',
    'Ingresos, suscripciones y usuarios nuevos de la app.',
    'superwall',
    '[{"id":"apiKey","label":"Organization API key","type":"secret","hint":"Superwall dashboard → API","required":true}]'::jsonb
  ),
  (
    'openai',
    'OpenAI',
    'https://platform.openai.com',
    'platform.openai.com',
    'cost',
    'Gasto de organización, tokens y coste por request.',
    'openai',
    '[{"id":"apiKey","label":"Admin API key","type":"secret","hint":"sk-admin…","required":true}]'::jsonb
  ),
  (
    'claude',
    'Claude',
    'https://console.anthropic.com',
    'console.anthropic.com',
    'cost',
    'Uso y coste de Anthropic (Admin API).',
    'claude',
    '[{"id":"apiKey","label":"Admin API key","type":"secret","hint":"sk-ant-admin…","required":true}]'::jsonb
  )
on conflict (slug) do nothing;
