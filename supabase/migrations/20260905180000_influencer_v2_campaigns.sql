-- Influencers 2 campaigns (multi-scene montage) isolated from V1 drafts.

alter table public.estudio_influencer_videos
  add column if not exists v2_campaign_id uuid,
  add column if not exists v2_scene_id text;

create table if not exists public.estudio_influencer_v2_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  influencer_id uuid references public.estudio_influencers(id) on delete set null,
  title text not null default 'Campaña UGC',
  brief text not null default '',
  objective text not null default '',
  language text not null default 'es',
  model_id text,
  status text not null default 'draft',
  continuity jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  final_asset_id uuid references public.project_gallery_assets(id) on delete set null,
  final_video_url text,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estudio_v2_campaigns_status_check
    check (status in ('draft', 'planned', 'generating', 'ready', 'composing', 'done', 'failed')),
  constraint estudio_v2_campaigns_lang_check
    check (language in ('es', 'en'))
);

create index if not exists estudio_v2_campaigns_project_idx
  on public.estudio_influencer_v2_campaigns (project_id, created_at desc);

create unique index if not exists estudio_inf_videos_v2_scene_uidx
  on public.estudio_influencer_videos (v2_campaign_id, v2_scene_id)
  where v2_campaign_id is not null and v2_scene_id is not null;

create index if not exists estudio_inf_videos_v2_campaign_idx
  on public.estudio_influencer_videos (v2_campaign_id)
  where v2_campaign_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estudio_inf_videos_v2_campaign_fk'
  ) then
    alter table public.estudio_influencer_videos
      add constraint estudio_inf_videos_v2_campaign_fk
      foreign key (v2_campaign_id)
      references public.estudio_influencer_v2_campaigns(id)
      on delete cascade;
  end if;
end $$;

alter table public.estudio_influencer_v2_campaigns enable row level security;

drop policy if exists "estudio_v2_campaigns_select_own" on public.estudio_influencer_v2_campaigns;
drop policy if exists "estudio_v2_campaigns_insert_own" on public.estudio_influencer_v2_campaigns;
drop policy if exists "estudio_v2_campaigns_update_own" on public.estudio_influencer_v2_campaigns;
drop policy if exists "estudio_v2_campaigns_delete_own" on public.estudio_influencer_v2_campaigns;

create policy "estudio_v2_campaigns_select_own"
  on public.estudio_influencer_v2_campaigns for select
  using (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_v2_campaigns_insert_own"
  on public.estudio_influencer_v2_campaigns for insert
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_v2_campaigns_update_own"
  on public.estudio_influencer_v2_campaigns for update
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

create policy "estudio_v2_campaigns_delete_own"
  on public.estudio_influencer_v2_campaigns for delete
  using (user_id = auth.uid() and public.is_project_owner(project_id));

grant select, insert, update, delete on public.estudio_influencer_v2_campaigns to authenticated;
