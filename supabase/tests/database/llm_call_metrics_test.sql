begin;
select plan(29);

-- Contract -------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.llm_call_metrics'::regclass),
  'RLS is enabled on llm_call_metrics'
);
select has_index('public', 'llm_call_metrics', 'llm_call_metrics_organization_occurred_idx', 'tenant timeline is indexed');
select has_index('public', 'llm_call_metrics', 'llm_call_metrics_organization_site_idx', 'site foreign key is indexed');
select ok(
  not has_table_privilege('anon', 'public.llm_call_metrics', 'select,insert,update,delete,truncate,references,trigger'),
  'anon has no metric grant'
);
select ok(
  has_table_privilege('authenticated', 'public.llm_call_metrics', 'select')
  and not has_any_column_privilege('authenticated', 'public.llm_call_metrics', 'insert,update')
  and not has_table_privilege('authenticated', 'public.llm_call_metrics', 'delete,truncate,references,trigger'),
  'authenticated may only select through RLS'
);
select ok(
  not has_any_column_privilege('service_role', 'public.llm_call_metrics', 'update')
  and not has_table_privilege('service_role', 'public.llm_call_metrics', 'delete,truncate')
  and not has_column_privilege('service_role', 'public.llm_call_metrics', 'occurred_at', 'insert'),
  'service_role can only append, with the database clock'
);
select is_empty(
  $$
    select column_name::text from information_schema.columns
    where table_schema = 'public' and table_name = 'llm_call_metrics'
      and column_name::text ~ '(message|prompt|content|text|email|phone|name)$'
  $$,
  'no column can hold message content or personal data'
);

-- Writes -----------------------------------------------------------------------

set local role service_role;
select lives_ok(
  $$
    insert into public.llm_call_metrics (
      id, organization_id, site_id, request_id, trace_id, provider, model, purpose, outcome,
      input_tokens, output_tokens, cached_input_tokens, latency_ms, cost_micros, pricing_version, is_simulated
    ) values
      ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101',
       'f0000000-0000-4000-8000-000000000001', '0af7651916cd43dd8448eb211c80319c', 'fake', 'fake-model-1', 'agent_reply', 'completed',
       120, 40, 20, 830, 302, 'fake-2026-11', true),
      ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null,
       'f0000000-0000-4000-8000-000000000002', '0af7651916cd43dd8448eb211c80319c', 'fake', 'fake-model-1', 'agent_reply', 'timeout',
       null, null, null, 1000, null, null, true)
  $$,
  'service_role records a priced call and a call with unknown usage'
);
select throws_ok(
  $$
    insert into public.llm_call_metrics (
      id, organization_id, request_id, trace_id, provider, model, purpose, outcome, latency_ms, is_simulated
    ) values (
      'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000001', '0af7651916cd43dd8448eb211c80319c', 'fake', 'fake-model-1', 'agent_reply', 'timeout', 1, true
    )
  $$,
  '23505', null, 'writing the same call twice does not count it twice'
);
select throws_ok(
  $$
    insert into public.llm_call_metrics (
      id, organization_id, site_id, request_id, trace_id, provider, model, purpose, outcome, latency_ms, is_simulated
    ) values (
      'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101',
      'f0000000-0000-4000-8000-000000000001', '0af7651916cd43dd8448eb211c80319c', 'fake', 'fake-model-1', 'agent_reply', 'timeout', 1, true
    )
  $$,
  '23503', null, 'a metric cannot point at another tenant''s site'
);
select throws_ok($$update public.llm_call_metrics set cost_micros = 0$$, '42501', null, 'service_role cannot rewrite a cost');
select throws_ok($$delete from public.llm_call_metrics$$, '42501', null, 'service_role cannot delete a metric');

-- Constraints ---------------------------------------------------------------------

set local role postgres;
create function pg_temp.try_metric(p_overrides jsonb) returns text
language plpgsql as $$
declare
  metric public.llm_call_metrics;
