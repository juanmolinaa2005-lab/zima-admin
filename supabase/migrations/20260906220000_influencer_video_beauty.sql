-- TikTok-style skin smooth on saved influencer talking/clone clips.

alter table public.estudio_influencer_videos
  add column if not exists beauty boolean not null default true;
