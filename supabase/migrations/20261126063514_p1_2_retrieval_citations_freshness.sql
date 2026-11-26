-- P1.2: approved/fresh retrieval, source citations, and safe reindexing.
-- Existing P1.1 migrations stay immutable; this migration only appends.

create extension if not exists vector with schema extensions;

alter table public.knowledge_sources
  add column publication_status text not null default 'draft'
    check (publication_status in ('draft', 'approved', 'disabled')),
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles (id) on delete set null,
  add column disabled_at timestamptz,
  add column disabled_by uuid references public.profiles (id) on delete set null,
  add column freshness_ttl interval not null default interval '30 days'
    check (freshness_ttl between interval '1 hour' and interval '365 days'),
  add column freshness_checked_at timestamptz,
  add column fresh_until timestamptz,
  add column last_crawled_at timestamptz,
  add column next_recrawl_at timestamptz,
  add column last_reindex_requested_at timestamptz,
  add constraint knowledge_sources_lifecycle_timestamps_check check (
    (publication_status = 'approved' and approved_at is not null and approved_by is not null)
    or publication_status <> 'approved'
  );

create index knowledge_sources_recrawl_due_idx
  on public.knowledge_sources (next_recrawl_at, organization_id, site_id)
  where publication_status = 'approved'
    and status = 'ready'
    and source_type in ('site', 'url');

create index knowledge_sources_retrieval_scope_idx
  on public.knowledge_sources (
    organization_id,
    site_id,
    publication_status,
    status,
    fresh_until
  );

alter table public.documents
  add column page_reference text
    check (page_reference is null or char_length(page_reference) between 1 and 120);

alter table public.chunks
  add column start_line integer not null default 1 check (start_line > 0),
  add column end_line integer not null default 1 check (end_line >= start_line),
  add column embedding extensions.vector(384),
  add column embedding_model text
    check (embedding_model is null or char_length(embedding_model) between 1 and 120),
  add column embedded_at timestamptz,
  add column search_vector tsvector generated always as (
    to_tsvector('simple', content)
  ) stored,
  add constraint chunks_embedding_metadata_check check (
    (embedding is null and embedding_model is null and embedded_at is null)
    or (embedding is not null and embedding_model is not null and embedded_at is not null)
  );

create index chunks_search_vector_idx
  on public.chunks using gin (search_vector);

create index chunks_embedding_hnsw_idx
  on public.chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index chunks_retrieval_scope_idx
  on public.chunks (organization_id, site_id, version_id, source_id);

-- The P1.1 source table was broadly updatable by authenticated clients. P1.2
-- lifecycle and freshness fields are intentionally RPC-only.
revoke insert, update, delete on table public.knowledge_sources from authenticated;

