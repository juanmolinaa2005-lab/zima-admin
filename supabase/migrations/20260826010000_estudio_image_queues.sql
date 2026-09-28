-- Creator Imagen queues: server-side jobs so generation continues when the browser is closed.

create table if not exists public.estudio_image_queues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id text not null,
  model_id text not null,
  model_name text not null,
  folder_id uuid not null,
  folder_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists estudio_image_queues_project_created_idx
  on public.estudio_image_queues (project_id, created_at desc);

create table if not exists public.estudio_image_jobs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.estudio_image_queues(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  sort_index int not null default 0,
  request_id text,
  status text not null default 'pending',
  image_url text,
  asset_id uuid,
  error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estudio_image_jobs_prompt_len check (char_length(trim(prompt)) between 1 and 8000)
);

create index if not exists estudio_image_jobs_queue_idx
  on public.estudio_image_jobs (queue_id, sort_index);

create index if not exists estudio_image_jobs_claim_idx
  on public.estudio_image_jobs (created_at)
  where status in ('pending', 'queued', 'in_progress', 'completed', 'saving')
    and asset_id is null;

alter table public.estudio_image_queues enable row level security;
alter table public.estudio_image_jobs enable row level security;

drop policy if exists "estudio_queues_select_own" on public.estudio_image_queues;
drop policy if exists "estudio_queues_insert_own" on public.estudio_image_queues;
drop policy if exists "estudio_queues_update_own" on public.estudio_image_queues;
drop policy if exists "estudio_queues_delete_own" on public.estudio_image_queues;

create policy "estudio_queues_select_own"
  on public.estudio_image_queues for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "estudio_queues_insert_own"
  on public.estudio_image_queues for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "estudio_queues_update_own"
  on public.estudio_image_queues for update
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

create policy "estudio_queues_delete_own"
  on public.estudio_image_queues for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "estudio_jobs_select_own" on public.estudio_image_jobs;
drop policy if exists "estudio_jobs_insert_own" on public.estudio_image_jobs;
drop policy if exists "estudio_jobs_update_own" on public.estudio_image_jobs;
drop policy if exists "estudio_jobs_delete_own" on public.estudio_image_jobs;

create policy "estudio_jobs_select_own"
  on public.estudio_image_jobs for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "estudio_jobs_insert_own"
  on public.estudio_image_jobs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "estudio_jobs_update_own"
  on public.estudio_image_jobs for update
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

create policy "estudio_jobs_delete_own"
  on public.estudio_image_jobs for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.claim_estudio_image_jobs(max_n integer)
returns setof public.estudio_image_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select j.id
    from public.estudio_image_jobs j
    where j.status in ('pending', 'queued', 'in_progress', 'completed', 'saving')
      and j.asset_id is null
      and (j.locked_at is null or j.locked_at < now() - interval '3 minutes')
    order by j.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(max_n, 2), 4))
  )
  update public.estudio_image_jobs as j
  set locked_at = now(),
      updated_at = now()
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_estudio_image_jobs(integer) from public;
revoke all on function public.claim_estudio_image_jobs(integer) from anon;
revoke all on function public.claim_estudio_image_jobs(integer) from authenticated;
grant execute on function public.claim_estudio_image_jobs(integer) to service_role;
