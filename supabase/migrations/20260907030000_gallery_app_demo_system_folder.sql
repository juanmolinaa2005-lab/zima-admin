-- Locked default gallery folder for App Demo videos.

alter table public.project_gallery_folders
  add column if not exists system_key text;

create unique index if not exists project_gallery_folders_system_key_uidx
  on public.project_gallery_folders (project_id, user_id, system_key)
  where system_key is not null;
