create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  format text not null,
  platform text,
  hook text not null check (char_length(hook) <= 300),
  beats text[] not null default '{}',
  caption text,
  hashtags text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'used', 'discarded')),
  source text not null default 'template' check (source in ('ai', 'template')),
  variant_of text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists content_ideas_project_status_idx on public.content_ideas (project_id, status, created_at desc);

alter table public.content_ideas enable row level security;

drop policy if exists "content_ideas owner" on public.content_ideas;
create policy "content_ideas owner" on public.content_ideas
  for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
