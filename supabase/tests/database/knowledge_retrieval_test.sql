begin;
select plan(32);

select ok(exists(select 1 from pg_extension where extname = 'vector'), 'pgvector is installed');
select has_column('public', 'knowledge_sources', 'publication_status', 'source lifecycle exists');
select has_column('public', 'knowledge_sources', 'fresh_until', 'source freshness exists');
select has_column('public', 'chunks', 'embedding', 'chunk embedding exists');
select has_column('public', 'chunks', 'search_vector', 'chunk FTS vector exists');
select has_column('public', 'documents', 'page_reference', 'citation page exists');
select has_index('public', 'chunks', 'chunks_search_vector_idx', 'FTS GIN index exists');
select has_index('public', 'chunks', 'chunks_embedding_hnsw_idx', 'semantic HNSW index exists');
select ok(
  has_function_privilege('authenticated', 'public.set_knowledge_source_lifecycle(uuid,text)', 'execute'),
  'authenticated can use the lifecycle RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.request_knowledge_reindex(uuid)', 'execute'),
  'authenticated can request scoped reindexing'
);
select ok(
  has_function_privilege('authenticated', 'public.retrieve_approved_knowledge(uuid,uuid,text,extensions.vector,integer,integer)', 'execute'),
  'authenticated can execute retrieval under RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.knowledge_sources', 'update'),
  'source lifecycle and freshness cannot be updated directly'
);
select ok(
  has_function_privilege('service_role', 'public.enqueue_due_knowledge_recrawls(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.enqueue_due_knowledge_recrawls(integer)', 'execute'),
  'only service role can schedule due recrawls'
);

set local role postgres;

