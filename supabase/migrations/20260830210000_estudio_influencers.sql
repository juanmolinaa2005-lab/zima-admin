-- Creator Estudio influencers: face first, remaining poses generated in the background.

create table if not exists public.estudio_influencers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  traits text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists estudio_influencers_project_created_idx
  on public.estudio_influencers (project_id, created_at desc);

create table if not exists public.estudio_influencer_shots (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.estudio_influencers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shot_key text not null,
  label text not null,
  sort_index int not null default 0,
  prompt text not null,
  image_size text not null default 'portrait_16_9',
  reference_url text,
  request_id text,
  status text not null default 'pending',
  image_url text,
  error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (influencer_id, shot_key)
);

create index if not exists estudio_influencer_shots_inf_idx
  on public.estudio_influencer_shots (influencer_id, sort_index);

create index if not exists estudio_influencer_shots_claim_idx
  on public.estudio_influencer_shots (created_at)
  where status in ('pending', 'queued', 'in_progress', 'saving')
    and image_url is null;

alter table public.estudio_influencers enable row level security;
alter table public.estudio_influencer_shots enable row level security;

drop policy if exists "estudio_influencers_select_own" on public.estudio_influencers;
drop policy if exists "estudio_influencers_insert_own" on public.estudio_influencers;
drop policy if exists "estudio_influencers_update_own" on public.estudio_influencers;
drop policy if exists "estudio_influencers_delete_own" on public.estudio_influencers;

create policy "estudio_influencers_select_own"
  on public.estudio_influencers for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_influencers_insert_own"
  on public.estudio_influencers for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_influencers_update_own"
  on public.estudio_influencers for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_influencers_delete_own"
  on public.estudio_influencers for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

drop policy if exists "estudio_inf_shots_select_own" on public.estudio_influencer_shots;
drop policy if exists "estudio_inf_shots_insert_own" on public.estudio_influencer_shots;
drop policy if exists "estudio_inf_shots_update_own" on public.estudio_influencer_shots;
drop policy if exists "estudio_inf_shots_delete_own" on public.estudio_influencer_shots;

create policy "estudio_inf_shots_select_own"
  on public.estudio_influencer_shots for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_shots_insert_own"
  on public.estudio_influencer_shots for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_shots_update_own"
  on public.estudio_influencer_shots for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_inf_shots_delete_own"
  on public.estudio_influencer_shots for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

grant select, insert, update, delete on public.estudio_influencers to authenticated;
grant select, insert, update, delete on public.estudio_influencer_shots to authenticated;

create or replace function public.claim_estudio_influencer_shots(max_n integer)
returns setof public.estudio_influencer_shots
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select s.id
    from public.estudio_influencer_shots s
    where s.status in ('pending', 'queued', 'in_progress', 'saving')
      and s.image_url is null
      and (s.locked_at is null or s.locked_at < now() - interval '3 minutes')
      and (
        s.shot_key = 'face-front'
        or exists (
          select 1
          from public.estudio_influencer_shots f
          where f.influencer_id = s.influencer_id
            and f.shot_key = 'face-front'
            and f.image_url is not null
        )
      )
    order by
      case when s.shot_key = 'face-front' then 0 else 1 end,
      s.sort_index asc,
      s.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(max_n, 2), 3))
  )
  update public.estudio_influencer_shots as s
  set locked_at = now(),
      updated_at = now()
  from picked
  where s.id = picked.id
  returning s.*;
end;
$$;

revoke all on function public.claim_estudio_influencer_shots(integer) from public;
revoke all on function public.claim_estudio_influencer_shots(integer) from anon;
revoke all on function public.claim_estudio_influencer_shots(integer) from authenticated;
grant execute on function public.claim_estudio_influencer_shots(integer) to service_role;
