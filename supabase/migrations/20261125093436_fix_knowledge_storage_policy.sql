-- Keep the original P1.1 migration immutable after its first local application.
-- Qualify the outer Storage row inside correlated subqueries and make pgcrypto
-- explicit in the SECURITY DEFINER enqueue function's safe search path.

drop policy knowledge_storage_select_member on storage.objects;
drop policy knowledge_storage_insert_editor on storage.objects;
drop policy knowledge_storage_delete_editor on storage.objects;

create policy knowledge_storage_select_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'knowledge-sources'
  and (select private.is_organization_member(nullif(split_part(storage.objects.name, '/', 1), '')::uuid))
  and exists (
    select 1
    from public.sites as site
    where site.organization_id = nullif(split_part(storage.objects.name, '/', 1), '')::uuid
      and site.id = nullif(split_part(storage.objects.name, '/', 2), '')::uuid
  )
);

create policy knowledge_storage_insert_editor
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'knowledge-sources'
  and (select private.has_organization_role(
    nullif(split_part(storage.objects.name, '/', 1), '')::uuid,
    array['owner', 'admin', 'editor']
  ))
  and exists (
    select 1
    from public.sites as site
    where site.organization_id = nullif(split_part(storage.objects.name, '/', 1), '')::uuid
      and site.id = nullif(split_part(storage.objects.name, '/', 2), '')::uuid
  )
  and split_part(storage.objects.name, '/', 3) ~ '^[a-f0-9]{64}$'
);

create policy knowledge_storage_delete_editor
on storage.objects for delete
to authenticated
using (
  bucket_id = 'knowledge-sources'
  and (select private.has_organization_role(
    nullif(split_part(storage.objects.name, '/', 1), '')::uuid,
    array['owner', 'admin', 'editor']
  ))
);

alter function public.enqueue_knowledge_source(
  uuid, uuid, text, text, text, text, text, text, smallint
) set search_path = '', extensions;
