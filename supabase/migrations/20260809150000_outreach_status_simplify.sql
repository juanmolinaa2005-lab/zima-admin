-- Simplify outreach statuses to pending | approved | declined

update public.project_outreach_requests
set status = case
  when status in ('replied', 'opened') then 'approved'
  when status = 'declined' then 'declined'
  else 'pending'
end
where status not in ('pending', 'approved', 'declined');

alter table public.project_outreach_requests
  drop constraint if exists project_outreach_requests_status_check;

alter table public.project_outreach_requests
  alter column status set default 'pending';

alter table public.project_outreach_requests
  add constraint project_outreach_requests_status_check
  check (status in ('pending', 'approved', 'declined'));
