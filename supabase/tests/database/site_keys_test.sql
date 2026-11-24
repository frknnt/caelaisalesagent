begin;
select plan(47);

-- Contract -------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.site_keys'::regclass),
  'RLS is enabled on site_keys'
);
select has_index('public', 'site_keys', 'site_keys_organization_site_idx', 'site foreign key is indexed');
select has_index('public', 'site_keys', 'site_keys_created_by_idx', 'creator foreign key is indexed');
select ok(
  not has_any_column_privilege('anon', 'public.site_keys', 'select,insert,update'),
  'anon has no site key grant'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.site_keys', 'insert,update')
  and not has_table_privilege('authenticated', 'public.site_keys', 'delete,truncate,references,trigger'),
  'authenticated cannot write site keys directly'
);
select ok(
  not has_any_column_privilege('service_role', 'public.site_keys', 'insert,update')
  and not has_table_privilege('service_role', 'public.site_keys', 'delete,truncate'),
  'service_role cannot write site keys'
);
select is_empty(
  $$
    select routine.oid::regprocedure::text
    from pg_proc as routine
    where routine.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', routine.oid, 'execute')
      and routine.proname in (
        'widget_bootstrap', 'widget_frame', 'create_widget_session',
        'check_widget_session', 'purge_widget_runtime'
      )
  $$,
  'authenticated cannot call the server-only widget functions'
);
select is_empty(
  $$
    select routine.oid::regprocedure::text
    from pg_proc as routine
    cross join (values ('anon'), ('authenticated'), ('service_role')) as api (role_name)
    where routine.pronamespace = 'private'::regnamespace
      and routine.proname in (
        'consume_widget_rate_limit', 'is_widget_host_allowed', 'active_widget_site',
        'assert_client_hash', 'require_site_manager', 'audit_domain_change',
        'audit_site_key_change'
      )
      and has_function_privilege(api.role_name, routine.oid, 'execute')
  $$,
  'no API role can call the private widget functions'
);

-- Roles ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select ok(
  (select public_key ~ '^cael_pk_[0-9a-f]{32}$' and environment = 'production'
    and organization_id = 'a0000000-0000-4000-8000-000000000001'
    and created_by = 'a1111111-1111-4111-8111-111111111111'
   from public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')),
  'owner creates a production key'
);
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","session_id":"a3333333-0000-4000-8000-000000000003"}';
select lives_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'preview', now() + interval '7 days')$$,
  'admin creates a preview key'
);
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'preview')$$,
  '23514', null, 'a preview key must expire'
);
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'preview', now() + interval '31 days')$$,
  '23514', null, 'a preview key lasts 30 days at most'
);
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'staging')$$,
  '23514', null, 'an unknown environment is rejected'
);

-- editor, sales, viewer
set local request.jwt.claims = '{"sub":"a4444444-4444-4444-8444-444444444444","session_id":"a4444444-0000-4000-8000-000000000004"}';
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', 'permission_denied', 'editor cannot create a key'
);
select throws_ok(
  $$select public.revoke_site_key((select id from public.site_keys where environment = 'production'))$$,
  '42501', 'permission_denied', 'editor cannot revoke a key'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', 'preview-a.example.test', now() + interval '1 day')$$,
  '42501', 'permission_denied', 'editor cannot add a preview domain'
);
select is((select count(*) from public.site_keys), 2::bigint, 'editor reads the keys of the tenant');
set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', 'permission_denied', 'sales cannot create a key'
);
select is((select count(*) from public.site_keys), 2::bigint, 'sales reads the keys of the tenant');
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', 'permission_denied', 'viewer cannot create a key'
);
select throws_ok(
  $$select public.revoke_site_key((select id from public.site_keys where environment = 'production'))$$,
  '42501', 'permission_denied', 'viewer cannot revoke a key'
);
select is((select count(*) from public.site_keys), 2::bigint, 'viewer reads the keys of the tenant');
select throws_ok(
  $$insert into public.site_keys (organization_id, site_id, environment) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', null, 'viewer cannot insert a key'
);
select throws_ok(
  $$update public.site_keys set revoked_at = null$$,
  '42501', null, 'viewer cannot restore a key'
);