create or replace function public.set_knowledge_source_lifecycle(
  p_source_id uuid,
  p_publication_status text
)
returns table (
  source_id uuid,
  publication_status text,
  fresh_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.knowledge_sources;
begin
  if p_publication_status not in ('draft', 'approved', 'disabled') then
    raise exception 'invalid publication status' using errcode = '22023';
  end if;

  select source.* into v_source
  from public.knowledge_sources as source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception 'source not found' using errcode = 'P0002';
  end if;
  if not (select private.has_organization_role(
    v_source.organization_id,
    array['owner', 'admin', 'editor']
  )) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_publication_status = 'approved' and (
    v_source.status <> 'ready'
    or v_source.current_version_id is null
    or v_source.fresh_until is null
    or v_source.fresh_until <= now()
  ) then
    raise exception 'source is not ready and fresh' using errcode = '55000';
  end if;

  update public.knowledge_sources as source
  set publication_status = p_publication_status,
      approved_at = case when p_publication_status = 'approved' then now() else source.approved_at end,
      approved_by = case when p_publication_status = 'approved' then (select auth.uid()) else source.approved_by end,
      disabled_at = case when p_publication_status = 'disabled' then now() else null end,
      disabled_by = case when p_publication_status = 'disabled' then (select auth.uid()) else null end,
      updated_at = now()
  where source.id = p_source_id
  returning source.* into v_source;

  return query select v_source.id, v_source.publication_status, v_source.fresh_until;
end;
$$;

create function private.enqueue_knowledge_reindex(
  p_source_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = '', extensions
as $$
declare
  v_source public.knowledge_sources;
  v_version public.knowledge_versions;
  v_job public.ingestion_jobs;
  v_version_number integer;
  v_message_id bigint;
  v_request_hash text;
begin
  select source.* into v_source
  from public.knowledge_sources as source
  where source.id = p_source_id
  for update;
  if not found then
    raise exception 'source not found' using errcode = 'P0002';
  end if;
  if v_source.source_type not in ('site', 'url') then
    raise exception 'source cannot be recrawled' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.ingestion_jobs as job
    where job.source_id = v_source.id and job.status in ('pending', 'processing')
  ) then
    raise exception 'source already has an active job' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_source.id::text, 0));
  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from public.knowledge_versions as version
  where version.source_id = v_source.id;

  v_request_hash := encode(digest(
    v_source.id::text || ':' || clock_timestamp()::text || ':' || gen_random_uuid()::text,
    'sha256'
  ), 'hex');

  insert into public.knowledge_versions (
    organization_id,
    site_id,
    source_id,
    version_number,
    content_sha256,
    created_by
  ) values (
    v_source.organization_id,
    v_source.site_id,
    v_source.id,
    v_version_number,
    v_request_hash,
    p_created_by
  ) returning * into v_version;

  insert into public.ingestion_jobs (
    organization_id,
    site_id,
    source_id,
    version_id,
    max_attempts,
    idempotency_key
  ) values (
    v_source.organization_id,
    v_source.site_id,
    v_source.id,
    v_version.id,
    3,
    encode(digest(
      v_source.organization_id::text || ':' || v_source.site_id::text || ':' ||
      v_source.id::text || ':' || v_request_hash,
      'sha256'
    ), 'hex')
  ) returning * into v_job;

  select pgmq.send(
    'knowledge_ingestion',
    jsonb_build_object(
      'job_id', v_job.id,
      'source_id', v_source.id,
      'version_id', v_version.id
    )
  ) into v_message_id;

  update public.ingestion_jobs as job
  set queue_message_id = v_message_id
  where job.id = v_job.id;

  update public.knowledge_sources as source
  set current_version_id = v_version.id,
      status = 'pending',
      progress = 0,
      latest_error_code = null,
      last_reindex_requested_at = now(),
      updated_at = now()
  where source.id = v_source.id;

  return v_job.id;
end;
$$;

