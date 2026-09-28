alter table public.project_gallery_folders
  add column if not exists meta jsonb not null default '{}'::jsonb;
