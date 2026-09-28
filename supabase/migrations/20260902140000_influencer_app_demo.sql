-- Combine talking-head influencer clips with the project's App Demo.

alter table public.estudio_influencer_videos
  add column if not exists format text not null default 'talking',
  add column if not exists demo_code text,
  add column if not exists demo_phone_frame boolean not null default true,
  add column if not exists demo_variables jsonb,
  add column if not exists talking_video_url text,
  add column if not exists demo_video_url text;

alter table public.estudio_influencer_videos
  drop constraint if exists estudio_influencer_videos_format_check;

alter table public.estudio_influencer_videos
  add constraint estudio_influencer_videos_format_check
  check (format in ('talking', 'app-demo'));
