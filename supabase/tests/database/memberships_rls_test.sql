begin;
select plan(11);

set local role anon;
select throws_ok($$select * from public.memberships$$, '42501', null, 'anon cannot read memberships');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002","email":"member-a@example.test"}';
select is((select count(*) from public.memberships), 6::bigint, 'viewer reads only Tenant A memberships');
select is_empty($$select user_id from public.memberships where organization_id = 'b0000000-0000-4000-8000-000000000001'$$, 'viewer cannot read Tenant B memberships');
select throws_ok($$select public.create_organization_invitation('a0000000-0000-4000-8000-000000000001', 'new@example.test', 'viewer', now() + interval '7 days')$$, '42501', 'permission_denied', 'viewer cannot create invitations');
select throws_ok($$insert into public.memberships (organization_id, user_id, role) values ('a0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'viewer')$$, '42501', null, 'authenticated clients cannot directly insert memberships');

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select is((select role from public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'editor')), 'editor', 'owner changes another member role through RPC');
select throws_ok($$select public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'viewer')$$, '42501', 'self_role_change_forbidden', 'owner cannot change their own role');

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001","email":"owner-b@example.test"}';
select throws_ok($$select public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'viewer')$$, '42501', 'permission_denied', 'Tenant B owner cannot change Tenant A membership');

set local role postgres;
insert into public.memberships (organization_id, user_id, role) values ('a0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'owner');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select is((select role from public.change_organization_member_role('a0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'admin')), 'admin', 'owner can demote a second owner when another owner remains');
select lives_ok($$select public.remove_organization_member('a0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111')$$, 'owner removes another member through RPC');
select is_empty($$select user_id from public.memberships where user_id = 'c1111111-1111-4111-8111-111111111111'$$, 'removed membership is no longer visible');

select * from finish();
rollback;
