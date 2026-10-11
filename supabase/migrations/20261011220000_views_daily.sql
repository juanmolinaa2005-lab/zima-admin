-- Vistas diarias por proyecto: el cron refresca los videos y guarda el total del día.
create table if not exists public.project_views_daily (
  project_id uuid not null references public.projects (id) on delete cascade,
  day date not null,
  total_views bigint not null default 0,
  videos integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, day)
);

alter table public.project_views_daily enable row level security;

drop policy if exists "project_views_daily_owner" on public.project_views_daily;
create policy "project_views_daily_owner" on public.project_views_daily for select to authenticated
  using (public.is_project_owner(project_id));

insert into public.internal_cron_tokens (name) values ('viewtracker-refresh') on conflict (name) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'viewtracker-refresh';
select cron.schedule(
  'viewtracker-refresh',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://vantko.com/api/cron/viewtracker-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select token from public.internal_cron_tokens where name = 'viewtracker-refresh')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
