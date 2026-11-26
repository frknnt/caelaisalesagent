insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'owner-a@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant A Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a2222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant A Viewer"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'owner-b@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant B Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c1111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"No Tenant User"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a3333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'admin-a@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant A Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a4444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'editor-a@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant A Editor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a5555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'sales-a@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tenant A Sales"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e1111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'switcher@example.test',
    extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Multi Tenant Viewer"}',
    now(),
    now()
  )
on conflict (id) do nothing;

-- GoTrue scans legacy token columns as strings during password login.
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@example.test';

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select user_row.id::text, user_row.id, jsonb_build_object('sub', user_row.id::text, 'email', user_row.email), 'email', now(), now(), now()
from auth.users as user_row
where user_row.email like '%@example.test'
on conflict (provider_id, provider) do nothing;

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after, refreshed_at)
values
  ('a1111111-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a2222222-0000-4000-8000-000000000002', 'a2222222-2222-4222-8222-222222222222', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a3333333-0000-4000-8000-000000000003', 'a3333333-3333-4333-8333-333333333333', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a4444444-0000-4000-8000-000000000004', 'a4444444-4444-4444-8444-444444444444', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a5555555-0000-4000-8000-000000000005', 'a5555555-5555-4555-8555-555555555555', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('b1111111-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('c1111111-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now())
  ,('e1111111-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now())
on conflict (id) do nothing;

insert into public.organizations (id, name, public_name, slug)
values
  ('a0000000-0000-4000-8000-000000000001', 'Tenant A Internal', 'Tenant A', 'tenant-a'),
  ('b0000000-0000-4000-8000-000000000001', 'Tenant B Internal', 'Tenant B', 'tenant-b')
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role)
values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'owner'),
  ('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'viewer'),
  ('a0000000-0000-4000-8000-000000000001', 'a3333333-3333-4333-8333-333333333333', 'admin'),
  ('a0000000-0000-4000-8000-000000000001', 'a4444444-4444-4444-8444-444444444444', 'editor'),
  ('a0000000-0000-4000-8000-000000000001', 'a5555555-5555-4555-8555-555555555555', 'sales'),
  ('a0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'viewer'),
  ('b0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'viewer'),
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'owner')
on conflict (organization_id, user_id) do nothing;

insert into public.sites (
  id,
  organization_id,
  name,
  public_name,
  widget_title,
  default_locale,
  is_active
)
values
  (
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000001',
    'Tenant A Main',
    'Tenant A Main',
    'Tenant A satış asistanı',
    'tr-TR',
    true
  ),
  (
    'b0000000-0000-4000-8000-000000000101',
    'b0000000-0000-4000-8000-000000000001',
    'Tenant B Main',
    'Tenant B Main',
    'Tenant B sales assistant',
    'en-US',
    true
  )
on conflict (id) do nothing;

insert into public.domains (
  id,
  organization_id,
  site_id,
  hostname,
  is_primary,
  verified_at,
  verification_method
)
values
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'tenant-a.example.test',
    true,
    '2026-11-20 00:00:00+00',
    'operator'
  ),
  (
    'b0000000-0000-4000-8000-000000000201',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000101',
    'tenant-b.example.test',
    true,
    '2026-11-20 00:00:00+00',
    'operator'
  )
on conflict (id) do nothing;
