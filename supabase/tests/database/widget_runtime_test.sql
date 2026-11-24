begin;
select plan(77);

-- Own rows, so the result is the same on a fresh and on an upgraded database.
insert into public.site_keys (id, organization_id, site_id, public_key, environment, expires_at)
values
  ('a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'cael_pk_a0000000000000000000000000000001', 'production', null),
  ('a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'cael_pk_a0000000000000000000000000000002', 'preview', now() + interval '1 day'),
  ('b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'cael_pk_b0000000000000000000000000000001', 'production', null);
insert into public.domains (organization_id, site_id, hostname, environment, verified_at, verification_method, allow_subdomains, expires_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'exact-a.example.test', 'production', now(), 'dns_txt', false, null),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'wild-a.example.test', 'production', now(), 'dns_txt', true, null),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'pending-a.example.test', 'production', null, null, false, null),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'legacy-a.example.test', 'production', now(), null, false, null),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'preview-a.example.test', 'preview', null, null, false, now() + interval '1 day'),
  ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'exact-b.example.test', 'production', now(), 'dns_txt', false, null);

create function pg_temp.bootstrap_outcome(p_key text, p_host text) returns text
language sql as $$ select outcome from public.widget_bootstrap(p_key, p_host, null) $$;
create function pg_temp.bootstrap_many(p_key text, p_host text, p_hash text, p_times integer) returns text
language sql as $$
  select string_agg(outcome || ':' || times, ',' order by outcome) from (
    select called.outcome, count(*) as times
    from generate_series(1, p_times) as attempt
    cross join lateral public.widget_bootstrap(p_key, p_host, case when attempt > 0 then p_hash end) as called
    group by 1
  ) as totals
$$;
create function pg_temp.session_outcome(p_key uuid, p_origin text, p_host text) returns text
language sql as $$
  select checked.outcome
  from public.widget_sessions as session
  cross join lateral public.check_widget_session(session.id, p_key, p_origin, p_host) as checked
  where session.bootstrap_id = 'f0000000-0000-4000-8000-000000000001'
$$;

-- Contract -------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.widget_sessions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.widget_rate_counters'::regclass),
  'RLS is enabled on widget_sessions and on the counters'
);
select has_index('public', 'widget_sessions', 'widget_sessions_organization_site_created_idx', 'tenant sessions are indexed');
select has_index('public', 'widget_sessions', 'widget_sessions_site_key_idx', 'key foreign key is indexed');
select ok(
  not has_any_column_privilege('anon', 'public.widget_sessions', 'select,insert,update'),
  'anon has no session grant'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.widget_sessions', 'insert,update')
  and not has_table_privilege('authenticated', 'public.widget_sessions', 'delete,truncate,references,trigger'),
  'authenticated cannot write sessions'
);
select ok(
  has_column_privilege('service_role', 'public.widget_sessions', 'revoked_at', 'update')
  and not has_column_privilege('service_role', 'public.widget_sessions', 'expires_at', 'update')
  and not has_any_column_privilege('service_role', 'public.widget_sessions', 'insert')
  and not has_table_privilege('service_role', 'public.widget_sessions', 'delete,truncate'),
  'service_role may only revoke a session'
);
select is_empty(
  $$
    select api.role_name
    from (values ('anon'), ('authenticated'), ('service_role')) as api (role_name)
    where has_any_column_privilege(api.role_name, 'private.widget_rate_counters', 'select,insert,update')
      or has_table_privilege(api.role_name, 'private.widget_rate_counters', 'delete,truncate')
  $$,
  'no API role touches the rate counters'
);
select is_empty(
  $$
    select column_name from information_schema.columns
    where table_name in ('widget_sessions', 'widget_rate_counters', 'site_keys')
      and column_name ~ '(^ip|address|agent|email|phone|name)'
  $$,
  'the new tables have no column for personal data'
);
select throws_ok(
  $$insert into public.domains (organization_id, site_id, hostname, allow_subdomains) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'x.example.test', true)$$,
  '23514', null, 'an unverified domain cannot be a wildcard'
);
select throws_ok(
  $$insert into public.domains (organization_id, site_id, hostname, environment, expires_at, verified_at, verification_method) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'x.example.test', 'preview', now() + interval '1 day', now(), 'dns_txt')$$,
  '23514', null, 'a preview domain cannot be verified'
);
select throws_ok(
  $$insert into public.domains (organization_id, site_id, hostname) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', '*.example.test')$$,
  '23514', null, 'a literal wildcard name is rejected'
);
select throws_ok(
  $$insert into public.domains (organization_id, site_id, hostname) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', '203.0.113.7')$$,
  '23514', null, 'an IP address is rejected'
);
select throws_ok(
  $$update public.sites set widget_accent_color = 'red;} body{display:none' where id = 'a0000000-0000-4000-8000-000000000101'$$,
  '23514', null, 'a theme color is a six digit hex value'
);
select throws_ok(
  $$update public.sites set handoff_url = 'javascript:alert(1)' where id = 'a0000000-0000-4000-8000-000000000101'$$,
  '23514', null, 'the handoff address is https only'
);

