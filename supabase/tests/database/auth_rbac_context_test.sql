begin;
select plan(13);

select results_eq(
  $$select distinct role from public.memberships order by role$$,
  $$values ('admin'), ('editor'), ('owner'), ('sales'), ('viewer')$$,
  'seed covers all five organization roles'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select is(
  (select role from public.create_organization_invitation('a0000000-0000-4000-8000-000000000001', 'rpc-invite@example.test', 'viewer', now() + interval '7 days')),
  'viewer', 'owner creates a least-privilege invitation through RPC'
);

set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","session_id":"a3333333-0000-4000-8000-000000000003","email":"admin-a@example.test"}';
select throws_ok(
  $$select public.create_organization_invitation('a0000000-0000-4000-8000-000000000001', 'admin-target@example.test', 'admin', now() + interval '7 days')$$,
  '42501', 'permission_denied', 'admin cannot create another admin'
);

set local role postgres;
insert into public.organization_invitations (id, organization_id, email, role, invited_by, expires_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'outsider@example.test', 'sales', 'a1111111-1111-4111-8111-111111111111', now() + interval '7 days'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'revoked@example.test', 'viewer', 'a1111111-1111-4111-8111-111111111111', now() + interval '7 days'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'expired@example.test', 'viewer', 'a1111111-1111-4111-8111-111111111111', now() + interval '1 minute');
update public.organization_invitations set revoked_at = now() where id = 'd0000000-0000-4000-8000-000000000002';
update public.organization_invitations
set created_at = now() - interval '2 seconds', expires_at = now() - interval '1 second'
where id = 'd0000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001","email":"wrong@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('d0000000-0000-4000-8000-000000000001')$$,
  '42501', 'invitation_invalid', 'a different email cannot accept the invitation'
);

set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001","email":"outsider@example.test"}';
select is(
  (select role from public.accept_organization_invitation('d0000000-0000-4000-8000-000000000001')),
  'sales', 'the invited account accepts the intended role'
);
select throws_ok(
  $$select public.accept_organization_invitation('d0000000-0000-4000-8000-000000000001')$$,
  '42501', 'invitation_invalid', 'an accepted invitation cannot be replayed'
);
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001","email":"revoked@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('d0000000-0000-4000-8000-000000000002')$$,
  '42501', 'invitation_invalid', 'a revoked invitation is rejected'
);
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001","email":"expired@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('d0000000-0000-4000-8000-000000000003')$$,
  '42501', 'invitation_invalid', 'an expired invitation is rejected'
);
select is((select count(*) from public.get_authorization_context()), 1::bigint, 'accepted membership appears in live tenant context');
select results_eq($$select public_name from public.organizations$$, array['Tenant A'], 'an active session can read its tenant');

set local role postgres;
update auth.sessions set not_after = now() - interval '1 second' where id = 'c1111111-0000-4000-8000-000000000001';
set local role authenticated;
select is_empty($$select id from public.organizations$$, 'an expired session loses RLS access immediately');

set local role postgres;
update auth.sessions set not_after = now() + interval '1 day' where id = 'c1111111-0000-4000-8000-000000000001';
delete from auth.sessions where id = 'c1111111-0000-4000-8000-000000000001';
set local role authenticated;
select is_empty($$select id from public.organizations$$, 'a revoked session loses RLS access immediately');
select is((select count(*) from public.get_authorization_context()), 0::bigint, 'revoked session returns no tenant context');

select * from finish();
rollback;
