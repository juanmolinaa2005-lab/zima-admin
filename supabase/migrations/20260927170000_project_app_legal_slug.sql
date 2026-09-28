alter table public.project_app_legal
  add column if not exists slug text;

create unique index if not exists project_app_legal_slug_uidx
  on public.project_app_legal (slug)
  where slug is not null;

update public.project_app_legal
set slug = left(
  regexp_replace(
    lower(
      coalesce(
        nullif(draft->'profile'->>'domain', ''),
        nullif(draft->'profile'->>'appName', ''),
        ''
      )
    ),
    '[^a-z0-9]',
    '',
    'g'
  ),
  40
)
where slug is null
  and coalesce(draft->'profile'->>'domain', draft->'profile'->>'appName', '') <> '';