-- Keep this test runnable against both a freshly seeded stack and the retained
-- local upgrade stack whose historical auth.sessions rows may have expired.
insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after, refreshed_at)
values
  ('a1111111-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('a2222222-0000-4000-8000-000000000002', 'a2222222-2222-4222-8222-222222222222', now(), now(), 'aal1', now() + interval '1 day', now()),
  ('b1111111-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', now(), now(), 'aal1', now() + interval '1 day', now())
on conflict (id) do update
set not_after = excluded.not_after,
    refreshed_at = excluded.refreshed_at,
    updated_at = excluded.updated_at;

insert into public.knowledge_sources (
  id, organization_id, site_id, source_type, name, source_key, canonical_url,
  status, progress, created_by, publication_status, approved_at, approved_by,
  freshness_checked_at, fresh_until, next_recrawl_at
) values
  ('c1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'url', 'Refund policy', repeat('1', 64), 'https://a.example.test/refunds', 'ready', 100, 'a1111111-1111-4111-8111-111111111111', 'approved', now(), 'a1111111-1111-4111-8111-111111111111', now(), now() + interval '1 day', now() + interval '1 day'),
  ('c1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'manual', 'Draft policy', repeat('2', 64), null, 'ready', 100, 'a1111111-1111-4111-8111-111111111111', 'draft', null, null, now(), now() + interval '1 day', null),
  ('c1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'manual', 'Disabled policy', repeat('3', 64), null, 'ready', 100, 'a1111111-1111-4111-8111-111111111111', 'disabled', null, null, now(), now() + interval '1 day', null),
  ('c1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'manual', 'Stale policy', repeat('4', 64), null, 'ready', 100, 'a1111111-1111-4111-8111-111111111111', 'approved', now() - interval '2 days', 'a1111111-1111-4111-8111-111111111111', now() - interval '2 days', now() - interval '1 day', null),
  ('c1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'manual', 'Tenant B policy', repeat('5', 64), null, 'ready', 100, 'b1111111-1111-4111-8111-111111111111', 'approved', now(), 'b1111111-1111-4111-8111-111111111111', now(), now() + interval '1 day', null),
  ('c1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'url', 'Due crawl', repeat('6', 64), 'https://a.example.test/due', 'ready', 100, 'a1111111-1111-4111-8111-111111111111', 'approved', now(), 'a1111111-1111-4111-8111-111111111111', now(), now() + interval '1 day', now() - interval '1 minute');

insert into public.knowledge_versions (
  id, organization_id, site_id, source_id, version_number, content_sha256,
  status, extracted_at, created_by
) values
  ('c2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000001', 1, repeat('a',64), 'ready', now(), 'a1111111-1111-4111-8111-111111111111'),
  ('c2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000002', 1, repeat('b',64), 'ready', now(), 'a1111111-1111-4111-8111-111111111111'),
  ('c2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000003', 1, repeat('c',64), 'ready', now(), 'a1111111-1111-4111-8111-111111111111'),
  ('c2000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000004', 1, repeat('d',64), 'ready', now(), 'a1111111-1111-4111-8111-111111111111'),
  ('c2000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000005', 1, repeat('e',64), 'ready', now(), 'b1111111-1111-4111-8111-111111111111'),
  ('c2000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000006', 1, repeat('f',64), 'ready', now(), 'a1111111-1111-4111-8111-111111111111');

update public.knowledge_sources as source
set current_version_id = version.id
from public.knowledge_versions as version
where version.source_id = source.id;

insert into public.documents (
  id, organization_id, site_id, source_id, version_id, title, canonical_url,
  page_reference, mime_type, byte_size, content_sha256
) values
  ('c3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Refund policy', 'https://a.example.test/refunds', 'Page 3', 'text/html', 32, repeat('1',64)),
  ('c3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'Draft policy', null, null, 'text/plain', 32, repeat('2',64)),
  ('c3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'Disabled policy', null, null, 'text/plain', 32, repeat('3',64)),
  ('c3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'Stale policy', null, null, 'text/plain', 32, repeat('4',64)),
  ('c3000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000005', 'Tenant B policy', null, null, 'text/plain', 32, repeat('5',64));

insert into public.chunks (
  id, organization_id, site_id, source_id, version_id, document_id, ordinal,
  content, content_sha256, start_line, end_line, embedding, embedding_model, embedded_at
) values
  ('c4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 0, 'İade süresi 14 gündür.', repeat('1',64), 1, 1, array_fill(0::real, array[384])::extensions.vector, 'test-384', now()),
  ('c4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000002', 0, 'İade süresi 7 gündür.', repeat('2',64), 1, 1, array_fill(0::real, array[384])::extensions.vector, 'test-384', now()),
  ('c4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000003', 0, 'İade süresi 30 gündür.', repeat('3',64), 1, 1, array_fill(0::real, array[384])::extensions.vector, 'test-384', now()),
  ('c4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000004', 0, 'İade süresi 60 gündür.', repeat('4',64), 1, 1, array_fill(0::real, array[384])::extensions.vector, 'test-384', now()),
  ('c4000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'c1000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000005', 0, 'İade süresi 90 gündür.', repeat('5',64), 1, 1, array_fill(0::real, array[384])::extensions.vector, 'test-384', now());

insert into public.sites (id, organization_id, name, public_name, widget_title)
values (
  'a0000000-0000-4000-8000-000000000102',
  'a0000000-0000-4000-8000-000000000001',
  'Tenant A second site',
  'Tenant A second site',
  'Second site agent'
);
insert into public.knowledge_sources (
  id, organization_id, site_id, source_type, name, source_key, status, progress,
  created_by, publication_status, approved_at, approved_by,
  freshness_checked_at, fresh_until
) values (
  'c1000000-0000-4000-8000-000000000007',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000102',
  'manual', 'Second-site policy', repeat('7',64), 'ready', 100,
  'a1111111-1111-4111-8111-111111111111', 'approved', now(),
  'a1111111-1111-4111-8111-111111111111', now(), now() + interval '1 day'
);
insert into public.knowledge_versions (
  id, organization_id, site_id, source_id, version_number, content_sha256,
  status, extracted_at, created_by
) values (
  'c2000000-0000-4000-8000-000000000007',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000102',
  'c1000000-0000-4000-8000-000000000007', 1, repeat('7',64), 'ready', now(),
  'a1111111-1111-4111-8111-111111111111'
);
update public.knowledge_sources
set current_version_id = 'c2000000-0000-4000-8000-000000000007'
where id = 'c1000000-0000-4000-8000-000000000007';
insert into public.documents (
  id, organization_id, site_id, source_id, version_id, title, mime_type,
  byte_size, content_sha256
) values (
  'c3000000-0000-4000-8000-000000000007',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000102',
  'c1000000-0000-4000-8000-000000000007',
  'c2000000-0000-4000-8000-000000000007',
  'Second-site policy', 'text/plain', 32, repeat('7',64)
);
insert into public.chunks (
  id, organization_id, site_id, source_id, version_id, document_id, ordinal,
  content, content_sha256, start_line, end_line, embedding, embedding_model, embedded_at
) values (
  'c4000000-0000-4000-8000-000000000007',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000102',
  'c1000000-0000-4000-8000-000000000007',
  'c2000000-0000-4000-8000-000000000007',
  'c3000000-0000-4000-8000-000000000007',
  0, 'İade süresi 21 gündür.', repeat('7',64), 1, 1,
  array_fill(0::real, array[384])::extensions.vector, 'test-384', now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';

select is(
  (select count(*) from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'iade süresi', null, 10, 50
  )),
  1::bigint,
  'only approved, fresh, ready, current source is retrieved'
);
set local role service_role;
select is(
  (select count(*) from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'iade süresi', null, 10, 50
  )),
  1::bigint,
  'the server (service role) retrieves for the widget with the same filters'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select results_eq(
  $$select source_id from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'iade süresi', null, 10, 50
  )$$,
  $$values ('c1000000-0000-4000-8000-000000000001'::uuid)$$,
  'draft, disabled and stale sources never enter retrieval'
);
select results_eq(
  $$select source_title, source_url, page_reference, snippet
    from public.retrieve_approved_knowledge(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'iade süresi', null, 10, 50
    )$$,
  $$values ('Refund policy'::text, 'https://a.example.test/refunds'::text, 'Page 3'::text, 'İade süresi 14 gündür.'::text)$$,
  'citation contract contains title, URL/page and snippet'
);
select is(
  (select count(*) from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'lexical-miss',
    array_prepend(1::real, array_fill(0::real, array[383]))::extensions.vector,
    10,
    50
  )),
  1::bigint,
  'semantic branch contributes an approved fresh result when lexical search misses'
);
select results_eq(
  $$select source_id from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000102',
    'iade süresi', null, 10, 50
  )$$,
  $$values ('c1000000-0000-4000-8000-000000000007'::uuid)$$,
  'site filter returns only the selected site inside the same tenant'
);

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001","email":"owner-b@example.test"}';
select is_empty(
  $$select chunk_id from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'iade süresi', null, 10, 50
  )$$,
  'cross-tenant retrieval returns zero rows'
);

set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002","email":"member-a@example.test"}';
select throws_ok(
  $$select * from public.set_knowledge_source_lifecycle('c1000000-0000-4000-8000-000000000001', 'disabled')$$,
  '42501', 'permission denied', 'viewer cannot change source lifecycle'
);

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select is(
  (select publication_status from public.set_knowledge_source_lifecycle('c1000000-0000-4000-8000-000000000001', 'disabled')),
  'disabled',
  'owner can disable an approved source'
);
select is_empty(
  $$select chunk_id from public.retrieve_approved_knowledge(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'iade süresi', null, 10, 50
  )$$,
  'disabled source disappears from retrieval immediately'
);
select is(
  (select publication_status from public.set_knowledge_source_lifecycle('c1000000-0000-4000-8000-000000000001', 'draft')),
  'draft',
  'disabled source can return to draft'
);
select is(
  (select publication_status from public.set_knowledge_source_lifecycle('c1000000-0000-4000-8000-000000000001', 'approved')),
  'approved',
  'fresh ready draft can be explicitly approved again'
);

select ok(
  public.request_knowledge_reindex('c1000000-0000-4000-8000-000000000001') is not null,
  'owner can manually request a URL reindex'
);
select is(
  (select count(*) from public.knowledge_versions where source_id = 'c1000000-0000-4000-8000-000000000001'),
  2::bigint,
  'manual reindex creates one immutable source version'
);
select results_eq(
  $$select status, progress from public.knowledge_sources where id = 'c1000000-0000-4000-8000-000000000001'$$,
  $$values ('pending'::text, 0::smallint)$$,
  'manual reindex is visibly pending and fail-closed'
);
select throws_ok(
  $$select public.request_knowledge_reindex('c1000000-0000-4000-8000-000000000001')$$,
  '55000', 'source already has an active job', 'duplicate active reindex is rejected'
);

set local role service_role;
select is(public.enqueue_due_knowledge_recrawls(25), 1, 'due approved source is queued for recrawl');
select is(
  (select count(*) from public.ingestion_jobs where source_id = 'c1000000-0000-4000-8000-000000000006' and status = 'pending'),
  1::bigint,
  'due recrawl creates one pending job'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
select throws_ok(
  $$select public.enqueue_due_knowledge_recrawls(25)$$,
  '42501', null, 'authenticated callers cannot run the recrawl scheduler'
);

select * from finish();
rollback;
