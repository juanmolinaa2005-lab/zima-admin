-- Run inside a transaction and roll it back. Fixtures must never be committed.
do $$
declare
  uid uuid; k text := 'catalog-test-' || gen_random_uuid(); j jsonb; lease uuid;
  old_lease uuid; accepted boolean; count_before integer; result jsonb;
begin
  select id into uid from auth.users limit 1;
  if uid is null then raise exception 'Requires one existing test user'; end if;
  select coalesce(sum(requests), 0) into count_before from public.market_ad_request_limits
    where user_id = uid and hour = date_trunc('hour', now());
  j := public.request_market_ad_search(k, '{"q":"synthetic fixture","countries":["US"],"active":true}', uid);
  assert j->>'state' = 'queued', 'New searches must queue';
  j := public.request_market_ad_search(k, '{}', gen_random_uuid());
  assert j->>'state' = 'queued', 'Another user must reuse the same job';
  assert (select requests from public.market_ad_request_limits where user_id = uid and hour = date_trunc('hour', now())) = count_before + 1,
    'Cache hits must not consume a new collection allowance';
  j := public.claim_market_ad_search(k); lease := (j->>'lease_token')::uuid;
  assert lease is not null, 'Job must be claimable';
  assert public.claim_market_ad_search(k) is null, 'A second worker must not duplicate collection';
  old_lease := lease;
  update public.market_ad_searches set lease_until = now() - interval '1 second' where key = k;
  j := public.claim_market_ad_search(k); lease := (j->>'lease_token')::uuid;
  assert lease <> old_lease, 'Expired leases must be recoverable';
  result := '{"ads":[{"id":"990000000000000001","pageId":"990001","pageName":"Synthetic fixture","bodies":["Fixture only"],"titles":[],"active":true}],"after":"opaque","source":"meta_public","partial":true}';
  accepted := public.finish_market_ad_search(k, old_lease, result);
  assert not accepted, 'Old workers must not overwrite a newer lease';
  accepted := public.finish_market_ad_search(k, lease, result);
  assert accepted, 'Current worker must save results';
  j := public.request_market_ad_search(k, '{}', gen_random_uuid());
  assert j->>'state' = 'ready' and j->'ad_ids'->>0 = '990000000000000001', 'Results must be shared';
  assert (j->>'refresh_after')::timestamptz >= now() + interval '23 hours', 'Successful results should be reused for one day';
  assert public.claim_market_ad_search(k) is null, 'Fresh searches must not recollect';
  update public.market_ad_searches set refresh_after = now() - interval '1 second' where key = k;
  j := public.claim_market_ad_search(k); lease := (j->>'lease_token')::uuid;
  perform public.finish_market_ad_search(k, lease, null, 'PUBLIC_BLOCKED', 'Synthetic blocked fixture');
  select to_jsonb(s) into j from public.market_ad_searches s where key = k;
  assert j->>'state' = 'error' and j->'ad_ids'->>0 = '990000000000000001', 'A source failure must preserve saved results';
  assert (j->>'refresh_after')::timestamptz >= now() + interval '5 hours', 'Blocked sources must back off';
  perform public.cache_market_ad_media('990000000000000001', '{"image":null,"video":null,"avatar":null}');
  assert (select data->>'pageName' from public.market_ad_catalog where id = '990000000000000001') = 'Synthetic fixture', 'Media writes must preserve metadata';
  update public.market_ad_searches set refresh_after = now() - interval '1 second' where key = k;
  j := public.claim_market_ad_search(k); lease := (j->>'lease_token')::uuid;
  perform public.finish_market_ad_search(k, lease, '{"ads":[],"after":null,"source":"meta_api","partial":false}');
  assert (select cardinality(ad_ids) = 0 from public.market_ad_searches where key = k), 'A verified empty result must replace previous matches';
  for i in 1..31 loop
    j := public.request_market_ad_search(k || i, '{"q":"quota fixture","countries":["US"],"active":true}', uid);
  end loop;
  assert (j->>'limited')::boolean, 'New searches must have a per-user collection limit';
  assert not has_table_privilege('authenticated', 'public.market_ad_catalog', 'SELECT'), 'Clients must not access the shared catalog directly';
  assert not has_function_privilege('anon', 'public.claim_market_ad_search(text)', 'EXECUTE'), 'Anonymous callers must not start collection';
  assert has_function_privilege('service_role', 'public.claim_market_ad_search(text)', 'EXECUTE'), 'Server must be able to start collection';
end $$;