-- Domain lock ----------------------------------------------------------------

set local role service_role;
select results_eq(
  $$
    select outcome, site_id, site_key_id, environment, site_name, locale, accent_color, widget_position
    from public.widget_bootstrap('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', null)
  $$,
  $$
    values (
      'allowed', 'a0000000-0000-4000-8000-000000000101'::uuid,
      'a0000000-0000-4000-8000-000000000301'::uuid, 'production', 'Tenant A Main',
      'tr-TR', '#0b0c0f', 'bottom-right'
    )
  $$,
  'a verified exact host is allowed'
);
select is(
  pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000001', host), expected, description
)
from (values
  ('wild-a.example.test', 'allowed', 'the verified wildcard name itself is allowed'),
  ('shop.wild-a.example.test', 'allowed', 'one label below a wildcard is allowed'),
  ('a.b.wild-a.example.test', 'denied', 'two labels below a wildcard are denied'),
  ('evilwild-a.example.test', 'denied', 'a name that only ends in the same letters is denied'),
  ('example.test', 'denied', 'the parent of a wildcard is denied'),
  ('wild-a.example.test.evil.test', 'denied', 'a name that starts with an allowed one is denied'),
  ('www.exact-a.example.test', 'denied', 'a subdomain of an exact host is denied'),
  ('pending-a.example.test', 'denied', 'an unverified host is denied'),
  ('legacy-a.example.test', 'denied', 'a host verified before P0.5 is denied until proven'),
  ('preview-a.example.test', 'denied', 'a production key does not open a preview host'),
  ('exact-b.example.test', 'denied', 'a key copied to another customer is denied'),
  ('unknown.example.test', 'denied', 'an unknown host is denied'),
  ('', 'denied', 'an empty host is denied')
) as hosts (host, expected, description);

select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000002', 'preview-a.example.test'), 'allowed', 'a preview key opens its preview host');
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000002', 'exact-a.example.test'), 'denied', 'a preview key does not open a production host');
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000002', 'x.preview-a.example.test'), 'denied', 'a preview host is exact');
select is(pg_temp.bootstrap_outcome('cael_pk_b0000000000000000000000000000001', 'exact-a.example.test'), 'denied', 'the key of Tenant B does not open a Tenant A host');
select is(pg_temp.bootstrap_outcome('cael_pk_00000000000000000000000000000000', 'exact-a.example.test'), 'denied', 'an unknown key is denied');

select results_eq(
  $$select * from public.widget_bootstrap('cael_pk_00000000000000000000000000000000', 'exact-a.example.test', null)$$,
  $$select * from public.widget_bootstrap('cael_pk_a0000000000000000000000000000001', 'unknown.example.test', null)$$,
  'an unknown key and a foreign host are indistinguishable'
);
select results_eq(
  $$select outcome, site_id, site_name, widget_title, locale, accent_color, handoff_url from public.widget_bootstrap('cael_pk_a0000000000000000000000000000001', 'unknown.example.test', null)$$,
  $$values ('denied', null::uuid, null::text, null::text, null::text, null::text, null::text)$$,
  'a refusal carries no site data'
);

-- Frame ----------------------------------------------------------------------

select results_eq(
  $$select outcome, site_id, site_name from public.widget_frame('a0000000-0000-4000-8000-000000000301', 'exact-a.example.test', null)$$,
  $$values ('allowed', 'a0000000-0000-4000-8000-000000000101'::uuid, 'Tenant A Main')$$,
  'the frame resolves its site'
);
select results_eq(
  $$select outcome, site_id from public.widget_frame('a0000000-0000-4000-8000-000000000301', 'exact-b.example.test', null)$$,
  $$values ('denied', null::uuid)$$,
  'the frame rechecks the host'
);

-- Sessions -------------------------------------------------------------------

