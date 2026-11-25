-- P1.1: tenant-safe knowledge sources, private raw files, and durable ingestion.
-- Queue messages deliberately contain identifiers only; source content never enters pgmq.

create extension if not exists pgmq cascade;

select pgmq.create('knowledge_ingestion');

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  source_type text not null
    check (source_type in ('site', 'url', 'manual', 'faq', 'file')),
  name text not null check (char_length(name) between 2 and 160),
  source_key text not null check (source_key ~ '^[a-f0-9]{64}$'),
  canonical_url text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  progress smallint not null default 0 check (progress between 0 and 100),
  latest_error_code text check (
    latest_error_code is null or latest_error_code ~ '^[A-Z0-9_]{3,64}$'
  ),
  current_version_id uuid,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id) on delete cascade,
  unique (organization_id, id),
  unique (organization_id, site_id, source_type, source_key),
  check (
    (source_type in ('site', 'url') and canonical_url is not null)
    or (source_type not in ('site', 'url') and canonical_url is null)
  )
);

create index knowledge_sources_site_status_idx
  on public.knowledge_sources (organization_id, site_id, status, updated_at desc);

create table public.knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  source_id uuid not null,
  version_number integer not null check (version_number > 0),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  input_text text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  extracted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id) on delete cascade,
  foreign key (organization_id, source_id)
    references public.knowledge_sources (organization_id, id) on delete cascade,
  unique (organization_id, id),
  unique (source_id, version_number),
  unique (source_id, content_sha256),
  check (input_text is null or octet_length(input_text) <= 1048576)
);

alter table public.knowledge_sources
  add constraint knowledge_sources_current_version_fkey
  foreign key (organization_id, current_version_id)
  references public.knowledge_versions (organization_id, id)
  on delete set null;

create index knowledge_versions_site_created_idx
  on public.knowledge_versions (organization_id, site_id, created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  source_id uuid not null,
  version_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  canonical_url text,
  mime_type text not null check (char_length(mime_type) between 3 and 128),
  byte_size bigint not null check (byte_size between 0 and 26214400),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text,
  storage_path text,
  malware_status text not null default 'not_required'
    check (malware_status in ('not_required', 'pending', 'clean', 'infected', 'error')),
  raw_retention_until timestamptz,
  raw_delete_claimed_at timestamptz,
  raw_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id) on delete cascade,
  foreign key (organization_id, source_id)
    references public.knowledge_sources (organization_id, id) on delete cascade,
  foreign key (organization_id, version_id)
    references public.knowledge_versions (organization_id, id) on delete cascade,
  unique (organization_id, id),
  unique (version_id, canonical_url, content_sha256),
  check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket = 'knowledge-sources' and storage_path is not null)
  ),
  check (raw_deleted_at is null or storage_path is not null)
);

create index documents_version_idx on public.documents (organization_id, version_id);
create index documents_retention_idx
  on public.documents (raw_retention_until, raw_delete_claimed_at)
  where storage_path is not null and raw_deleted_at is null;

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  source_id uuid not null,
  version_id uuid not null,
  document_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  content text not null check (char_length(content) between 1 and 12000),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  pii_types text[] not null default '{}',
  has_price boolean not null default false,
  price_line_numbers integer[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id) on delete cascade,
  foreign key (organization_id, source_id)
    references public.knowledge_sources (organization_id, id) on delete cascade,
  foreign key (organization_id, version_id)
    references public.knowledge_versions (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade,
  unique (document_id, ordinal),
  unique (document_id, content_sha256),
  check (pii_types <@ array['email', 'phone', 'identity', 'address', 'iban']::text[]),
  check ((not has_price and cardinality(price_line_numbers) = 0) or has_price),
  check (0 < all (price_line_numbers))
);

create index chunks_version_ordinal_idx
  on public.chunks (organization_id, version_id, document_id, ordinal);
