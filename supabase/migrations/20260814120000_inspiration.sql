-- Saved inspiration video links per project (Redes)

create table if not exists public.project_inspiration_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  note text,
  platform text not null default 'other'
    check (platform in ('youtube', 'tiktok', 'instagram', 'other')),
  thumbnail_url text,
  created_at timestamptz not null default now(),
  constraint project_inspiration_url_len check (char_length(trim(url)) between 8 and 2000),
  constraint project_inspiration_title_len check (title is null or char_length(title) <= 300),
  constraint project_inspiration_note_len check (note is null or char_length(note) <= 1000)
);

create index if not exists project_inspiration_links_project_idx
  on public.project_inspiration_links (project_id, created_at desc);

alter table public.project_inspiration_links enable row level security;

create policy "inspiration_select_own"
  on public.project_inspiration_links
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "inspiration_insert_own"
  on public.project_inspiration_links
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "inspiration_delete_own"
  on public.project_inspiration_links
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );
