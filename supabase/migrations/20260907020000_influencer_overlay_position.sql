-- On-screen caption placement for influencer talking clips.

alter table public.estudio_influencer_videos
  add column if not exists overlay_position text not null default 'upper';