create index chunks_sensitive_idx
  on public.chunks (organization_id, site_id, has_price)
  where has_price or cardinality(pii_types) > 0;

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  source_id uuid not null,
  version_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  progress smallint not null default 0 check (progress between 0 and 100),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{64}$'),
  queue_message_id bigint,
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[A-Z0-9_]{3,64}$'
  ),
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id) on delete cascade,
  foreign key (organization_id, source_id)
    references public.knowledge_sources (organization_id, id) on delete cascade,
  foreign key (organization_id, version_id)
    references public.knowledge_versions (organization_id, id) on delete cascade,
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  unique (version_id)
);

create index ingestion_jobs_claim_idx
  on public.ingestion_jobs (status, next_attempt_at, created_at)
  where status in ('pending', 'processing');
create index ingestion_jobs_source_idx
  on public.ingestion_jobs (organization_id, source_id, created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'knowledge-sources',
  'knowledge-sources',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy knowledge_storage_select_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'knowledge-sources'
  and (select private.is_organization_member(nullif(split_part(name, '/', 1), '')::uuid))
  and exists (
    select 1
    from public.sites as site
    where site.organization_id = nullif(split_part(name, '/', 1), '')::uuid
      and site.id = nullif(split_part(name, '/', 2), '')::uuid
  )
);

create policy knowledge_storage_insert_editor
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'knowledge-sources'
  and (select private.has_organization_role(
    nullif(split_part(name, '/', 1), '')::uuid,
    array['owner', 'admin', 'editor']
  ))
  and exists (
    select 1
    from public.sites as site
    where site.organization_id = nullif(split_part(name, '/', 1), '')::uuid
      and site.id = nullif(split_part(name, '/', 2), '')::uuid
  )
  and split_part(name, '/', 3) ~ '^[a-f0-9]{64}$'
);

create policy knowledge_storage_delete_editor
on storage.objects for delete
to authenticated
using (
  bucket_id = 'knowledge-sources'
  and (select private.has_organization_role(
    nullif(split_part(name, '/', 1), '')::uuid,
    array['owner', 'admin', 'editor']
  ))
);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_versions enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.ingestion_jobs enable row level security;

create policy knowledge_sources_select_member
on public.knowledge_sources for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy knowledge_sources_insert_editor
on public.knowledge_sources for insert to authenticated
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'editor']
)));

create policy knowledge_sources_update_editor
on public.knowledge_sources for update to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'editor']
)))
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'editor']
)));

create policy knowledge_sources_delete_editor
on public.knowledge_sources for delete to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'editor']
)));

create policy knowledge_versions_select_member
on public.knowledge_versions for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy documents_select_member
on public.documents for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy chunks_select_member
on public.chunks for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy ingestion_jobs_select_member
on public.ingestion_jobs for select to authenticated
using ((select private.is_organization_member(organization_id)));

