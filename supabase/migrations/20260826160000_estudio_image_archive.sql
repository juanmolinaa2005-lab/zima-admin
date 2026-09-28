-- Archive Creator Imagen jobs (hide from the queue without deleting Library assets).

alter table public.estudio_image_jobs
  add column if not exists archived_at timestamptz;

create index if not exists estudio_image_jobs_archived_idx
  on public.estudio_image_jobs (project_id, archived_at);

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
      and j.archived_at is null
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
