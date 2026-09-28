-- Allow audio assets in gallery (Creator Studio music)

alter table public.project_gallery_assets
  drop constraint if exists project_gallery_assets_kind_check;

alter table public.project_gallery_assets
  add constraint project_gallery_assets_kind_check
  check (kind in ('image', 'video', 'audio', 'other'));
