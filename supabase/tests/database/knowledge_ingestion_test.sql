begin;
select plan(34);

select has_table('public', 'knowledge_sources', 'knowledge_sources exists');
select has_table('public', 'knowledge_versions', 'knowledge_versions exists');
select has_table('public', 'documents', 'documents exists');
select has_table('public', 'chunks', 'chunks exists');
select has_table('public', 'ingestion_jobs', 'ingestion_jobs exists');

select is(
  (
    select array_agg(relname order by relname)
    from pg_class
    where oid in (
      'public.knowledge_sources'::regclass,
      'public.knowledge_versions'::regclass,
      'public.documents'::regclass,
      'public.chunks'::regclass,
      'public.ingestion_jobs'::regclass
    ) and relrowsecurity
  ),
  array['chunks', 'documents', 'ingestion_jobs', 'knowledge_sources', 'knowledge_versions']::name[],
  'RLS is enabled on every knowledge table'
);
select has_index('public', 'knowledge_sources', 'knowledge_sources_site_status_idx', 'source status lookup is indexed');
select has_index('public', 'ingestion_jobs', 'ingestion_jobs_claim_idx', 'worker claim lookup is indexed');
select has_index('public', 'documents', 'documents_retention_idx', 'raw-file retention lookup is indexed');
select ok(
  not has_any_column_privilege('anon', 'public.knowledge_sources', 'select,insert,update')
  and not has_table_privilege('anon', 'public.knowledge_sources', 'delete'),
  'anon has no source privileges'
);
select ok(
  not has_any_column_privilege('anon', 'public.chunks', 'select,insert,update')
  and not has_table_privilege('anon', 'public.chunks', 'delete'),
  'anon has no chunk privileges'
);
select ok(has_table_privilege('authenticated', 'public.knowledge_sources', 'select,insert,update,delete'), 'authenticated source DML is policy scoped');
select ok(
  has_table_privilege('authenticated', 'public.documents', 'select')
  and not has_any_column_privilege('authenticated', 'public.documents', 'insert,update')
  and not has_table_privilege('authenticated', 'public.documents', 'delete'),
  'authenticated users cannot mutate extracted documents'
);
select ok(
  has_function_privilege('service_role', 'public.claim_ingestion_job(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_ingestion_job(integer)', 'execute'),
  'only the worker role can claim jobs'
);
select ok(
  has_function_privilege('service_role', 'public.claim_expired_knowledge_files(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_expired_knowledge_files(integer)', 'execute'),
  'only the worker role can claim expired raw files'
);
select ok(
  (select not public from storage.buckets where id = 'knowledge-sources'),
  'knowledge bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'knowledge-sources'),
  26214400::bigint,
  'knowledge bucket enforces the 25 MiB limit'
);

create temp table p1_job as
select * from public.ingestion_jobs with no data;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';

select is(
  (select is_duplicate from public.enqueue_knowledge_source(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'manual', 'Pricing FAQ', repeat('a', 64), repeat('b', 64), null,
    'Email sales@example.test' || chr(10) || 'Price 100 TL', 3::smallint
  )),
  false,
  'first source call creates a job'
);
select is(
  (select is_duplicate from public.enqueue_knowledge_source(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'manual', 'Pricing FAQ duplicate', repeat('a', 64), repeat('b', 64), null,
    'Email sales@example.test' || chr(10) || 'Price 100 TL', 3::smallint
  )),
  true,
  'the exact same source is idempotent'
);
select is((select count(*) from public.knowledge_sources where source_key = repeat('a', 64)), 1::bigint, 'duplicate source row is not created');
select is((select count(*) from public.ingestion_jobs where idempotency_key is not null), 1::bigint, 'duplicate job is not created');

set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002","email":"member-a@example.test"}';
select throws_ok(
  $$select * from public.enqueue_knowledge_source(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'manual', 'Viewer attempt', repeat('c', 64), repeat('d', 64), null, 'text', 3::smallint
  )$$,
  '42501', 'permission denied', 'a viewer cannot enqueue a source'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001","email":"owner-b@example.test"}';
select is_empty($$select id from public.knowledge_sources where source_key = repeat('a', 64)$$, 'Tenant B cannot read Tenant A sources');
select throws_ok(
  $$select * from public.enqueue_knowledge_source(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'manual', 'Cross tenant', repeat('c', 64), repeat('d', 64), null, 'text', 3::smallint
  )$$,
  '42501', 'permission denied', 'Tenant B cannot enqueue into Tenant A'
);

set local role service_role;
select is((select count(*) from public.claim_ingestion_job(120)), 1::bigint, 'worker claims one queued message');
select is((select status from public.ingestion_jobs limit 1), 'processing', 'claim marks the job processing');
select is((select attempt_count from public.ingestion_jobs limit 1), 1::smallint, 'claim increments attempt count');
select is(
  public.fail_ingestion_job(
    (select id from public.ingestion_jobs limit 1),
    (select queue_message_id from public.ingestion_jobs limit 1),
    'UPSTREAM_TIMEOUT', true, 0
  ),
  'pending',
  'retryable failure safely requeues the job'
);
select is((select count(*) from public.claim_ingestion_job(120)), 1::bigint, 'retried message can be claimed again');
select is(
  public.fail_ingestion_job(
    (select id from public.ingestion_jobs limit 1),
    (select queue_message_id from public.ingestion_jobs limit 1),
    'CORRUPT_DOCUMENT', false, 0
  ),
  'failed',
  'non-retryable failure becomes failed'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select ok(public.retry_ingestion_job((select id from public.ingestion_jobs limit 1)) > 0, 'owner safely retries a failed job');
select results_eq(
  $$select status, attempt_count from public.ingestion_jobs limit 1$$,
  $$values ('pending'::text, 0::smallint)$$,
  'manual retry resets the failed job without creating a duplicate'
);

set local role postgres;
update public.ingestion_jobs set attempt_count = max_attempts;
set local role service_role;
select is((select count(*) from public.claim_ingestion_job(120)), 0::bigint, 'a poison message is archived instead of delivered');
select results_eq(
  $$select status, last_error_code from public.ingestion_jobs limit 1$$,
  $$values ('failed'::text, 'POISON_MESSAGE'::text)$$,
  'poison message leaves a visible failed status'
);

select * from finish();
rollback;