create function public.request_knowledge_reindex(p_source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.knowledge_sources;
begin
  select source.* into v_source
  from public.knowledge_sources as source
  where source.id = p_source_id;
  if not found then
    raise exception 'source not found' using errcode = 'P0002';
  end if;
  if not (select private.has_organization_role(
    v_source.organization_id,
    array['owner', 'admin', 'editor']
  )) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return private.enqueue_knowledge_reindex(v_source.id, (select auth.uid()));
end;
$$;

create function public.enqueue_due_knowledge_recrawls(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source record;
  v_count integer := 0;
begin
  if p_limit not between 1 and 100 then
    raise exception 'invalid recrawl batch size' using errcode = '22023';
  end if;

  for v_source in
    select source.id, source.created_by
    from public.knowledge_sources as source
    where source.publication_status = 'approved'
      and source.status = 'ready'
      and source.source_type in ('site', 'url')
      and source.next_recrawl_at <= now()
      and not exists (
        select 1 from public.ingestion_jobs as job
        where job.source_id = source.id and job.status in ('pending', 'processing')
      )
    order by source.next_recrawl_at
    for update skip locked
    limit p_limit
  loop
    perform private.enqueue_knowledge_reindex(v_source.id, v_source.created_by);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.retrieve_approved_knowledge(
  p_organization_id uuid,
  p_site_id uuid,
  p_query_text text,
  p_query_embedding extensions.vector(384) default null,
  p_match_count integer default 8,
  p_rrf_k integer default 50
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_title text,
  source_url text,
  page_reference text,
  snippet text,
  fresh_until timestamptz,
  lexical_rank bigint,
  semantic_rank bigint,
  fused_score double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if char_length(btrim(p_query_text)) not between 1 and 1000
    or p_match_count not between 1 and 20
    or p_rrf_k not between 1 and 1000 then
    raise exception 'invalid retrieval request' using errcode = '22023';
  end if;
  if not (select private.is_organization_member(p_organization_id)) then
    return;
  end if;

  return query
  with eligible as materialized (
    select
      chunk.id as chunk_id,
      chunk.source_id,
      source.name as source_title,
      coalesce(document.canonical_url, source.canonical_url) as source_url,
      document.page_reference,
      chunk.content,
      chunk.search_vector,
      chunk.embedding,
      source.fresh_until
    from public.chunks as chunk
    inner join public.knowledge_sources as source
      on source.organization_id = chunk.organization_id
      and source.id = chunk.source_id
    inner join public.documents as document
      on document.organization_id = chunk.organization_id
      and document.id = chunk.document_id
    where chunk.organization_id = p_organization_id
      and chunk.site_id = p_site_id
      and source.site_id = p_site_id
      and source.publication_status = 'approved'
      and source.status = 'ready'
      and source.current_version_id = chunk.version_id
      and source.fresh_until > now()
  ),
  keyword as (
    select
      eligible.chunk_id,
      row_number() over (
        order by pg_catalog.ts_rank_cd(
          eligible.search_vector,
          pg_catalog.websearch_to_tsquery('simple', p_query_text)
        ) desc,
        eligible.chunk_id
      ) as rank_ix
    from eligible
    where eligible.search_vector @@ pg_catalog.websearch_to_tsquery('simple', p_query_text)
    order by rank_ix
    limit least(p_match_count, 20) * 2
  ),
  semantic as (
    select
      eligible.chunk_id,
      row_number() over (
        order by eligible.embedding <=> p_query_embedding, eligible.chunk_id
      ) as rank_ix
    from eligible
    where p_query_embedding is not null and eligible.embedding is not null
    order by rank_ix
    limit least(p_match_count, 20) * 2
  ),
  fused as (
    select
      coalesce(keyword.chunk_id, semantic.chunk_id) as chunk_id,
      keyword.rank_ix as lexical_rank,
      semantic.rank_ix as semantic_rank,
      coalesce(1.0 / (p_rrf_k + keyword.rank_ix), 0.0)
        + coalesce(1.0 / (p_rrf_k + semantic.rank_ix), 0.0) as score
    from keyword
    full outer join semantic on semantic.chunk_id = keyword.chunk_id
  )
  select
    eligible.chunk_id,
    eligible.source_id,
    eligible.source_title,
    eligible.source_url,
    eligible.page_reference,
    left(regexp_replace(eligible.content, '\\s+', ' ', 'g'), 600) as snippet,
    eligible.fresh_until,
    fused.lexical_rank,
    fused.semantic_rank,
    fused.score
  from fused
  inner join eligible on eligible.chunk_id = fused.chunk_id
  order by fused.score desc, eligible.chunk_id
  limit p_match_count;
end;
$$;

-- Successful ingestion atomically activates the new version and its freshness
-- window. A reindex is fail-closed while pending, so stale evidence cannot leak.
create or replace function public.complete_ingestion_job(
  p_job_id uuid,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.ingestion_jobs;
begin
  select job.* into v_job
  from public.ingestion_jobs as job
  where job.id = p_job_id
  for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  if v_job.status = 'ready' then
    perform pgmq.archive('knowledge_ingestion', p_message_id);
    return;
  end if;
  if v_job.status <> 'processing' or v_job.queue_message_id <> p_message_id then
    raise exception 'job claim mismatch' using errcode = '55000';
  end if;

  update public.ingestion_jobs as job
  set status = 'ready', progress = 100, last_error_code = null,
      finished_at = now(), updated_at = now()
  where job.id = v_job.id;
  update public.knowledge_versions as version
  set status = 'ready', extracted_at = now(), input_text = null
  where version.id = v_job.version_id;
  update public.knowledge_sources as source
  set current_version_id = v_job.version_id,
      status = 'ready',
      progress = 100,
      latest_error_code = null,
      freshness_checked_at = now(),
      fresh_until = now() + source.freshness_ttl,
      last_crawled_at = case
        when source.source_type in ('site', 'url') then now()
        else source.last_crawled_at
      end,
      next_recrawl_at = case
        when source.source_type in ('site', 'url') then now() + source.freshness_ttl
        else null
      end,
      updated_at = now()
  where source.id = v_job.source_id;
  perform pgmq.archive('knowledge_ingestion', p_message_id);
end;
$$;

revoke all on function private.enqueue_knowledge_reindex(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.set_knowledge_source_lifecycle(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.request_knowledge_reindex(uuid) from public, anon, authenticated, service_role;
revoke all on function public.enqueue_due_knowledge_recrawls(integer) from public, anon, authenticated, service_role;
revoke all on function public.retrieve_approved_knowledge(uuid, uuid, text, extensions.vector, integer, integer) from public, anon, authenticated, service_role;

grant execute on function public.set_knowledge_source_lifecycle(uuid, text) to authenticated;
grant execute on function public.request_knowledge_reindex(uuid) to authenticated;
grant execute on function public.enqueue_due_knowledge_recrawls(integer) to service_role;
grant execute on function public.retrieve_approved_knowledge(uuid, uuid, text, extensions.vector, integer, integer) to authenticated, service_role;

revoke all on function public.complete_ingestion_job(uuid, bigint) from public, anon, authenticated;
grant execute on function public.complete_ingestion_job(uuid, bigint) to service_role;
