begin;
select plan(47);

-- Contract -------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'RLS is enabled on audit_events'
);
select has_index('public', 'audit_events', 'audit_events_organization_occurred_idx', 'tenant timeline is indexed');
select has_index('public', 'audit_events', 'audit_events_organization_site_idx', 'site foreign key is indexed');
select has_index('public', 'audit_events', 'audit_events_actor_user_idx', 'actor foreign key is indexed');

select ok(
  not has_table_privilege('anon', 'public.audit_events', 'select,insert,update,delete,truncate,references,trigger'),
  'anon has no audit grant'
);
select ok(
  has_table_privilege('authenticated', 'public.audit_events', 'select'),
  'authenticated may select through RLS'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.audit_events', 'insert,update')
  and not has_table_privilege('authenticated', 'public.audit_events', 'delete,truncate,references,trigger'),
  'authenticated has no audit write grant on any column'
);
select ok(
  has_column_privilege('service_role', 'public.audit_events', 'action', 'insert'),
  'service_role may insert audit rows'
);
select ok(
  not has_column_privilege('service_role', 'public.audit_events', 'occurred_at', 'insert')
  and not has_column_privilege('service_role', 'public.audit_events', 'id', 'insert'),
  'service_role cannot choose the id or the time of an audit row'
);
select ok(
  not has_any_column_privilege('service_role', 'public.audit_events', 'update')
  and not has_table_privilege('service_role', 'public.audit_events', 'delete,truncate'),
  'service_role cannot change or erase audit rows'
);
select ok(
  not has_function_privilege('anon', 'private.write_row_audit(uuid, text, text, uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.write_row_audit(uuid, text, text, uuid, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.write_row_audit(uuid, text, text, uuid, jsonb)', 'execute'),
  'no API role may call the trigger writer directly'
);
select ok(
  not has_function_privilege('authenticated', 'private.audit_membership_change()', 'execute')
  and not has_function_privilege('authenticated', 'private.audit_invitation_change()', 'execute'),
  'authenticated may not call the trigger functions'
);

-- Triggers record privileged changes with the verified actor ------------------

-- Own rows, so the result is the same on a fresh and on an upgraded database.
insert into public.memberships (organization_id, user_id, role)
values ('b0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'viewer');
select results_eq(
  $$
    select organization_id, actor_type, actor_user_id, outcome, metadata
    from public.audit_events
    where action = 'membership.created' and entity_id = 'c1111111-1111-4111-8111-111111111111'
  $$,
  $$
    values (
      'b0000000-0000-4000-8000-000000000001'::uuid, 'system', null::uuid, 'success',
      '{"role":"viewer"}'::jsonb
    )
  $$,
  'changes without a user session are recorded as system'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';

select lives_ok(
  $$select public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'editor')$$,
  'owner changes a role'
);
select results_eq(
  $$
    select actor_type, actor_user_id, entity_type, entity_id, outcome, metadata
    from public.audit_events where action = 'membership.role_changed'
  $$,
  $$
    values (
      'user', 'a1111111-1111-4111-8111-111111111111'::uuid, 'membership',
      'a2222222-2222-4222-8222-222222222222'::uuid, 'success',
      '{"previous_role":"viewer","role":"editor"}'::jsonb
    )
  $$,
  'the role change is audited once with the owner as actor'
);
select lives_ok(
  $$select public.create_organization_invitation('a0000000-0000-4000-8000-000000000001', 'audit-invite@example.test', 'viewer', now() + interval '7 days')$$,
  'owner creates an invitation'
);
select results_eq(
  $$select entity_type, metadata from public.audit_events where action = 'invitation.created'$$,
  $$values ('invitation', '{"role":"viewer"}'::jsonb)$$,
  'the invitation is audited without the invited address'
);
select is_empty(
  $$select id from public.audit_events where metadata::text like '%example.test%'$$,
  'no audit row carries an e-mail address'
);
select lives_ok(
  $$select public.revoke_organization_invitation((select id from public.organization_invitations where email = 'audit-invite@example.test'))$$,
  'owner revokes the invitation'
);
select is(
  (select count(*) from public.audit_events where action = 'invitation.revoked'),
  1::bigint,
  'the revocation is audited once'
);
select lives_ok(
  $$select public.remove_organization_member('a0000000-0000-4000-8000-000000000001', 'a5555555-5555-4555-8555-555555555555')$$,
  'owner removes a member'
);
select results_eq(
  $$select actor_user_id, metadata from public.audit_events where action = 'membership.removed'$$,
  $$values ('a1111111-1111-4111-8111-111111111111'::uuid, '{"role":"sales"}'::jsonb)$$,
  'the removal is audited with actor and former role'
);

-- A denied change leaves no success row.
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","session_id":"a3333333-0000-4000-8000-000000000003","email":"admin-a@example.test"}';
select throws_ok(
  $$select public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'viewer')$$,
  '42501', 'permission_denied', 'admin cannot demote the owner'
);
select is(
  (select count(*) from public.audit_events where action = 'membership.role_changed'),
  1::bigint,
  'the rejected change is not recorded as a success'
);

