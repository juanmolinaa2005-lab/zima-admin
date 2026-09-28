-- Influencers can be archived as inactive without deleting them.

alter table public.estudio_influencers
  add column if not exists active boolean not null default true;

create index if not exists estudio_influencers_project_active_idx
  on public.estudio_influencers (project_id, active, created_at desc);
