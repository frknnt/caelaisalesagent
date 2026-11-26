begin;
select plan(51);

-- Own rows, so the result is the same on a fresh and on an upgraded database.
insert into public.site_keys (id, organization_id, site_id, public_key, environment, expires_at)
values
  ('a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'cael_pk_a0000000000000000000000000000401', 'production', null),
  ('b0000000-0000-4000-8000-000000000401', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'cael_pk_b0000000000000000000000000000401', 'production', null);
insert into public.widget_sessions (id, organization_id, site_id, site_key_id, bootstrap_id, origin, expires_at)
values
  ('a0000000-0000-4000-8000-000000000411', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000411', 'https://a.example.test', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000412', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000412', 'https://a.example.test', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000413', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000413', 'https://a.example.test', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000414', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000414', 'https://a.example.test', now() + interval '30 minutes'),
  ('b0000000-0000-4000-8000-000000000411', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000415', 'https://b.example.test', now() + interval '30 minutes');
insert into public.widget_sessions (id, organization_id, site_id, site_key_id, bootstrap_id, origin, created_at, expires_at)
values
  ('a0000000-0000-4000-8000-000000000419', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000419', 'https://a.example.test', now() - interval '2 hours', now() - interval '90 minutes');

-- Contract -------------------------------------------------------------------

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.visitor_identities'::regclass, 'public.visitor_consents'::regclass,
    'public.visitor_sessions'::regclass, 'public.conversations'::regclass,
    'public.messages'::regclass)),
  'RLS is enabled on every P1.4 table'
);
select has_index('public', 'messages', 'messages_conversation_created_idx', 'messages are indexed by conversation');
select has_index('public', 'conversations', 'conversations_visitor_idx', 'conversations are indexed by visitor');
select ok(
  not has_table_privilege('anon', 'public.messages', 'select')
  and not has_table_privilege('anon', 'public.conversations', 'select')
  and not has_table_privilege('anon', 'public.visitor_identities', 'select'),
  'anon reads no conversation table'
);
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.conversations', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.visitor_consents', 'insert,update,delete'),
  'authenticated writes no conversation table'
);
select ok(
  not has_table_privilege('authenticated', 'public.visitor_identities', 'select'),
  'members never read the visitor secret hash'
);
select ok(
  not has_function_privilege('anon', 'public.widget_post_message(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.widget_post_message(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.widget_attach_visitor(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.widget_complete_reply(uuid, text, text, jsonb, boolean, text)', 'execute'),
  'only the service role runs the widget conversation functions'
);
select ok(
  has_function_privilege('service_role', 'public.widget_post_message(uuid, uuid, text)', 'execute'),
  'the service role runs them'
);
select ok(
  has_table_privilege('service_role', 'public.visitor_identities', 'delete')
  and not has_table_privilege('authenticated', 'public.visitor_identities', 'delete'),
  'only the server can erase a visitor'
);

set local role service_role;

-- Anonymous identity ------------------------------------------------------------