-- An accepted invitation is recorded for the person who accepted it.
set local role postgres;
insert into public.organization_invitations (id, organization_id, email, role, invited_by, expires_at)
values ('d0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'outsider@example.test', 'sales', 'a1111111-1111-4111-8111-111111111111', now() + interval '7 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001","email":"outsider@example.test"}';
select lives_ok(
  $$select public.accept_organization_invitation('d0000000-0000-4000-8000-0000000000a1')$$,
  'the invited user accepts'
);
set local role postgres;
select results_eq(
  $$select actor_user_id, entity_id from public.audit_events where action = 'invitation.accepted'$$,
  $$values ('c1111111-1111-4111-8111-111111111111'::uuid, 'd0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'acceptance is audited with the accepting user'
);

-- Read isolation ---------------------------------------------------------------

set local role anon;
select throws_ok($$select id from public.audit_events$$, '42501', null, 'anon cannot read audit rows');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","session_id":"a3333333-0000-4000-8000-000000000003"}';
select ok((select count(*) > 0 from public.audit_events), 'admin reads the audit trail');
select is_empty(
  $$select id from public.audit_events where organization_id <> 'a0000000-0000-4000-8000-000000000001'$$,
  'Tenant A admin sees no other tenant'
);

set local request.jwt.claims = '{"sub":"a4444444-4444-4444-8444-444444444444","session_id":"a4444444-0000-4000-8000-000000000004"}';
select is_empty($$select id from public.audit_events$$, 'editor reads no audit rows');
set local request.jwt.claims = '{"sub":"e1111111-1111-4111-8111-111111111111","session_id":"e1111111-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.audit_events$$, 'viewer of two tenants reads no audit rows');

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$select distinct organization_id from public.audit_events$$,
  array['b0000000-0000-4000-8000-000000000001'::uuid],
  'Tenant B owner reads only Tenant B'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-00000000ffff"}';
select is_empty($$select id from public.audit_events$$, 'an unknown session reads no audit rows');

-- Clients cannot forge, change or erase ------------------------------------------

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select throws_ok(
  $$
    insert into public.audit_events (organization_id, actor_type, action, entity_type, outcome)
    values ('a0000000-0000-4000-8000-000000000001', 'system', 'forged.event', 'organization', 'success')
  $$,
  '42501', null, 'owner cannot insert an audit row'
);
select throws_ok($$update public.audit_events set outcome = 'denied'$$, '42501', null, 'owner cannot update audit rows');
select throws_ok($$delete from public.audit_events$$, '42501', null, 'owner cannot delete audit rows');

set local role service_role;
select lives_ok(
  $$
    insert into public.audit_events (organization_id, site_id, actor_type, actor_user_id, action, entity_type, outcome, request_id, trace_id, metadata)
    values (
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'user',
      'a1111111-1111-4111-8111-111111111111', 'tenant.access_denied', 'organization', 'denied',
      'f0000000-0000-4000-8000-000000000001', '0af7651916cd43dd8448eb211c80319c', '{"source":"query","attempts":2,"blocked":true}'
    )
  $$,
  'service_role inserts a valid audit row'
);
select throws_ok($$update public.audit_events set outcome = 'success'$$, '42501', null, 'service_role cannot update audit rows');
select throws_ok($$delete from public.audit_events$$, '42501', null, 'service_role cannot delete audit rows');
select throws_ok(
  $$
    insert into public.audit_events (organization_id, actor_type, action, entity_type, outcome, occurred_at)
    values ('a0000000-0000-4000-8000-000000000001', 'system', 'backdated.event', 'organization', 'success', '2020-01-01')
  $$,
  '42501', null, 'service_role cannot backdate an audit row'
);
select throws_ok(
  $$
    insert into public.audit_events (organization_id, site_id, actor_type, action, entity_type, outcome)
    values ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'system', 'cross.tenant', 'site', 'success')
  $$,
  '23503', null, 'an audit row cannot point at another tenant''s site'
);
select throws_ok(
  $$delete from public.organizations where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'deleting a tenant cannot erase its audit trail'
);

-- Metadata is free of personal data ------------------------------------------------

set local role postgres;
select is_empty(
  $$
    select candidate from (values
      ('{}'::jsonb), ('{"role":"viewer"}'), ('{"attempts":3,"blocked":false,"previous":null}'),
      ('{"target":"a1111111-1111-4111-8111-111111111111"}'), ('{"code":"rate_limited:v1.2"}'),
      ('{"model":"model-5-20260901"}')
    ) as accepted (candidate)
    where not private.is_safe_audit_metadata(candidate)
  $$,
  'codes, counts, flags and identifiers are accepted'
);
select is_empty(
  $$
    select candidate from (values
      ('{"target":"visitor@example.test"}'::jsonb), ('{"target":"05325551234"}'),
      ('{"target":"+905325551234"}'), ('{"target":905325551234}'),
      ('{"reason":"Ayse asked for it"}'), ('{"target":""}'),
      ('{"target":"tel-0532-555-12-34"}'), ('{"target":"TR330006100519786457841326"}')
    ) as rejected (candidate)
    where private.is_safe_audit_metadata(candidate)
  $$,
  'addresses, phone numbers and prose are rejected'
);
select is_empty(
  $$
    select candidate from (values
      ('{"email":"x"}'::jsonb), ('{"visitor_email":"x"}'), ('{"phone":"x"}'), ('{"access_token":"x"}'),
      ('{"api_key":"x"}'), ('{"password":"x"}'), ('{"name":"x"}'), ('{"message":"x"}'), ('{"Bad Key":"x"}')
    ) as rejected (candidate)
    where private.is_safe_audit_metadata(candidate)
  $$,
  'personal, secret and malformed keys are rejected'
);
select is_empty(
  $$
    select candidate from (values
      ('[]'::jsonb), ('"text"'), ('1'), ('null'), ('{"nested":{"a":1}}'), ('{"list":["a"]}'),
      (jsonb_build_object('a', repeat('x', 65)))
    ) as rejected (candidate)
    where private.is_safe_audit_metadata(candidate) is not false
  $$,
  'non-objects, nested values and long strings are rejected'
);
select throws_ok(
  $$
    insert into public.audit_events (organization_id, actor_type, action, entity_type, outcome, metadata)
    values ('a0000000-0000-4000-8000-000000000001', 'system', 'unsafe.event', 'organization', 'success', '{"email":"visitor@example.test"}')
  $$,
  '23514', null, 'the table enforces safe metadata for every role'
);

select * from finish();
rollback;
