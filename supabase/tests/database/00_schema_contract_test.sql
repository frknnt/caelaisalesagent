begin;
select plan(20);

select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'memberships', 'memberships exists');
select has_table('public', 'sites', 'sites exists');
select has_table('public', 'domains', 'domains exists');

select is(
  (
    select array_agg(relname order by relname)
    from pg_class
    where oid in (
      'public.organizations'::regclass,
      'public.profiles'::regclass,
      'public.memberships'::regclass,
      'public.sites'::regclass,
      'public.domains'::regclass
    )
      and relrowsecurity
  ),
  array[
    'domains'::name,
    'memberships'::name,
    'organizations'::name,
    'profiles'::name,
    'sites'::name
  ],
  'RLS is enabled on every exposed table'
);

select has_index(
  'public',
  'memberships',
  'memberships_user_id_idx',
  'membership user lookup is indexed'
);
select has_index(
  'public',
  'memberships',
  'memberships_organization_role_idx',
  'membership role lookup is indexed'
);
select has_index(
  'public',
  'domains',
  'domains_organization_site_idx',
  'domain tenant foreign key is indexed'
);
select has_index(
  'public',
  'sites',
  'sites_organization_name_key',
  'site organization lookup is indexed'
);

select ok(
  not has_table_privilege('anon', 'public.organizations', 'select'),
  'anon has no organizations select grant'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon has no profiles select grant'
);
select ok(
  not has_table_privilege('anon', 'public.memberships', 'select'),
  'anon has no memberships select grant'
);
select ok(
  not has_table_privilege('anon', 'public.sites', 'select'),
  'anon has no sites select grant'
);
select ok(
  not has_table_privilege('anon', 'public.domains', 'select'),
  'anon has no domains select grant'
);

select ok(
  has_table_privilege('authenticated', 'public.organizations', 'select,update'),
  'authenticated has the intended organization grants'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'insert,delete,truncate'),
  'authenticated has no organization create, delete, or truncate grant'
);
select ok(
  has_table_privilege('authenticated', 'public.sites', 'select,insert,update,delete'),
  'authenticated has only policy-scoped site DML grants'
);
select ok(
  not has_table_privilege('authenticated', 'public.sites', 'truncate,references,trigger'),
  'authenticated has no broad site grants'
);
-- P0.5 removed the anon bootstrap RPC. Anon now has no function at all.
select is_empty(
  $$
    select routine.oid::regprocedure::text
    from pg_proc as routine
    where routine.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', routine.oid, 'execute')
  $$,
  'anon can execute no public function'
);

select * from finish();
rollback;