select is(
  (select outcome || ':' || resumed from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000411', null, repeat('a', 43))),
  'allowed:false',
  'a first visit creates an anonymous visitor'
);
select is(
  (select count(*)::integer from public.visitor_identities where secret_hash = repeat('a', 43)),
  1,
  'only the hash of the secret is stored'
);
select is(
  (select visitor_id from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000411', repeat('z', 43), repeat('y', 43))),
  (select id from public.visitor_identities where secret_hash = repeat('a', 43)),
  'a session binds to its visitor once, whatever later calls carry'
);
select is(
  (select outcome || ':' || resumed from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000412', repeat('a', 43), repeat('b', 43))),
  'allowed:true',
  'a refresh within two hours resumes the visitor'
);
select is(
  (select outcome from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000419', null, repeat('c', 43))),
  'denied',
  'an expired technical session cannot attach'
);
select throws_ok(
  $$ select * from public.widget_attach_visitor('a0000000-0000-4000-8000-000000000413', null, 'short') $$,
  '22023', 'invalid_secret_hash', 'a malformed secret hash is rejected'
);
select is(
  (select resumed from public.widget_attach_visitor(
    'b0000000-0000-4000-8000-000000000411', repeat('a', 43), repeat('d', 43))),
  false,
  'a secret of another site never resumes a visitor'
);

-- Messages, idempotency and limits ----------------------------------------------

select is(
  (select outcome || ':' || reply_status from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000001', 'Kargo ne zaman gelir?')),
  'claimed:pending',
  'a new message is stored and its reply claimed'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000001', 'Kargo ne zaman gelir?')),
  'in_progress',
  'the same message while the reply runs is not claimed twice'
);
select ok(
  public.widget_complete_reply(
    (select id from public.messages where role = 'assistant' and reply_to = (
      select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001')),
    'completed', 'Iki is gunu.', '[{"sourceId":"s1","title":"Kargo"}]', false, 'agent-core-2026-11-26.1'),
  'the claimed reply completes'
);
select ok(
  not public.widget_complete_reply(
    (select id from public.messages where role = 'assistant' and reply_to = (
      select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001')),
    'completed', 'Ikinci cevap', '[]', false, null),
  'a late second worker cannot overwrite the reply'
);
select is(
  (select outcome || ':' || reply_body from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000412', 'c0000000-0000-4000-8000-000000000001', 'Kargo ne zaman gelir?')),
  'duplicate:Iki is gunu.',
  'a resend after a refresh returns the stored reply'
);
select is(
  (select count(*)::integer from public.messages where conversation_id = (
    select conversation_id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001')),
  2,
  'the resends added no message and no second reply'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000002', 'kargo ne zaman gelir? ')),
  'spam',
  'the same text under a new id within 30 seconds is a repeat'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000003', '   ')),
  'invalid',
  'an empty message is refused'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000004', repeat('x', 1001))),
  'invalid',
  'a message over 1000 characters is refused'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000413', 'c0000000-0000-4000-8000-000000000005', 'Merhaba')),
  'denied',
  'a session without a visitor cannot post'
);

-- Failed reply is claimed again; abandoned too.
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000006', 'Iade sureci nedir?')),
  'claimed',
  'a second question is claimed'
);
select ok(
  public.widget_complete_reply(
    (select id from public.messages where reply_to = (
      select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000006')),
    'failed', null, null, null, null),
  'a reply can end as failed'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000006', 'Iade sureci nedir?')),
  'claimed',
  'retrying a failed reply claims it again'
);
select is(
  (select attempts from public.messages where reply_to = (
    select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000006')),
  2::smallint,
  'the retry is counted'
);
reset role;
update public.messages set claimed_at = now() - interval '2 minutes'
where reply_to = (select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000006');
set local role service_role;
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000006', 'Iade sureci nedir?')),
  'claimed',
  'an abandoned reply is claimed again'
);
reset role;
update public.messages set attempts = 5, status = 'failed'
where reply_to = (select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000006');
set local role service_role;
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000411', 'c0000000-0000-4000-8000-000000000006', 'Iade sureci nedir?')),
  'failed',
  'retries stop after five attempts'
);

select is(
  (select string_agg(called.outcome, ',') from generate_series(1, 13) as attempt
   cross join lateral public.widget_post_message(
     'a0000000-0000-4000-8000-000000000412',
     ('d0000000-0000-4000-8000-' || lpad(attempt::text, 12, '0'))::uuid,
     'soru ' || attempt) as called
   where called.outcome = 'rate_limited'),
  'rate_limited',
  'more than 12 messages a minute in one session are rate limited'
);

reset role;
update public.conversations set visitor_message_count = 100
where id = (select conversation_id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001');
set local role service_role;
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000414', 'c0000000-0000-4000-8000-000000000007', 'Yeni soru')),
  'denied',
  'an unbound session is still refused before any limit'
);
select is(
  (select outcome || ':' || resumed from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000414', repeat('a', 43), repeat('e', 43))),
  'allowed:true',
  'a second tab of the same visitor attaches'
);
select is(
  (select outcome from public.widget_post_message(
    'a0000000-0000-4000-8000-000000000414', 'c0000000-0000-4000-8000-000000000007', 'Yeni soru')),
  'limit_reached',
  'a conversation stops at 100 visitor messages'
);
reset role;
update public.conversations set visitor_message_count = 2
where id = (select conversation_id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001');
set local role service_role;

-- History, summary, feedback -----------------------------------------------------

select is(
  (select string_agg(role, ',' order by created_at, role desc) from public.widget_conversation(
    'a0000000-0000-4000-8000-000000000412', 4)),
  'visitor,assistant,visitor,assistant',
  'the newest messages come back oldest first, each reply after its question'
);
select ok(
  public.widget_update_summary(
    (select conversation_id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001'),
    'Ziyaretci kargoyu sordu.', now()),
  'a summary is stored'
);
select ok(
  not public.widget_update_summary(
    (select conversation_id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001'),
    'Eski ozet', now() - interval '1 hour'),
  'a summary never moves back in time'
);
select is(
  (select distinct summary from public.widget_conversation('a0000000-0000-4000-8000-000000000412', 2)),
  'Ziyaretci kargoyu sordu.',
  'the summary comes back with the history'
);
select ok(
  public.widget_set_feedback(
    'a0000000-0000-4000-8000-000000000412',
    (select id from public.messages where reply_to = (
      select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001')),
    1::smallint),
  'the visitor rates their own reply'
);
select ok(
  not public.widget_set_feedback(
    'b0000000-0000-4000-8000-000000000411',
    (select id from public.messages where reply_to = (
      select id from public.messages where client_message_id = 'c0000000-0000-4000-8000-000000000001')),
    -1::smallint),
  'another visitor cannot rate it'
);

-- Consent-aware memory -----------------------------------------------------------

reset role;
update public.visitor_identities set last_seen_at = now() - interval '3 hours'
where secret_hash = repeat('a', 43);
set local role service_role;
reset role;
insert into public.widget_sessions (id, organization_id, site_id, site_key_id, bootstrap_id, origin, expires_at)
values
  ('a0000000-0000-4000-8000-000000000415', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000416', 'https://a.example.test', now() + interval '30 minutes'),
  ('a0000000-0000-4000-8000-000000000416', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000417', 'https://a.example.test', now() + interval '30 minutes');
set local role service_role;
select is(
  (select resumed from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000415', repeat('a', 43), repeat('f', 43))),
  false,
  'without consent a visit after two hours starts with no memory'
);
select ok(
  public.widget_set_memory_consent('a0000000-0000-4000-8000-000000000412', true, 'memory-2026-11-26'),
  'the visitor grants memory'
);
select is(
  (select purpose || ':' || granted || ':' || text_version || ':' || source
   from public.visitor_consents order by recorded_at desc limit 1),
  'conversation_memory:true:memory-2026-11-26:widget',
  'purpose, text version and source are recorded'
);
reset role;
update public.visitor_identities set last_seen_at = now() - interval '3 days'
where secret_hash = repeat('a', 43);
set local role service_role;
select is(
  (select resumed::text || ':' || (conversation_id is not null)::text from public.widget_attach_visitor(
    'a0000000-0000-4000-8000-000000000416', repeat('a', 43), repeat('g', 43))),
  'true:true',
  'with consent a returning visitor gets the conversation back'
);
select ok(
  public.widget_set_memory_consent('a0000000-0000-4000-8000-000000000416', false, 'memory-2026-11-26'),
  'the visitor withdraws memory'
);
select ok(
  (select memory_consent_at is null from public.visitor_identities where secret_hash = repeat('a', 43))
  and (select count(*) = 2 from public.visitor_consents where visitor_id = (
    select id from public.visitor_identities where secret_hash = repeat('a', 43))),
  'withdrawing consent clears it and keeps the history'
);

-- Members read their own tenant only ------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select ok(
  (select count(*) from public.messages) >= 4
  and (select count(*) from public.conversations) >= 1,
  'a member reads the conversations of their organization'
);
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001","email":"owner-b@example.test"}';
select is(
  (select count(*)::integer from public.messages where organization_id = 'a0000000-0000-4000-8000-000000000001'),
  0,
  'another organization reads none of them'
);
select throws_ok(
  $$ insert into public.messages (organization_id, conversation_id, role, client_message_id, body)
     select organization_id, id, 'visitor', gen_random_uuid(), 'x' from public.conversations limit 1 $$,
  '42501', null, 'a member cannot write a message directly'
);

select * from finish();
rollback;