begin
  metric := jsonb_populate_record(
    null::public.llm_call_metrics,
    jsonb_build_object(
      'id', gen_random_uuid(),
      'organization_id', 'a0000000-0000-4000-8000-000000000001',
      'request_id', 'f0000000-0000-4000-8000-000000000001',
      'trace_id', '0af7651916cd43dd8448eb211c80319c',
      'provider', 'fake', 'model', 'fake-model-1', 'purpose', 'agent_reply',
      'attempt', 1, 'outcome', 'completed',
      'input_tokens', 10, 'output_tokens', 5, 'cached_input_tokens', 0,
      'latency_ms', 100, 'cost_micros', 35, 'currency', 'USD',
      'pricing_version', 'fake-2026-11', 'is_simulated', true, 'occurred_at', now()
    ) || p_overrides
  );
  insert into public.llm_call_metrics select (metric).*;
  return 'accepted';
exception when check_violation or not_null_violation then
  return 'rejected';
end;
$$;

select is(pg_temp.try_metric('{}'), 'accepted', 'the baseline metric is valid');
select is(pg_temp.try_metric('{"cost_micros":null,"pricing_version":null}'), 'accepted', 'an unpriced model keeps an unknown cost');
select is(pg_temp.try_metric('{"outcome":"refusal"}'), 'accepted', 'a refusal can still carry usage');
select is(pg_temp.try_metric('{"cost_micros":35,"pricing_version":null}'), 'rejected', 'a cost needs a price version');
select is(pg_temp.try_metric('{"cost_micros":null}'), 'rejected', 'a price version needs a cost');
select is(pg_temp.try_metric('{"input_tokens":null,"output_tokens":null,"cached_input_tokens":null,"outcome":"timeout"}'), 'rejected', 'a cost needs token counts');
select is(pg_temp.try_metric('{"output_tokens":null}'), 'rejected', 'token counts are all known or all unknown');
select is(pg_temp.try_metric('{"input_tokens":null,"output_tokens":null,"cached_input_tokens":null,"cost_micros":null,"pricing_version":null}'), 'rejected', 'a completed call has token counts');
select is(pg_temp.try_metric('{"cached_input_tokens":11}'), 'rejected', 'cached input cannot exceed input');
select is(pg_temp.try_metric('{"latency_ms":-1}'), 'rejected', 'latency is not negative');
select is(pg_temp.try_metric('{"outcome":"unknown"}'), 'rejected', 'outcomes are a closed set');
select is(pg_temp.try_metric('{"purpose":"reply to visitor@example.test"}'), 'rejected', 'purpose is a code, not text');

-- Read isolation ---------------------------------------------------------------------

set local role anon;
select throws_ok($$select id from public.llm_call_metrics$$, '42501', null, 'anon cannot read metrics');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$select distinct organization_id from public.llm_call_metrics$$,
  array['a0000000-0000-4000-8000-000000000001'::uuid],
  'Tenant A owner reads only Tenant A metrics'
);
select throws_ok(
  $$
    insert into public.llm_call_metrics (id, organization_id, request_id, trace_id, provider, model, purpose, outcome, latency_ms, is_simulated)
    values ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
      '0af7651916cd43dd8448eb211c80319c', 'fake', 'fake-model-1', 'agent_reply', 'timeout', 1, false)
  $$,
  '42501', null, 'owner cannot forge a metric'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001"}';
select results_eq(
  $$select id from public.llm_call_metrics$$,
  array['c0000000-0000-4000-8000-000000000002'::uuid],
  'Tenant B owner reads only Tenant B metrics'
);

set local request.jwt.claims = '{"sub":"a5555555-5555-4555-8555-555555555555","session_id":"a5555555-0000-4000-8000-000000000005"}';
select is_empty($$select id from public.llm_call_metrics$$, 'sales reads no cost metrics');

select * from finish();
rollback;
