-- Upload: flows that publish reviewed influencer videos on a schedule.
create table if not exists public.upload_flows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Nuevo flujo',
  influencer_id uuid references public.estudio_influencers (id) on delete set null,
  dynamic_id text,
  account_id uuid references public.project_social_accounts (id) on delete set null,
  every_hours integer not null default 24 check (every_hours between 1 and 336),
  caption text not null default '',
  active boolean not null default false,
  next_publish_at timestamptz,
  last_published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upload_flows_project_idx on public.upload_flows (project_id, created_at desc);
create index if not exists upload_flows_due_idx on public.upload_flows (next_publish_at) where active;

create table if not exists public.upload_flow_items (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.upload_flows (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id uuid references public.estudio_influencer_videos (id) on delete cascade,
  video_url text not null,
  overlay text,
  caption text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'publishing', 'published', 'failed')),
  error text,
  post_id uuid,
  external_id text,
  reviewed_at timestamptz,
  rejected_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, video_id)
);

create index if not exists upload_flow_items_flow_idx on public.upload_flow_items (flow_id, status, created_at);
create index if not exists upload_flow_items_trash_idx on public.upload_flow_items (rejected_at) where status = 'rejected';

alter table public.upload_flows enable row level security;
alter table public.upload_flow_items enable row level security;

drop policy if exists "upload_flows_all_own" on public.upload_flows;
create policy "upload_flows_all_own"
  on public.upload_flows for all to authenticated
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

drop policy if exists "upload_flow_items_all_own" on public.upload_flow_items;
create policy "upload_flow_items_all_own"
  on public.upload_flow_items for all to authenticated
  using (user_id = auth.uid() and public.is_project_owner(project_id))
  with check (user_id = auth.uid() and public.is_project_owner(project_id));

-- Tokens that let pg_cron call app workers; generated here so no secret lives in git.
create table if not exists public.internal_cron_tokens (
  name text primary key,
  token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.internal_cron_tokens enable row level security;
insert into public.internal_cron_tokens (name) values ('upload-flows') on conflict (name) do nothing;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'upload-flows';
select cron.schedule(
  'upload-flows',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://vantko.com/api/cron/upload-flows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select token from public.internal_cron_tokens where name = 'upload-flows')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
