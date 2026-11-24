begin;
select plan(8);

set local role anon;
select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anon cannot read profiles'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select results_eq(
  $$select display_name from public.profiles order by display_name$$,
  $$ values ('Multi Tenant Viewer'), ('Tenant A Admin'), ('Tenant A Editor'), ('Tenant A Owner'), ('Tenant A Sales'), ('Tenant A Viewer') $$,
  'Tenant A member sees only profiles sharing Tenant A'
);
select is_empty(
  $$
    select id
    from public.profiles
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'Tenant A member cannot read Tenant B profile'
);

select results_eq(
  $$
    update public.profiles
    set display_name = 'Tenant A Viewer Updated'
    where id = 'a2222222-2222-4222-8222-222222222222'
    returning display_name
  $$,
  array['Tenant A Viewer Updated'],
  'a user really updates their own profile with RETURNING'
);
select is_empty(
  $$
    update public.profiles
    set display_name = 'Stolen'
    where id = 'a1111111-1111-4111-8111-111111111111'
    returning id
  $$,
  'a member cannot update another profile in the same tenant'
);
select results_eq(
  $$
    select display_name
    from public.profiles
    where id = 'a1111111-1111-4111-8111-111111111111'
  $$,
  array['Tenant A Owner'],
  'the denied profile update left the owner profile intact'
);

set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$select display_name from public.profiles$$,
  array['No Tenant User'],
  'a non-member can still read only their own profile'
);
select throws_ok(
  $$
    insert into public.profiles (id, display_name)
    values ('d1111111-1111-4111-8111-111111111111', 'Injected')
  $$,
  '42501',
  null,
  'authenticated clients cannot create arbitrary profiles'
);

select * from finish();
rollback;
