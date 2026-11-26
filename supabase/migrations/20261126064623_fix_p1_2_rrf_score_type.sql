-- Keep the public RPC contract numeric-free for JavaScript callers.
-- The RRF expression is PostgreSQL numeric unless explicitly cast.

create or replace function public.retrieve_approved_knowledge(
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
        order by eligible.embedding OPERATOR(extensions.<=>) p_query_embedding,
          eligible.chunk_id
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
      (
        coalesce(1.0 / (p_rrf_k + keyword.rank_ix), 0.0)
        + coalesce(1.0 / (p_rrf_k + semantic.rank_ix), 0.0)
      )::double precision as score
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

revoke all on function public.retrieve_approved_knowledge(uuid, uuid, text, extensions.vector, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.retrieve_approved_knowledge(uuid, uuid, text, extensions.vector, integer, integer) to authenticated, service_role;
