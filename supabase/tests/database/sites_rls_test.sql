begin;
select plan(9);

set local role anon;
select throws_ok(
  $$select * from public.sites$$,
  '42501',
  null,
  'anon cannot read sites'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select results_eq(
  $$select public_name from public.sites$$,
  array['Tenant A Main'],
  'Tenant A member reads only Tenant A sites'
);
select throws_ok(
  $$
    insert into public.sites (
      id, organization_id, name, public_name, widget_title
    ) values (
      'a0000000-0000-4000-8000-000000000102',
      'a0000000-0000-4000-8000-000000000001',
      'Member Site', 'Member Site', 'Member widget'
    )
  $$,
  '42501',
  null,
  'a regular member cannot create a site'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    update public.sites
    set widget_title = 'Tenant A widget updated'
    where id = 'a0000000-0000-4000-8000-000000000101'
    returning widget_title
  $$,
  array['Tenant A widget updated'],
  'Tenant A owner really updates a Tenant A site with RETURNING'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$
    update public.sites
    set widget_title = 'Stolen'
    where id = 'a0000000-0000-4000-8000-000000000101'
    returning id
  $$,
  'Tenant B owner updates no Tenant A site rows'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    select widget_title
    from public.sites
    where id = 'a0000000-0000-4000-8000-000000000101'
  $$,
  array['Tenant A widget updated'],
  'the denied cross-tenant site update left Tenant A intact'
);
select throws_ok(
  $$
    update public.sites
    set organization_id = 'b0000000-0000-4000-8000-000000000001'
    where id = 'a0000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  null,
  'Tenant A owner cannot change a site tenant key to Tenant B'
);
select results_eq(
  $$
    insert into public.sites (
      id, organization_id, name, public_name, widget_title
    ) values (
      'a0000000-0000-4000-8000-000000000102',
      'a0000000-0000-4000-8000-000000000001',
      'Second Site', 'Second Site', 'Second widget'
    )
    returning public_name
  $$,
  array['Second Site'],
  'Tenant A owner really creates a same-tenant site'
);

set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$select id from public.sites$$,
  'a signed-in non-member reads no sites'
);

select * from finish();
rollback;
