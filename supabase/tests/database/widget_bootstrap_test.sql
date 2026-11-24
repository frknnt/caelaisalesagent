begin;
select plan(8);

-- P0.2 let anon ask for any hostname. P0.5 closed that surface.
select hasnt_function('public', 'get_widget_bootstrap', array['text'], 'the anon bootstrap RPC is gone');
select hasnt_function('private', 'lookup_widget_bootstrap', array['text'], 'its lookup is gone as well');

set local role anon;
select throws_ok(
  $$select * from public.widget_bootstrap('cael_pk_00000000000000000000000000000000', 'tenant-a.example.test', null)$$,
  '42501',
  null,
  'anon cannot call the server-only bootstrap'
);
select throws_ok(
  $$select * from public.organizations$$,
  '42501',
  null,
  'anon cannot read organizations'
);
select throws_ok(
  $$select * from public.memberships$$,
  '42501',
  null,
  'anon cannot read memberships'
);
select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anon cannot read profiles'
);
select throws_ok(
  $$select * from public.sites$$,
  '42501',
  null,
  'anon cannot enumerate sites'
);
select throws_ok(
  $$select * from public.domains$$,
  '42501',
  null,
  'anon cannot enumerate domains'
);

select * from finish();
rollback;