create function public.enqueue_knowledge_source(
  p_organization_id uuid,
  p_site_id uuid,
  p_source_type text,
  p_name text,
  p_source_key text,
  p_content_sha256 text,
  p_canonical_url text default null,
  p_input_text text default null,
  p_max_attempts smallint default 3
)
returns table (
  source_id uuid,
  version_id uuid,
  job_id uuid,
  is_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.knowledge_sources;
  v_version public.knowledge_versions;
  v_job public.ingestion_jobs;
  v_version_number integer;
  v_message_id bigint;
begin
  if not (select private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'editor']
  )) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_source_type not in ('site', 'url', 'manual', 'faq', 'file')
    or p_source_key !~ '^[a-f0-9]{64}$'
    or p_content_sha256 !~ '^[a-f0-9]{64}$'
    or char_length(btrim(p_name)) not between 2 and 160
    or p_max_attempts not between 1 and 10 then
    raise exception 'invalid knowledge source' using errcode = '22023';
  end if;

  if (p_source_type in ('site', 'url')) <> (p_canonical_url is not null) then
    raise exception 'canonical URL does not match source type' using errcode = '22023';
  end if;

  if p_input_text is not null and octet_length(p_input_text) > 1048576 then
    raise exception 'input text is too large' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.sites as site
    where site.organization_id = p_organization_id and site.id = p_site_id
  ) then
    raise exception 'site not found' using errcode = 'P0002';
  end if;

  insert into public.knowledge_sources (
    organization_id,
    site_id,
    source_type,
    name,
    source_key,
    canonical_url,
    created_by
  )
  values (
    p_organization_id,
    p_site_id,
    p_source_type,
    btrim(p_name),
    p_source_key,
    p_canonical_url,
    (select auth.uid())
  )
  on conflict (organization_id, site_id, source_type, source_key)
  do update set name = excluded.name, updated_at = now()
  returning * into v_source;

  select * into v_version
  from public.knowledge_versions as version
  where version.source_id = v_source.id
    and version.content_sha256 = p_content_sha256;

  if found then
    select * into v_job
    from public.ingestion_jobs as job
    where job.version_id = v_version.id;
    return query select v_source.id, v_version.id, v_job.id, true;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_source.id::text, 0));
  select coalesce(max(version.version_number), 0) + 1 into v_version_number
  from public.knowledge_versions as version
  where version.source_id = v_source.id;

  insert into public.knowledge_versions (
    organization_id,
    site_id,
    source_id,
    version_number,
    content_sha256,
    input_text,
    created_by
  )
  values (
    p_organization_id,
    p_site_id,
    v_source.id,
    v_version_number,
    p_content_sha256,
    p_input_text,
    (select auth.uid())
  )
  returning * into v_version;

  insert into public.ingestion_jobs (
    organization_id,
    site_id,
    source_id,
    version_id,
    max_attempts,
    idempotency_key
  )
  values (
    p_organization_id,
    p_site_id,
    v_source.id,
    v_version.id,
    p_max_attempts,
    encode(digest(
      p_organization_id::text || ':' || p_site_id::text || ':' ||
      v_source.id::text || ':' || p_content_sha256,
      'sha256'
    ), 'hex')
  )
  returning * into v_job;

  select pgmq.send(
    'knowledge_ingestion',
    jsonb_build_object(
      'job_id', v_job.id,
      'source_id', v_source.id,
      'version_id', v_version.id
    )
  ) into v_message_id;

  update public.ingestion_jobs
  set queue_message_id = v_message_id
  where id = v_job.id;

  update public.knowledge_sources
  set current_version_id = v_version.id,
      status = 'pending',
      progress = 0,
      latest_error_code = null,
      updated_at = now()
  where id = v_source.id;

  return query select v_source.id, v_version.id, v_job.id, false;
end;
$$;

