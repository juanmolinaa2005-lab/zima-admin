-- Project gallery: folders + media assets + storage bucket

create table if not exists public.project_gallery_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.project_gallery_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint project_gallery_folders_name_len check (char_length(trim(name)) between 1 and 120)
);

create index if not exists project_gallery_folders_project_parent_idx
  on public.project_gallery_folders (project_id, parent_id, created_at);

create table if not exists public.project_gallery_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.project_gallery_folders(id) on delete cascade,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  kind text not null default 'other'
    check (kind in ('image', 'video', 'other')),
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now(),
  constraint project_gallery_assets_name_len check (char_length(trim(name)) between 1 and 255),
  constraint project_gallery_assets_path_unique unique (storage_path)
);

create index if not exists project_gallery_assets_project_folder_idx
  on public.project_gallery_assets (project_id, folder_id, created_at desc);

alter table public.project_gallery_folders enable row level security;
alter table public.project_gallery_assets enable row level security;

drop policy if exists "gallery_folders_select_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_insert_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_update_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_delete_own" on public.project_gallery_folders;

create policy "gallery_folders_select_own"
  on public.project_gallery_folders
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "gallery_folders_insert_own"
  on public.project_gallery_folders
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "gallery_folders_update_own"
  on public.project_gallery_folders
  for update
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

create policy "gallery_folders_delete_own"
  on public.project_gallery_folders
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "gallery_assets_select_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_insert_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_update_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_delete_own" on public.project_gallery_assets;

create policy "gallery_assets_select_own"
  on public.project_gallery_assets
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "gallery_assets_insert_own"
  on public.project_gallery_assets
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "gallery_assets_update_own"
  on public.project_gallery_assets
  for update
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

create policy "gallery_assets_delete_own"
  on public.project_gallery_assets
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Public bucket so media URLs work for Blotato / social publish
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  209715200,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery_storage_select" on storage.objects;
drop policy if exists "gallery_storage_insert_own" on storage.objects;
drop policy if exists "gallery_storage_update_own" on storage.objects;
drop policy if exists "gallery_storage_delete_own" on storage.objects;

-- Public read (bucket is public); keep explicit select for authenticated too
create policy "gallery_storage_select"
  on storage.objects
  for select
  using (bucket_id = 'gallery');

create policy "gallery_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "gallery_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gallery'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'gallery'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );

create policy "gallery_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gallery'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.owner_id = auth.uid()
    )
  );
