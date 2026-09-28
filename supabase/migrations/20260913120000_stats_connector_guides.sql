alter table public.stats_connectors add column if not exists portal_url text;
alter table public.stats_connectors add column if not exists portal_label text;
alter table public.stats_connectors add column if not exists setup_steps jsonb not null default '[]'::jsonb;
alter table public.stats_connectors add column if not exists alias_hosts text[] not null default '{}';
