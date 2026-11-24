begin;
select plan(22);

set local role anon;
select throws_ok(
  $$select * from public.domains$$,
  '42501',
  null,
  'anon cannot read domains'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select results_eq(
  $$select hostname from public.domains$$,
  array['tenant-a.example.test'],
  'Tenant A member reads only Tenant A domains'
);
select throws_ok(
  $$
    insert into public.domains (
      organization_id, site_id, hostname
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'member.tenant-a.example.test'
    )
  $$,
  '42501',
  null,
  'a regular member cannot create a domain'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    update public.domains
    set is_primary = true
    where id = 'a0000000-0000-4000-8000-000000000201'
    returning hostname
  $$,
  array['tenant-a.example.test'],
  'Tenant A owner really updates a Tenant A domain with RETURNING'
);

-- P0.5: no role may open the domain lock from a client.
select throws_ok(
  $$update public.domains set verified_at = now() where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot write verified_at'
);
select throws_ok(
  $$update public.domains set verification_method = 'operator' where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot write the verification method'
);
select throws_ok(
  $$update public.domains set allow_subdomains = true where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot open a wildcard'
);
select throws_ok(
  $$update public.domains set hostname = 'other.example.test' where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot rename a verified domain'
);
select throws_ok(
  $$update public.domains set environment = 'preview' where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot change the environment'
);
select throws_ok(
  $$update public.domains set verification_token = repeat('0', 32) where id = 'a0000000-0000-4000-8000-000000000201'$$,
  '42501', null, 'an owner cannot choose the verification token'
);
select throws_ok(
  $$
    insert into public.domains (organization_id, site_id, hostname, verified_at, verification_method)
    values (
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101',
      'self-verified.example.test', now(), 'operator'
    )
  $$,
  '42501', null, 'an owner cannot create an already verified domain'
);
select throws_ok(
  $$
    insert into public.domains (organization_id, site_id, hostname, environment, expires_at)
    values (
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101',
      'preview.example.test', 'preview', now() + interval '1 day'
    )
  $$,
  '42501', null, 'a preview domain cannot be inserted around its function'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$
    update public.domains
    set is_primary = false
    where id = 'a0000000-0000-4000-8000-000000000201'
    returning id
  $$,
  'Tenant B owner updates no Tenant A domain rows'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    select hostname
    from public.domains
    where id = 'a0000000-0000-4000-8000-000000000201'
  $$,
  array['tenant-a.example.test'],
  'the denied cross-tenant domain update left Tenant A intact'
);
select throws_ok(
  $$
    update public.domains
    set organization_id = 'b0000000-0000-4000-8000-000000000001',
        site_id = 'b0000000-0000-4000-8000-000000000101'
    where id = 'a0000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  null,
  'Tenant A owner cannot change domain tenant keys to Tenant B'
);
select results_eq(
  $$
    insert into public.domains (
      id, organization_id, site_id, hostname
    ) values (
      'a0000000-0000-4000-8000-000000000202',
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'www.tenant-a.example.test'
    )
    returning hostname
  $$,
  array['www.tenant-a.example.test'],
  'Tenant A owner really creates a same-tenant domain'
);

select results_eq(
  $$
    select verified_at is null and verification_method is null
      and not allow_subdomains and environment = 'production' and expires_at is null
      and verification_token ~ '^[0-9a-f]{32}$'
    from public.domains where id = 'a0000000-0000-4000-8000-000000000202'
  $$,
  array[true],
  'a domain created by a client starts closed with its own challenge'
);

set local request.jwt.claims = '{"sub":"a4444444-4444-4444-8444-444444444444","session_id":"a4444444-0000-4000-8000-000000000004"}';
select results_eq(
  $$
    insert into public.domains (organization_id, site_id, hostname)
    values (
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101',
      'editor.tenant-a.example.test'
    )
    returning verified_at
  $$,
  array[null::timestamptz],
  'an editor can claim a domain but not verify it'
);
set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select throws_ok(
  $$
    insert into public.domains (organization_id, site_id, hostname)
    values (
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101',
      'sales.tenant-a.example.test'
    )
  $$,
  '42501', null, 'sales cannot claim a domain'
);

-- Another tenant may claim the same name: refusing would tell it that the name
-- is a customer. Only one of them can ever be verified.
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$
    insert into public.domains (organization_id, site_id, hostname)
    values (
      'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101',
      'tenant-a.example.test'
    )
    returning verified_at
  $$,
  array[null::timestamptz],
  'an unproven claim does not reveal that the name is taken'
);
set local role postgres;
update public.domains set verified_at = now(), verification_method = 'dns_txt'
where id = 'a0000000-0000-4000-8000-000000000201';
select throws_ok(
  $$
    update public.domains set verified_at = now(), verification_method = 'dns_txt'
    where organization_id = 'b0000000-0000-4000-8000-000000000001'
      and hostname = 'tenant-a.example.test'
  $$,
  '23505', null, 'a verified name belongs to one site only'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111","session_id":"c1111111-0000-4000-8000-000000000001"}';
select is_empty(
  $$select id from public.domains$$,
  'a signed-in non-member reads no domains'
);

select * from finish();
rollback;
