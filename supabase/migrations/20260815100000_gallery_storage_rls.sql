-- Gallery storage RLS: owner-checked uploads + audio in the public bucket.
-- Storage policies that query public.projects can fail when projects RLS
-- hides rows; use a security-definer helper instead.

create or replace function public.is_project_owner(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = pid
      and p.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_project_owner(uuid) from public;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to anon;

create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  folder text;
begin
  folder := split_part(object_name, '/', 1);
  if folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return folder::uuid;
  end if;
  return null;
end;
$$;

revoke all on function public.storage_project_id(text) from public;
grant execute on function public.storage_project_id(text) to authenticated;
grant execute on function public.storage_project_id(text) to anon;

-- Ensure projects themselves are readable/writable by the owner
-- (RLS was enabled in an earlier migration without policies in git).
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own"
  on public.projects for select
  using (owner_id = auth.uid());

create policy "projects_insert_own"
  on public.projects for insert
  with check (owner_id = auth.uid());

create policy "projects_update_own"
  on public.projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "projects_delete_own"
  on public.projects for delete
  using (owner_id = auth.uid());

drop policy if exists "project_tools_select_own" on public.project_tools;
drop policy if exists "project_tools_insert_own" on public.project_tools;
drop policy if exists "project_tools_update_own" on public.project_tools;
drop policy if exists "project_tools_delete_own" on public.project_tools;

create policy "project_tools_select_own"
  on public.project_tools for select
  using (public.is_project_owner(project_id));

create policy "project_tools_insert_own"
  on public.project_tools for insert
  with check (public.is_project_owner(project_id));

create policy "project_tools_update_own"
  on public.project_tools for update
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "project_tools_delete_own"
  on public.project_tools for delete
  using (public.is_project_owner(project_id));

-- Gallery table policies (same helper)
drop policy if exists "gallery_folders_select_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_insert_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_update_own" on public.project_gallery_folders;
drop policy if exists "gallery_folders_delete_own" on public.project_gallery_folders;

create policy "gallery_folders_select_own"
  on public.project_gallery_folders for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_folders_insert_own"
  on public.project_gallery_folders for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_folders_update_own"
  on public.project_gallery_folders for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_folders_delete_own"
  on public.project_gallery_folders for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

drop policy if exists "gallery_assets_select_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_insert_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_update_own" on public.project_gallery_assets;
drop policy if exists "gallery_assets_delete_own" on public.project_gallery_assets;

create policy "gallery_assets_select_own"
  on public.project_gallery_assets for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_assets_insert_own"
  on public.project_gallery_assets for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_assets_update_own"
  on public.project_gallery_assets for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "gallery_assets_delete_own"
  on public.project_gallery_assets for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

grant select, insert, update, delete on public.project_gallery_folders to authenticated;
grant select, insert, update, delete on public.project_gallery_assets to authenticated;

-- Recreate storage policies
drop policy if exists "gallery_storage_select" on storage.objects;
drop policy if exists "gallery_storage_insert_own" on storage.objects;
drop policy if exists "gallery_storage_update_own" on storage.objects;
drop policy if exists "gallery_storage_delete_own" on storage.objects;

create policy "gallery_storage_select"
  on storage.objects
  for select
  using (bucket_id = 'gallery');

create policy "gallery_storage_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'gallery'
    and auth.uid() is not null
    and public.is_project_owner(public.storage_project_id(name))
  );

create policy "gallery_storage_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'gallery'
    and auth.uid() is not null
    and public.is_project_owner(public.storage_project_id(name))
  )
  with check (
    bucket_id = 'gallery'
    and auth.uid() is not null
    and public.is_project_owner(public.storage_project_id(name))
  );

create policy "gallery_storage_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'gallery'
    and auth.uid() is not null
    and public.is_project_owner(public.storage_project_id(name))
  );

update storage.buckets
set
  public = true,
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
    'audio/webm',
    'audio/ogg'
  ]
where id = 'gallery';
