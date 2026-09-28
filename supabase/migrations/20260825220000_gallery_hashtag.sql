alter table public.project_gallery_assets
  add column if not exists hashtag text;

alter table public.project_gallery_assets
  drop constraint if exists project_gallery_assets_hashtag_len;

alter table public.project_gallery_assets
  add constraint project_gallery_assets_hashtag_len
  check (hashtag is null or char_length(hashtag) between 1 and 4000);