create function public.claim_ingestion_job(
  p_visibility_seconds integer default 120
)
returns table (
  message_id bigint,
  job_id uuid,
  organization_id uuid,
  site_id uuid,
  source_id uuid,
  version_id uuid,
  source_type text,
  canonical_url text,
  input_text text,
  attempt_count smallint,
  max_attempts smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message record;
  v_job public.ingestion_jobs;
begin
  if p_visibility_seconds not between 30 and 1800 then
    raise exception 'invalid visibility timeout' using errcode = '22023';
  end if;

  select * into v_message
  from pgmq.read('knowledge_ingestion', p_visibility_seconds, 1)
  limit 1;

  if not found then return; end if;

  select * into v_job
  from public.ingestion_jobs as job
  where job.id = nullif(v_message.message ->> 'job_id', '')::uuid
  for update;

  if not found or v_job.status = 'ready' then
    perform pgmq.archive('knowledge_ingestion', v_message.msg_id);
    return;
  end if;

  if v_job.status = 'failed' or v_job.attempt_count >= v_job.max_attempts then
    update public.ingestion_jobs
    set status = 'failed', last_error_code = 'POISON_MESSAGE',
        finished_at = now(), updated_at = now()
    where id = v_job.id;
    update public.knowledge_sources
    set status = 'failed', latest_error_code = 'POISON_MESSAGE', updated_at = now()
    where id = v_job.source_id;
    perform pgmq.archive('knowledge_ingestion', v_message.msg_id);
    return;
  end if;

  update public.ingestion_jobs
  set status = 'processing', progress = greatest(progress, 5),
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      queue_message_id = v_message.msg_id, updated_at = now()
  where id = v_job.id
  returning * into v_job;

  update public.knowledge_sources
  set status = 'processing', progress = greatest(progress, 5), updated_at = now()
  where id = v_job.source_id;
  update public.knowledge_versions set status = 'processing' where id = v_job.version_id;

  return query
  select
    v_message.msg_id,
    v_job.id,
    v_job.organization_id,
    v_job.site_id,
    v_job.source_id,
    v_job.version_id,
    source.source_type,
    source.canonical_url,
    version.input_text,
    v_job.attempt_count,
    v_job.max_attempts
  from public.knowledge_sources as source
  inner join public.knowledge_versions as version on version.id = v_job.version_id
  where source.id = v_job.source_id;
end;
$$;

create function public.update_ingestion_progress(
  p_job_id uuid,
  p_progress smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_source_id uuid;
begin
  if p_progress not between 5 and 95 then
    raise exception 'invalid progress' using errcode = '22023';
  end if;
  update public.ingestion_jobs
  set progress = greatest(progress, p_progress), updated_at = now()
  where id = p_job_id and status = 'processing'
  returning source_id into v_source_id;
  if v_source_id is null then raise exception 'job not processing' using errcode = '55000'; end if;
  update public.knowledge_sources
  set progress = greatest(progress, p_progress), updated_at = now()
  where id = v_source_id;
end;
$$;

create function public.complete_ingestion_job(
  p_job_id uuid,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.ingestion_jobs;
begin
  select * into v_job from public.ingestion_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  if v_job.status = 'ready' then
    perform pgmq.archive('knowledge_ingestion', p_message_id);
    return;
  end if;
  if v_job.status <> 'processing' or v_job.queue_message_id <> p_message_id then
    raise exception 'job claim mismatch' using errcode = '55000';
  end if;
  update public.ingestion_jobs
  set status = 'ready', progress = 100, last_error_code = null,
      finished_at = now(), updated_at = now()
  where id = v_job.id;
  update public.knowledge_versions
  set status = 'ready', extracted_at = now(), input_text = null
  where id = v_job.version_id;
  update public.knowledge_sources
  set status = 'ready', progress = 100, latest_error_code = null, updated_at = now()
  where id = v_job.source_id;
  perform pgmq.archive('knowledge_ingestion', p_message_id);
end;
$$;

create function public.fail_ingestion_job(
  p_job_id uuid,
  p_message_id bigint,
  p_error_code text,
  p_retryable boolean,
  p_retry_delay_seconds integer default 30
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.ingestion_jobs;
  v_new_message_id bigint;
begin
  if p_error_code !~ '^[A-Z0-9_]{3,64}$'
    or p_retry_delay_seconds not between 0 and 86400 then
    raise exception 'invalid failure data' using errcode = '22023';
  end if;
  select * into v_job from public.ingestion_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  if v_job.status <> 'processing' or v_job.queue_message_id <> p_message_id then
    raise exception 'job claim mismatch' using errcode = '55000';
  end if;

  perform pgmq.archive('knowledge_ingestion', p_message_id);

  if p_retryable and v_job.attempt_count < v_job.max_attempts then
    select pgmq.send(
      'knowledge_ingestion',
      jsonb_build_object(
        'job_id', v_job.id,
        'source_id', v_job.source_id,
        'version_id', v_job.version_id
      ),
      p_retry_delay_seconds
    ) into v_new_message_id;
    update public.ingestion_jobs
    set status = 'pending', queue_message_id = v_new_message_id,
        last_error_code = p_error_code,
        next_attempt_at = now() + make_interval(secs => p_retry_delay_seconds),
        updated_at = now()
    where id = v_job.id;
    update public.knowledge_sources
    set status = 'pending', latest_error_code = p_error_code, updated_at = now()
    where id = v_job.source_id;
    return 'pending';
  end if;

  update public.ingestion_jobs
  set status = 'failed', last_error_code = p_error_code,
      finished_at = now(), updated_at = now()
  where id = v_job.id;
  update public.knowledge_versions set status = 'failed' where id = v_job.version_id;
  update public.knowledge_sources
  set status = 'failed', latest_error_code = p_error_code, updated_at = now()
  where id = v_job.source_id;
  return 'failed';
end;
$$;

create function public.retry_ingestion_job(p_job_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.ingestion_jobs;
  v_message_id bigint;
begin
  select * into v_job from public.ingestion_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  if not (select private.has_organization_role(
    v_job.organization_id,
    array['owner', 'admin', 'editor']
  )) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_job.status <> 'failed' then
    raise exception 'only failed jobs can be retried' using errcode = '55000';
  end if;
  select pgmq.send(
    'knowledge_ingestion',
    jsonb_build_object(
      'job_id', v_job.id,
      'source_id', v_job.source_id,
      'version_id', v_job.version_id
    )
  ) into v_message_id;
  update public.ingestion_jobs
  set status = 'pending', progress = 0, attempt_count = 0,
      queue_message_id = v_message_id, last_error_code = null,
      next_attempt_at = null, started_at = null, finished_at = null,
      updated_at = now()
  where id = v_job.id;
  update public.knowledge_versions set status = 'pending' where id = v_job.version_id;
  update public.knowledge_sources
  set status = 'pending', progress = 0, latest_error_code = null, updated_at = now()
  where id = v_job.source_id;
  return v_message_id;
end;
$$;

create function public.claim_expired_knowledge_files(p_limit integer default 100)
returns table (document_id uuid, storage_bucket text, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 500 then
    raise exception 'invalid retention batch size' using errcode = '22023';
  end if;
  return query
  with claimed as (
    select document.id
    from public.documents as document
    where document.storage_path is not null
      and document.raw_deleted_at is null
      and document.raw_retention_until <= now()
      and (
        document.raw_delete_claimed_at is null
        or document.raw_delete_claimed_at < now() - interval '15 minutes'
      )
    order by document.raw_retention_until
    for update skip locked
    limit p_limit
  )
  update public.documents as document
  set raw_delete_claimed_at = now()
  from claimed
  where document.id = claimed.id
  returning document.id, document.storage_bucket, document.storage_path;
end;
$$;

create function public.mark_knowledge_file_deleted(p_document_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.documents
  set raw_deleted_at = now()
  where id = p_document_id
    and raw_delete_claimed_at is not null
    and raw_deleted_at is null;
$$;

revoke all on table public.knowledge_sources from anon, authenticated, service_role;
revoke all on table public.knowledge_versions from anon, authenticated, service_role;
revoke all on table public.documents from anon, authenticated, service_role;
revoke all on table public.chunks from anon, authenticated, service_role;
revoke all on table public.ingestion_jobs from anon, authenticated, service_role;

grant select, insert, update, delete on table public.knowledge_sources to authenticated;
grant select on table public.knowledge_versions to authenticated;
grant select on table public.documents to authenticated;
grant select on table public.chunks to authenticated;
grant select on table public.ingestion_jobs to authenticated;

grant all on table public.knowledge_sources to service_role;
grant all on table public.knowledge_versions to service_role;
grant all on table public.documents to service_role;
grant all on table public.chunks to service_role;
grant all on table public.ingestion_jobs to service_role;

revoke all on function public.enqueue_knowledge_source(uuid, uuid, text, text, text, text, text, text, smallint) from public;
revoke all on function public.claim_ingestion_job(integer) from public;
revoke all on function public.update_ingestion_progress(uuid, smallint) from public;
revoke all on function public.complete_ingestion_job(uuid, bigint) from public;
revoke all on function public.fail_ingestion_job(uuid, bigint, text, boolean, integer) from public;
revoke all on function public.retry_ingestion_job(uuid) from public;
revoke all on function public.claim_expired_knowledge_files(integer) from public;
revoke all on function public.mark_knowledge_file_deleted(uuid) from public;

grant execute on function public.enqueue_knowledge_source(uuid, uuid, text, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.retry_ingestion_job(uuid) to authenticated;
grant execute on function public.claim_ingestion_job(integer) to service_role;
grant execute on function public.update_ingestion_progress(uuid, smallint) to service_role;
grant execute on function public.complete_ingestion_job(uuid, bigint) to service_role;
grant execute on function public.fail_ingestion_job(uuid, bigint, text, boolean, integer) to service_role;
grant execute on function public.claim_expired_knowledge_files(integer) to service_role;
grant execute on function public.mark_knowledge_file_deleted(uuid) to service_role;