select results_eq(
  $$
    select outcome, site_id, expires_at
    from public.create_widget_session(
      'a0000000-0000-4000-8000-000000000301', 'exact-a.example.test', 'https://exact-a.example.test',
      'f0000000-0000-4000-8000-000000000001', null, 1800
    )
  $$,
  $$values ('allowed', 'a0000000-0000-4000-8000-000000000101'::uuid, now() + interval '30 minutes')$$,
  'a bootstrap buys a session of its own site'
);
select results_eq(
  $$
    select outcome, session_id from public.create_widget_session(
      'a0000000-0000-4000-8000-000000000301', 'exact-a.example.test', 'https://exact-a.example.test',
      'f0000000-0000-4000-8000-000000000001', null, 1800
    )
  $$,
  $$values ('replayed', null::uuid)$$,
  'the same bootstrap buys no second session'
);
select results_eq(
  $$
    select outcome, session_id from public.create_widget_session(
      'b0000000-0000-4000-8000-000000000301', 'exact-b.example.test', 'https://exact-b.example.test',
      'f0000000-0000-4000-8000-000000000001', null, 1800
    )
  $$,
  $$values ('replayed', null::uuid)$$,
  'a used bootstrap is spent for every key'
);
select results_eq(
  $$
    select outcome, session_id from public.create_widget_session(
      'a0000000-0000-4000-8000-000000000301', 'exact-b.example.test', 'https://exact-b.example.test',
      'f0000000-0000-4000-8000-000000000002', null, 1800
    )
  $$,
  $$values ('denied', null::uuid)$$,
  'a foreign host gets no session'
);
select throws_ok(
  $$select public.create_widget_session('a0000000-0000-4000-8000-000000000301', 'exact-a.example.test', 'https://exact-a.example.test', 'f0000000-0000-4000-8000-000000000003', null, 86400)$$,
  '22023', 'invalid_session_ttl', 'a session cannot outlive an hour'
);
select results_eq(
  $$
    select checked.outcome, checked.organization_id, checked.site_id
    from public.widget_sessions as session
    cross join lateral public.check_widget_session(session.id, session.site_key_id, session.origin, 'exact-a.example.test') as checked
  $$,
  $$values ('allowed', 'a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000101'::uuid)$$,
  'a live session is accepted'
);
select is(pg_temp.session_outcome('b0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'denied', 'a session does not work with another key');
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://wild-a.example.test', 'wild-a.example.test'), 'denied', 'a session does not move to another allowed origin');
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-b.example.test'), 'denied', 'a session does not move to another host');
select is(
  (select outcome from public.check_widget_session('99999999-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test')),
  'denied', 'an unknown session is denied'
);

-- Revocation takes effect at once
set local role postgres;
update public.domains set verification_method = null where hostname = 'exact-a.example.test';
set local role service_role;
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'denied', 'removing the verification ends its sessions');
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test'), 'denied', 'and new ones');
set local role postgres;
update public.domains set verification_method = 'dns_txt' where hostname = 'exact-a.example.test';
update public.sites set is_active = false where id = 'a0000000-0000-4000-8000-000000000101';
set local role service_role;
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'denied', 'deactivating the site ends its sessions');
set local role postgres;
update public.sites set is_active = true where id = 'a0000000-0000-4000-8000-000000000101';
set local role service_role;
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'allowed', 'the session is live again when both are restored');
set local role postgres;
update public.site_keys set revoked_at = now() where id = 'a0000000-0000-4000-8000-000000000301';
set local role service_role;
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'denied', 'revoking the key ends its sessions');
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test'), 'denied', 'a revoked key opens nothing');
set local role postgres;
update public.site_keys set revoked_at = null where id = 'a0000000-0000-4000-8000-000000000301';
set local role service_role;
update public.widget_sessions set revoked_at = now() where bootstrap_id = 'f0000000-0000-4000-8000-000000000001';
select is(pg_temp.session_outcome('a0000000-0000-4000-8000-000000000301', 'https://exact-a.example.test', 'exact-a.example.test'), 'denied', 'a revoked session is denied');

-- Expiry
set local role postgres;
insert into public.widget_sessions (organization_id, site_id, site_key_id, bootstrap_id, origin, created_at, expires_at)
values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'f0000000-0000-4000-8000-000000000009', 'https://exact-a.example.test', now() - interval '31 minutes', now() - interval '1 minute');
update public.domains set created_at = now() - interval '2 days', expires_at = now() - interval '1 second' where hostname = 'preview-a.example.test';
set local role service_role;
select is(
  (select checked.outcome from public.widget_sessions as session
   cross join lateral public.check_widget_session(session.id, session.site_key_id, session.origin, 'exact-a.example.test') as checked
   where session.bootstrap_id = 'f0000000-0000-4000-8000-000000000009'),
  'denied', 'an expired session is denied'
);
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000002', 'preview-a.example.test'), 'denied', 'an expired preview host is denied');
set local role postgres;
update public.domains set expires_at = now() + interval '1 day' where hostname = 'preview-a.example.test';
update public.site_keys set created_at = now() - interval '2 days', expires_at = now() - interval '1 second' where id = 'a0000000-0000-4000-8000-000000000302';
set local role service_role;
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000002', 'preview-a.example.test'), 'denied', 'an expired key is denied');

-- Rate limits ----------------------------------------------------------------

