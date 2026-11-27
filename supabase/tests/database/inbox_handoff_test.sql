begin;
select plan(36);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'a5555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated',
  'sales-a@example.test', extensions.crypt('CaelTest!2026', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"display_name":"Tenant A Sales"}', now(), now()
) on conflict (id) do nothing;
insert into public.memberships (organization_id, user_id, role)
values ('a0000000-0000-4000-8000-000000000001', 'a5555555-5555-4555-8555-555555555555', 'sales')
on conflict (organization_id, user_id) do update set role = excluded.role;

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after, refreshed_at)
values
  ('a1111111-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a2222222-0000-4000-8000-000000000002', 'a2222222-2222-4222-8222-222222222222', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a5555555-0000-4000-8000-000000000005', 'a5555555-5555-4555-8555-555555555555', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('b1111111-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now())
on conflict (id) do update set not_after = excluded.not_after, user_id = excluded.user_id;

-- Isolated P1.5 fixtures; valid on zero and upgraded databases.
insert into public.site_keys (id, organization_id, site_id, public_key, environment)
values ('a0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000101', 'cael_pk_a0000000000000000000000000000501', 'production');
insert into public.widget_sessions (id, organization_id, site_id, site_key_id, bootstrap_id, origin, expires_at)
values
  ('a0000000-0000-4000-8000-000000000511', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000501', 'f0000000-0000-4000-8000-000000000511', 'https://a.example.test', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000512', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000501', 'f0000000-0000-4000-8000-000000000512', 'https://a.example.test', now() + interval '30 minutes');
insert into public.visitor_identities (id, organization_id, site_id, secret_hash)
values
  ('a0000000-0000-4000-8000-000000000521', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', repeat('h', 43)),
  ('a0000000-0000-4000-8000-000000000522', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', repeat('i', 43));
insert into public.visitor_sessions (organization_id, site_id, widget_session_id, visitor_id, resumed)
values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000511', 'a0000000-0000-4000-8000-000000000521', false),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000512', 'a0000000-0000-4000-8000-000000000522', false);
insert into public.conversations (id, organization_id, site_id, visitor_id, visitor_message_count, lead_context)
values
  ('a0000000-0000-4000-8000-000000000531', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000521', 1, '{"intent":"demo","score":80}'),
  ('a0000000-0000-4000-8000-000000000532', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000522', 1, '{}');
insert into public.messages (id, organization_id, conversation_id, role, sender_type, client_message_id, body)
values
  ('a0000000-0000-4000-8000-000000000541', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000531', 'visitor', 'visitor', 'a0000000-0000-4000-8000-000000000551', 'Bir temsilciyle gorusebilir miyim?'),
  ('a0000000-0000-4000-8000-000000000542', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000532', 'visitor', 'visitor', 'a0000000-0000-4000-8000-000000000552', 'Riskli bir konu var');
insert into public.messages (id, organization_id, conversation_id, role, sender_type, reply_to, status, attempts, claimed_at)
values ('a0000000-0000-4000-8000-000000000543', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000531', 'assistant', 'bot', 'a0000000-0000-4000-8000-000000000541', 'pending', 1, now());

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.conversation_reads'::regclass, 'public.conversation_notes'::regclass,
  'public.conversation_tool_events'::regclass, 'public.inbox_notification_outbox'::regclass
)), 'RLS is enabled on every P1.5 table');
select ok(not has_table_privilege('anon', 'public.conversation_notes', 'select')
  and not has_table_privilege('anon', 'public.conversation_reads', 'select'), 'anon reads no inbox data');
select ok(not has_table_privilege('authenticated', 'public.conversation_notes', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.conversation_reads', 'insert,update,delete'), 'browser roles cannot mutate inbox tables directly');
select ok(not has_function_privilege('authenticated', 'public.inbox_request_agent_handoff(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.inbox_request_agent_handoff(uuid)', 'execute'), 'agent handoff is server-only');
select ok(not has_function_privilege('authenticated', 'public.inbox_set_lead_context(uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.inbox_set_lead_context(uuid, jsonb)', 'execute'), 'lead context write port is server-only');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select throws_ok($$select public.inbox_takeover('a0000000-0000-4000-8000-000000000531', 0, 'sales_requested', 15)$$,
  '42501', 'permission_denied', 'viewer cannot take over');
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select throws_ok($$select public.inbox_takeover('a0000000-0000-4000-8000-000000000531', 0, 'sales_requested', 15)$$,
  '42501', 'permission_denied', 'another tenant cannot take over');

set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select is((select handoff_state || ':' || assignment_version from public.inbox_takeover(
  'a0000000-0000-4000-8000-000000000531', 0, 'sales_requested', 15)), 'human:1', 'sales takes over atomically');
select is((select assigned_to from public.conversations where id = 'a0000000-0000-4000-8000-000000000531'),
  'a5555555-5555-4555-8555-555555555555'::uuid, 'conversation is assigned to the representative');
select is((select status from public.messages where id = 'a0000000-0000-4000-8000-000000000543'), 'failed', 'takeover cancels pending bot reply');
set local role service_role;
select ok(not public.widget_complete_reply('a0000000-0000-4000-8000-000000000543', 'completed', 'late bot', '[]', false, null), 'late bot worker cannot publish');
set local role postgres;
select is((select count(*) from public.audit_events where entity_id = 'a0000000-0000-4000-8000-000000000531' and action = 'conversation.takeover'), 1::bigint, 'takeover has an append-only audit event');
select is((select count(distinct template) from public.inbox_notification_outbox where conversation_id = 'a0000000-0000-4000-8000-000000000531'), 2::bigint, 'handoff and SLA e-mails are queued for the sales team');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select throws_ok($$select public.inbox_takeover('a0000000-0000-4000-8000-000000000531', 0, 'high_intent', 15)$$,
  '40001', 'assignment_conflict', 'a second representative loses the stale-version race');
set local role service_role;
select is((select outcome from public.widget_post_message('a0000000-0000-4000-8000-000000000511', 'a0000000-0000-4000-8000-000000000553', 'Devralma sonrasi mesaj')), 'human_active', 'visitor message is stored without a bot claim during takeover');
select is((select count(*) from public.messages where conversation_id = 'a0000000-0000-4000-8000-000000000531' and sender_type = 'bot' and reply_to = (select id from public.messages where client_message_id = 'a0000000-0000-4000-8000-000000000553')), 0::bigint, 'no second bot answer exists after handoff');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select throws_ok($$select public.inbox_send_reply('a0000000-0000-4000-8000-000000000531', 'Owner reply')$$,
  '42501', 'permission_denied', 'an unassigned representative cannot reply');
set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select is((select sender_type from public.inbox_send_reply('a0000000-0000-4000-8000-000000000531', 'Merhaba, ben satis ekibindenim.')), 'human', 'assigned representative replies');
select ok((select first_human_response_at is not null from public.conversations where id = 'a0000000-0000-4000-8000-000000000531'), 'first human response stops SLA');
select is((select body from public.inbox_add_note('a0000000-0000-4000-8000-000000000531', 'Butceyi teyit et.')), 'Butceyi teyit et.', 'internal note is stored');
select lives_ok($$select public.inbox_mark_read('a0000000-0000-4000-8000-000000000531')$$, 'representative marks conversation read');
select ok((select read_cursor.last_read_at >= conversation.last_message_at
  from public.conversation_reads as read_cursor
  join public.conversations as conversation
    on conversation.organization_id = read_cursor.organization_id
   and conversation.id = read_cursor.conversation_id
  where read_cursor.conversation_id = 'a0000000-0000-4000-8000-000000000531'
    and read_cursor.user_id = 'a5555555-5555-4555-8555-555555555555'), 'read cursor covers the latest message');

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select is((select handoff_state || ':' || assignment_version from public.inbox_release_to_bot('a0000000-0000-4000-8000-000000000531', 1)), 'bot:2', 'owner can return an assigned conversation to the bot');
set local role service_role;
select is((select outcome from public.widget_post_message('a0000000-0000-4000-8000-000000000511', 'a0000000-0000-4000-8000-000000000554', 'Bot tekrar cevap verebilir')), 'claimed', 'bot resumes only after explicit release');

select ok(public.inbox_request_agent_handoff('a0000000-0000-4000-8000-000000000532'), 'agent requests handoff');
select is((select handoff_state || ':' || coalesce(assigned_to::text, 'unassigned') from public.conversations where id = 'a0000000-0000-4000-8000-000000000532'), 'human:unassigned', 'agent handoff enters the unassigned fallback queue');
select is((select handoff_reason from public.conversations where id = 'a0000000-0000-4000-8000-000000000532'), 'agent_requested', 'agent handoff reason is retained');
select is((select count(*) from public.audit_events where entity_id = 'a0000000-0000-4000-8000-000000000532' and action = 'conversation.handoff_requested'), 1::bigint, 'agent handoff is audited');
select ok(public.inbox_record_tool_event('a0000000-0000-4000-8000-000000000532', null, 'search_knowledge', 'success', '{"citation_count":2}'), 'tool history is recorded server-side');
select ok(public.inbox_set_lead_context('a0000000-0000-4000-8000-000000000532', '{"intent":"risk_review","score":91}'), 'validated lead context is attached server-side');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002"}';
select is_empty($$select id from public.conversation_notes$$, 'viewer cannot read internal notes');
set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select is((select count(*) from public.conversation_tool_events where conversation_id = 'a0000000-0000-4000-8000-000000000532'), 1::bigint, 'sales sees tool history in tenant');

set local role service_role;
select ok((select count(*) > 0 from public.claim_inbox_notifications(100)), 'due handoff e-mails can be claimed');
select ok(public.complete_inbox_notification((select id from public.inbox_notification_outbox where claimed_at is not null limit 1), true, null), 'notification delivery is completed idempotently');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select is((select status from public.inbox_close_conversation('a0000000-0000-4000-8000-000000000531', 2)), 'closed', 'conversation closes with current version');
select throws_ok($$select public.inbox_close_conversation('a0000000-0000-4000-8000-000000000531', 2)$$,
  '40001', 'assignment_conflict', 'stale close cannot overwrite a newer state');

select * from finish();
rollback;
