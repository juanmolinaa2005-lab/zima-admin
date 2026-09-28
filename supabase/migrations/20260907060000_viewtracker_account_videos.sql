-- Link tracked videos to the account they were ingested from.

alter table public.project_tracked_videos
  add column if not exists account_id uuid references public.project_tracked_accounts(id) on delete set null;

create index if not exists project_tracked_videos_account_idx
  on public.project_tracked_videos (account_id)
  where account_id is not null;
