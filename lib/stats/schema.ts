import { createAdminClient } from "@/lib/supabase/admin";

let ready: Promise<void> | null = null;

const SCHEMA_SQL = `
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
create index if not exists stats_connectors_host_idx on public.stats_connectors (host);
create table if not exists public.stats_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  connector_id uuid not null references public.stats_connectors(id) on delete cascade,
  credentials_ciphertext text,
  created_at timestamptz not null default now(),
  constraint stats_sources_project_connector unique (project_id, connector_id)
);
create index if not exists stats_sources_project_idx on public.stats_sources (project_id, created_at);
alter table public.stats_connectors enable row level security;
alter table public.stats_sources enable row level security;
drop policy if exists "stats_connectors_select" on public.stats_connectors;
create policy "stats_connectors_select" on public.stats_connectors for select to authenticated using (true);
drop policy if exists "stats_connectors_insert" on public.stats_connectors;
create policy "stats_connectors_insert" on public.stats_connectors for insert to authenticated with check (created_by = auth.uid() and builtin is null);
drop policy if exists "stats_connectors_update" on public.stats_connectors;
create policy "stats_connectors_update" on public.stats_connectors for update to authenticated using (created_by = auth.uid() and builtin is null) with check (created_by = auth.uid() and builtin is null);
drop policy if exists "stats_sources_select" on public.stats_sources;
create policy "stats_sources_select" on public.stats_sources for select to authenticated using (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
drop policy if exists "stats_sources_insert" on public.stats_sources;
create policy "stats_sources_insert" on public.stats_sources for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
drop policy if exists "stats_sources_update" on public.stats_sources;
create policy "stats_sources_update" on public.stats_sources for update to authenticated using (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())) with check (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
drop policy if exists "stats_sources_delete" on public.stats_sources;
create policy "stats_sources_delete" on public.stats_sources for delete to authenticated using (user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
grant select, insert, update on public.stats_connectors to authenticated;
grant select, insert, update, delete on public.stats_sources to authenticated;
`;

const PATCH_SQL = `
alter table public.stats_connectors add column if not exists portal_url text;
alter table public.stats_connectors add column if not exists portal_label text;
alter table public.stats_connectors add column if not exists setup_steps jsonb not null default '[]'::jsonb;
alter table public.stats_connectors add column if not exists alias_hosts text[] not null default '{}';
alter table public.stats_connectors add column if not exists scopes jsonb not null default '[]'::jsonb;
alter table public.stats_connectors add column if not exists key_type text;
`;

function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function runSql(sql: string): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = projectRefFromUrl(url);
  if (!token || !ref) {
    throw new Error("No se pudo aplicar el schema de Stats (falta SUPABASE_ACCESS_TOKEN).");
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: sql }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo crear tablas de Stats (${res.status}): ${text.slice(0, 240)}`);
  }
}

async function tablesExist(): Promise<boolean> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from("stats_connectors").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function applyOnce(): Promise<void> {
  if (!(await tablesExist())) await runSql(SCHEMA_SQL);
  await runSql(PATCH_SQL);
}

export async function ensureStatsSchema(): Promise<void> {
  if (!ready) {
    ready = applyOnce().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
}
