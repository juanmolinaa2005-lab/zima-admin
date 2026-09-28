alter table public.project_gallery_folders
  add column if not exists kind text not null default 'folder';

alter table public.project_gallery_folders
  drop constraint if exists project_gallery_folders_kind_check;

alter table public.project_gallery_folders
  add constraint project_gallery_folders_kind_check
  check (kind in ('folder', 'carousel'));

alter table public.project_gallery_assets
  add column if not exists sort_order integer not null default 0;

create index if not exists project_gallery_assets_folder_sort_idx
  on public.project_gallery_assets (folder_id, sort_order, created_at);
