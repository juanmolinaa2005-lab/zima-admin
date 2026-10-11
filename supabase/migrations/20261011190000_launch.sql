-- Lanzamiento: the post-build playbook (roadmap, channels, feedback, weekly metrics).
create table if not exists public.launch_profiles (
  project_id uuid primary key references public.projects (id) on delete cascade,
  product_type text check (product_type in ('app', 'web', 'both')),
  launch_date date,
  goal_mrr numeric(12, 2) check (goal_mrr is null or goal_mrr >= 0),
  pitch text check (pitch is null or char_length(pitch) <= 280),
  updated_at timestamptz not null default now()
);

create table if not exists public.launch_tasks (
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id text not null,
  done_at timestamptz not null default now(),
  primary key (project_id, task_id)
);

create table if not exists public.launch_channels (
  project_id uuid not null references public.projects (id) on delete cascade,
  channel_id text not null,
  status text not null default 'todo' check (status in ('todo', 'planned', 'launched', 'skipped')),
  planned_for date,
  url text check (url is null or char_length(url) <= 500),
  result text check (result is null or char_length(result) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (project_id, channel_id)
);

create table if not exists public.launch_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  detail text check (detail is null or char_length(detail) <= 4000),
  source text check (source is null or char_length(source) <= 40),
  votes integer not null default 1 check (votes >= 0),
  status text not null default 'new' check (status in ('new', 'planned', 'progress', 'done', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists launch_feedback_project_idx on public.launch_feedback (project_id, votes desc, created_at desc);

create table if not exists public.launch_metrics (
  project_id uuid not null references public.projects (id) on delete cascade,
  week_start date not null,
  visitors integer check (visitors is null or visitors >= 0),
  signups integer check (signups is null or signups >= 0),
  active_users integer check (active_users is null or active_users >= 0),
  paying integer check (paying is null or paying >= 0),
  mrr numeric(12, 2) check (mrr is null or mrr >= 0),
  updated_at timestamptz not null default now(),
  primary key (project_id, week_start)
);

alter table public.launch_profiles enable row level security;
alter table public.launch_tasks enable row level security;
alter table public.launch_channels enable row level security;
alter table public.launch_feedback enable row level security;
alter table public.launch_metrics enable row level security;

drop policy if exists "launch_profiles_owner" on public.launch_profiles;
create policy "launch_profiles_owner" on public.launch_profiles for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "launch_tasks_owner" on public.launch_tasks;
create policy "launch_tasks_owner" on public.launch_tasks for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "launch_channels_owner" on public.launch_channels;
create policy "launch_channels_owner" on public.launch_channels for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "launch_feedback_owner" on public.launch_feedback;
create policy "launch_feedback_owner" on public.launch_feedback for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists "launch_metrics_owner" on public.launch_metrics;
create policy "launch_metrics_owner" on public.launch_metrics for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