select is(
  pg_temp.bootstrap_many('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', repeat('1', 64), 61),
  'allowed:60,rate_limited:1',
  'the 61st bootstrap of one client on one site is refused'
);
select ok(
  (select retry_after between 1 and 60 from public.widget_bootstrap('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', repeat('1', 64))),
  'the refusal says how long to wait'
);
set local role postgres;
create temp table site_budget as
  select used from private.widget_rate_counters
  where bucket = 'bootstrap:site:a0000000-0000-4000-8000-000000000101';
set local role service_role;
select is(
  pg_temp.bootstrap_many('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', repeat('1', 64), 20),
  'rate_limited:20', 'a limited client stays limited'
);
set local role postgres;
select results_eq(
  $$select used from private.widget_rate_counters where bucket = 'bootstrap:site:a0000000-0000-4000-8000-000000000101'$$,
  $$select used from site_budget$$,
  'and does not spend the budget of the site'
);
set local role service_role;
select is(
  pg_temp.bootstrap_many('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', repeat('2', 64), 1),
  'allowed:1', 'another client is not affected'
);
select is(
  pg_temp.bootstrap_many('cael_pk_b0000000000000000000000000000001', 'exact-b.example.test', repeat('1', 64), 1),
  'allowed:1', 'the same client on another site is not affected'
);
select is(
  pg_temp.bootstrap_many('cael_pk_00000000000000000000000000000000', 'exact-a.example.test', repeat('3', 64), 241),
  'denied:240,rate_limited:1',
  'guessing keys runs into the limit of the client'
);
select is(
  (select string_agg(outcome || ':' || times, ',' order by outcome) from (
    select called.outcome, count(*) as times
    from generate_series(1, 31) as attempt
    cross join lateral public.create_widget_session(
      'b0000000-0000-4000-8000-000000000301', 'exact-b.example.test', 'https://exact-b.example.test',
      ('f0000000-0000-4000-9000-' || lpad(attempt::text, 12, '0'))::uuid, repeat('4', 64), 1800
    ) as called
    group by 1) as totals),
  'allowed:30,rate_limited:1',
  'the 31st session of one client in ten minutes is refused'
);
select throws_ok(
  $$select public.widget_bootstrap('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test', '203.0.113.7')$$,
  '22023', 'invalid_client_hash', 'a raw address is refused as a client hash'
);
set local role postgres;
update private.widget_rate_counters set used = 6000
where bucket = 'bootstrap:site:a0000000-0000-4000-8000-000000000101';
set local role service_role;
select is(pg_temp.bootstrap_outcome('cael_pk_a0000000000000000000000000000001', 'exact-a.example.test'), 'rate_limited', 'the site budget has a ceiling without a client hash too');
select is(pg_temp.bootstrap_outcome('cael_pk_b0000000000000000000000000000001', 'exact-b.example.test'), 'allowed', 'one exhausted site does not close another');

-- Reading sessions ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select is((select count(*) from public.widget_sessions), 2::bigint, 'owner reads the sessions of the tenant only');
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","session_id":"a3333333-0000-4000-8000-000000000003"}';
select is((select count(*) from public.widget_sessions), 2::bigint, 'admin reads the sessions of the tenant only');
set local request.jwt.claims = '{"sub":"a4444444-4444-4444-8444-444444444444","session_id":"a4444444-0000-4000-8000-000000000004"}';
select is_empty($$select id from public.widget_sessions$$, 'editor reads no session');
set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select is_empty($$select id from public.widget_sessions$$, 'sales reads no session');
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select is_empty($$select id from public.widget_sessions$$, 'viewer reads no session');
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select is(
  (select count(*) filter (where organization_id <> 'b0000000-0000-4000-8000-000000000001') || ':' || count(*) from public.widget_sessions),
  '0:30', 'Tenant B owner reads its own sessions and no Tenant A session'
);
select throws_ok($$update public.widget_sessions set revoked_at = null$$, '42501', null, 'an owner cannot revive a session');
set local role anon;
select throws_ok($$select * from public.widget_sessions$$, '42501', null, 'anon cannot read sessions');

-- Retention ------------------------------------------------------------------

set local role postgres;
insert into public.widget_sessions (organization_id, site_id, site_key_id, bootstrap_id, origin, created_at, expires_at)
values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'f0000000-0000-4000-8000-000000000010', 'https://exact-a.example.test', now() - interval '40 days', now() - interval '40 days' + interval '30 minutes');
insert into private.widget_rate_counters (bucket, window_start, expires_at, used)
values ('bootstrap:client:old', now() - interval '1 day', now() - interval '23 hours', 1);
set local role service_role;
select results_eq(
  $$select removed_sessions, removed_counters from public.purge_widget_runtime()$$,
  $$values (1::bigint, 1::bigint)$$,
  'retention removes only finished rows'
);

select * from finish();
rollback;
