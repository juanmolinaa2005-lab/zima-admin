-- Shared public ad data. Private saved ads remain in market_items.
-- Only server-side service_role can read or write these tables/functions.
create table if not exists public.market_ad_catalog (
  id text primary key,
  page_id text not null default '',
  page_name text not null default '',
  creative_text text not null default '',
  search_vector tsvector generated always as
    (to_tsvector('simple', page_name || ' ' || creative_text)) stored,
  countries text[] not null default '{}',
  data jsonb not null,
  source text not null check (source in ('meta_api', 'meta_public')),
  observed_at timestamptz not null default now()
);
create index if not exists market_ad_catalog_search_idx on public.market_ad_catalog using gin(search_vector);
create index if not exists market_ad_catalog_countries_idx on public.market_ad_catalog using gin(countries);
create index if not exists market_ad_catalog_page_idx on public.market_ad_catalog(page_id);

create table if not exists public.market_ad_searches (
  key text primary key,
  params jsonb not null,
  state text not null default 'queued' check (state in ('queued','running','ready','error')),
  ad_ids text[] not null default '{}',
  next_cursor text,
  source text,
  partial boolean not null default false,
  fetched_at timestamptz,
  last_requested_at timestamptz not null default now(),
  refresh_after timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  attempts integer not null default 0,
  error_code text,
  error_message text
);
create index if not exists market_ad_searches_due_idx on public.market_ad_searches(refresh_after);

create table if not exists public.market_ad_request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour timestamptz not null,
  requests integer not null default 0,
  primary key (user_id, hour)
);
alter table public.market_ad_catalog enable row level security;
alter table public.market_ad_searches enable row level security;
alter table public.market_ad_request_limits enable row level security;
revoke all on public.market_ad_catalog, public.market_ad_searches, public.market_ad_request_limits from anon, authenticated;
grant all on public.market_ad_catalog, public.market_ad_searches, public.market_ad_request_limits to service_role;

create or replace function public.request_market_ad_search(p_key text, p_params jsonb, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare job public.market_ad_searches; used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select * into job from public.market_ad_searches where key = p_key;
  if found then
    update public.market_ad_searches set last_requested_at = now() where key = p_key;
    if job.refresh_after > now() or job.lease_until > now() or job.state = 'queued' then
      return to_jsonb(job);
    end if;
  end if;
  insert into public.market_ad_request_limits(user_id, hour, requests)
    values(p_user, date_trunc('hour', now()), 1)
    on conflict(user_id, hour) do update set requests = market_ad_request_limits.requests + 1
    returning requests into used;
  if used > 30 then return jsonb_build_object('limited', true); end if;
  insert into public.market_ad_searches(key, params) values(p_key, p_params)
    on conflict(key) do update set state = 'queued', refresh_after = now(), last_requested_at = now()
    returning * into job;
  return to_jsonb(job);
end $$;

create or replace function public.claim_market_ad_search(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare job public.market_ad_searches;
begin
  -- Bound global collection concurrency as well as deduplicating each query.
  perform pg_advisory_xact_lock(hashtextextended('market-ad-collector-capacity', 0));
  if (select count(*) from public.market_ad_searches where lease_until > now()) >= 4 then return null; end if;
  update public.market_ad_searches set state = 'running', lease_until = now() + interval '90 seconds',
    lease_token = gen_random_uuid(), attempts = attempts + 1
    where key = p_key and refresh_after <= now() and (lease_until is null or lease_until <= now())
    returning * into job;
  if not found then return null; end if;
  return to_jsonb(job);
end $$;

create or replace function public.finish_market_ad_search(
  p_key text, p_lease uuid, p_result jsonb, p_error_code text default null, p_error_message text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare job public.market_ad_searches; ad jsonb; ids text[] := '{}'; observed_countries text[];
begin
  select * into job from public.market_ad_searches where key = p_key and lease_token = p_lease for update;
  if not found then return false; end if;
  if p_error_code is not null then
    update public.market_ad_searches set state = 'error', error_code = p_error_code,
      error_message = left(p_error_message, 500), lease_until = null, lease_token = null,
      refresh_after = now() + case when p_error_code in ('META_PERMISSION','META_TOKEN','PUBLIC_BLOCKED','PUBLIC_UNAVAILABLE')
        then interval '6 hours' else least(interval '24 hours', interval '15 minutes' * power(2, least(job.attempts - 1, 7))) end
      where key = p_key;
    return true;
  end if;
  select array_agg(value) into observed_countries from jsonb_array_elements_text(job.params->'countries');
  for ad in select value from jsonb_array_elements(p_result->'ads') loop
    if coalesce(ad->>'id', '') !~ '^[0-9]+$' then continue; end if;
    insert into public.market_ad_catalog(id, page_id, page_name, creative_text, countries, data, source)
      values(ad->>'id', ad->>'pageId', ad->>'pageName',
        concat_ws(' ', ad->>'pageName', ad->'bodies', ad->'titles'), observed_countries, ad, p_result->>'source')
      on conflict(id) do update set page_id = excluded.page_id, page_name = excluded.page_name,
        creative_text = excluded.creative_text,
        countries = array(select distinct unnest(market_ad_catalog.countries || excluded.countries)),
        data = excluded.data,
        source = excluded.source, observed_at = now();
    if not (ad->>'id' = any(ids)) then ids := array_append(ids, ad->>'id'); end if;
  end loop;
  update public.market_ad_searches set state = 'ready', ad_ids = ids, next_cursor = p_result->>'after',
    source = p_result->>'source', partial = coalesce((p_result->>'partial')::boolean, false),
    fetched_at = now(), refresh_after = now() + interval '24 hours', attempts = 0,
    error_code = null, error_message = null, lease_until = null, lease_token = null where key = p_key;
  return true;
end $$;

revoke all on function public.request_market_ad_search(text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.claim_market_ad_search(text) from public, anon, authenticated;
revoke all on function public.finish_market_ad_search(text,uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.request_market_ad_search(text,jsonb,uuid) to service_role;
grant execute on function public.claim_market_ad_search(text) to service_role;
grant execute on function public.finish_market_ad_search(text,uuid,jsonb,text,text) to service_role;

create or replace function public.cache_market_ad_media(p_id text, p_media jsonb)
returns void language sql security definer set search_path = public as $$
  update public.market_ad_catalog set data = jsonb_set(data, '{media}', p_media) where id = p_id;
$$;
revoke all on function public.cache_market_ad_media(text,jsonb) from public, anon, authenticated;
grant execute on function public.cache_market_ad_media(text,jsonb) to service_role;
