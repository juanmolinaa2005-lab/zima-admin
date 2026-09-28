-- Idempotent: unique lookup for fal webhooks even if the previous index was non-unique.

drop index if exists public.estudio_autopilot_fal_request_idx;
create unique index if not exists estudio_autopilot_fal_request_uidx
  on public.estudio_video_autopilot_runs (fal_request_id)
  where fal_request_id is not null;
