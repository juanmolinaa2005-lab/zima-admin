alter table public.project_tracked_creators
  add column if not exists extra_links text[] not null default '{}';
