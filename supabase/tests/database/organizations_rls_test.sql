begin;
select plan(8);

set local role anon;
select throws_ok(
  $$select * from public.organizations$$,
  '42501',
  null,
  'anon cannot read organizations'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$select public_name from public.organizations order by public_name$$,
  array['Tenant A'],
  'Tenant A owner reads only Tenant A organization'
);

set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select results_eq(
  $$select public_name from public.organizations$$,
  array['Tenant A'],
  'Tenant A member reads their organization'
);

set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$select id from public.organizations$$,
  'a signed-in non-member reads no organizations'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    update public.organizations
    set public_name = 'Tenant A Updated'
    where id = 'a0000000-0000-4000-8000-000000000001'
    returning public_name
  $$,
  array['Tenant A Updated'],
  'Tenant A owner really updates Tenant A with RETURNING'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$
    update public.organizations
    set public_name = 'Stolen'
    where id = 'a0000000-0000-4000-8000-000000000001'
    returning id
  $$,
  'Tenant B owner updates no Tenant A organization rows'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    select public_name
    from public.organizations
    where id = 'a0000000-0000-4000-8000-000000000001'
  $$,
  array['Tenant A Updated'],
  'the denied cross-tenant update left Tenant A intact'
);

set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select is_empty(
  $$
    update public.organizations
    set public_name = 'Member Edit'
    where id = 'a0000000-0000-4000-8000-000000000001'
    returning id
  $$,
  'a regular member cannot update organization settings'
);

select * from finish();
rollback;
