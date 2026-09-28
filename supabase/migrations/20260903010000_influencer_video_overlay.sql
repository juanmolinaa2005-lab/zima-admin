-- On-screen caption burned onto influencer talking clips (from [brackets] in the script).

alter table public.estudio_influencer_videos
  add column if not exists overlay text;
