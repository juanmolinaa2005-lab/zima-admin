alter table public.stats_connectors add column if not exists scopes jsonb not null default '[]'::jsonb;
alter table public.stats_connectors add column if not exists key_type text;