-- other tenant, outsider, dead session, anon
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.site_keys$$, 'Tenant B owner reads no Tenant A key');
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', 'permission_denied', 'Tenant B owner cannot create a key for a Tenant A site'
);
select throws_ok(
  $$select public.create_site_key('99999999-0000-4000-8000-000000000101', 'production')$$,
  '42501', 'permission_denied', 'a missing site fails exactly like a foreign one'
);
select throws_ok(
  $$select public.revoke_site_key('99999999-0000-4000-8000-000000000101')$$,
  '42501', 'permission_denied', 'a missing key fails exactly like a foreign one'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', 'preview-a.example.test', now() + interval '1 day')$$,
  '42501', 'permission_denied', 'Tenant B owner cannot add a preview domain to a Tenant A site'
);
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.site_keys$$, 'a signed-in non-member reads no key');
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"99999999-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.site_keys$$, 'an owner without a live session reads no key');
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '28000', 'authentication_required', 'an owner without a live session creates no key'
);
set local role anon;
set local request.jwt.claims = '{}';
select throws_ok($$select * from public.site_keys$$, '42501', null, 'anon cannot read keys');
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '42501', null, 'anon cannot create a key'
);

-- Limit and revocation --------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select lives_ok(
  $$
    select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')
    from generate_series(1, 4)
  $$,
  'a site may hold five active production keys'
);
select throws_ok(
  $$select public.create_site_key('a0000000-0000-4000-8000-000000000101', 'production')$$,
  '54000', 'too_many_active_keys', 'a sixth active key is refused'
);
select lives_ok(
  $$select public.revoke_site_key((select id from public.site_keys where environment = 'preview'))$$,
  'owner revokes a key'
);
select ok(
  (select revoked_at is not null from public.site_keys where environment = 'preview'),
  'the revoked key is marked'
);

-- Preview domains -------------------------------------------------------------

select ok(
  (select environment = 'preview' and verification_method is null and not allow_subdomains
   from public.add_preview_domain(
     'a0000000-0000-4000-8000-000000000101', ' Preview-A.Example.Test ', now() + interval '3 days'
   )),
  'owner adds an exact, unverified, expiring preview domain'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', 'preview-b.example.test', now() + interval '31 days')$$,
  '23514', null, 'a preview domain lasts 30 days at most'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', 'preview-b.example.test', null)$$,
  '23514', null, 'a preview domain must expire'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', '*.example.test', now() + interval '1 day')$$,
  '23514', null, 'a preview wildcard is rejected'
);
select throws_ok(
  $$select public.add_preview_domain('a0000000-0000-4000-8000-000000000101', '10.0.0.1', now() + interval '1 day')$$,
  '23514', null, 'an IP address is not a domain'
);

-- Audit -----------------------------------------------------------------------

select results_eq(
  $$
    select action, actor_user_id, count(*), bool_and(entity_id is not null)
    from public.audit_events
    where action in ('site_key.created', 'site_key.revoked', 'domain.added')
      and actor_type = 'user'
    group by 1, 2 order by 1, 2
  $$,
  $$
    values
      ('domain.added', 'a1111111-1111-4111-8111-111111111111'::uuid, 1::bigint, true),
      ('site_key.created', 'a1111111-1111-4111-8111-111111111111'::uuid, 5::bigint, true),
      ('site_key.created', 'a3333333-3333-4333-8333-333333333333'::uuid, 1::bigint, true),
      ('site_key.revoked', 'a1111111-1111-4111-8111-111111111111'::uuid, 1::bigint, true)
  $$,
  'key and domain changes are audited with the real actor'
);
select is_empty(
  $$select id from public.audit_events where metadata::text ~ '(cael_pk_|example)'$$,
  'the audit trail carries no key and no host name'
);
set local role postgres;
update public.domains set verified_at = now(), verification_method = 'dns_txt'
where id = 'a0000000-0000-4000-8000-000000000201';
update public.domains set allow_subdomains = true
where id = 'a0000000-0000-4000-8000-000000000201';
update public.domains set allow_subdomains = false, verification_method = null
where id = 'a0000000-0000-4000-8000-000000000201';
select results_eq(
  $$
    select distinct action from public.audit_events
    where entity_id = 'a0000000-0000-4000-8000-000000000201' and action <> 'domain.added'
    order by 1
  $$,
  array['domain.subdomains_changed', 'domain.verification_removed', 'domain.verified'],
  'server-side verification and wildcard changes are audited'
);
delete from public.domains where hostname = 'preview-a.example.test';
select is(
  (select count(*) from public.audit_events where action = 'domain.removed' and metadata ->> 'environment' = 'preview'),
  1::bigint,
  'removing a domain is audited'
);

select * from finish();
rollback;
