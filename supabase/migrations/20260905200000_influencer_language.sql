-- Language belongs to the shared identity, independent of video prompt language.
alter table public.estudio_influencers add column if not exists language text not null default 'es';
alter table public.estudio_influencers drop constraint if exists estudio_influencers_language_check;
alter table public.estudio_influencers add constraint estudio_influencers_language_check check (language in ('es','en'));
