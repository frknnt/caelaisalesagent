begin;
select plan(6);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","session_id":"a1111111-0000-4000-8000-000000000001","email":"owner-a@example.test"}';
insert into storage.objects (bucket_id, name, metadata)
values (
  'knowledge-sources',
  'a0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000101/' || repeat('a', 64) || '/source.txt',
  '{"mimetype":"text/plain","size":4}'
);
select is((select count(*) from storage.objects where bucket_id = 'knowledge-sources'), 1::bigint, 'Tenant A can upload under its site path');
select is((select count(*) from storage.objects where bucket_id = 'knowledge-sources'), 1::bigint, 'Tenant A can read its private object');

set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111","session_id":"b1111111-0000-4000-8000-000000000001","email":"owner-b@example.test"}';
select is_empty($$select id from storage.objects where bucket_id = 'knowledge-sources'$$, 'Tenant B cannot read Tenant A storage objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata) values (
    'knowledge-sources',
    'a0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000101/' || repeat('b', 64) || '/cross.txt',
    '{"mimetype":"text/plain","size":4}'
  )$$,
  '42501', null, 'Tenant B cannot upload into Tenant A path'
);

insert into storage.objects (bucket_id, name, metadata)
values (
  'knowledge-sources',
  'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000101/' || repeat('b', 64) || '/source.txt',
  '{"mimetype":"text/plain","size":4}'
);
select is((select count(*) from storage.objects where bucket_id = 'knowledge-sources'), 1::bigint, 'Tenant B can use its own storage path');

set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","session_id":"a2222222-0000-4000-8000-000000000002","email":"member-a@example.test"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata) values (
    'knowledge-sources',
    'a0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000101/' || repeat('c', 64) || '/viewer.txt',
    '{"mimetype":"text/plain","size":4}'
  )$$,
  '42501', null, 'viewer cannot upload knowledge files'
);

select * from finish();
rollback;
