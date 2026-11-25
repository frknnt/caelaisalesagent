-- Output column names in RETURNS TABLE are PL/pgSQL variables. Qualify every
-- updated column so queue claims remain deterministic under variable checking.

create or replace function public.claim_ingestion_job(
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

  select job.* into v_job
  from public.ingestion_jobs as job
  where job.id = nullif(v_message.message ->> 'job_id', '')::uuid
  for update;

  if not found or v_job.status = 'ready' then
    perform pgmq.archive('knowledge_ingestion', v_message.msg_id);
    return;
  end if;

  if v_job.status = 'failed' or v_job.attempt_count >= v_job.max_attempts then
    update public.ingestion_jobs as job
    set status = 'failed', last_error_code = 'POISON_MESSAGE',
        finished_at = now(), updated_at = now()
    where job.id = v_job.id;
    update public.knowledge_sources as source
    set status = 'failed', latest_error_code = 'POISON_MESSAGE', updated_at = now()
    where source.id = v_job.source_id;
    perform pgmq.archive('knowledge_ingestion', v_message.msg_id);
    return;
  end if;

  update public.ingestion_jobs as job
  set status = 'processing', progress = greatest(job.progress, 5),
      attempt_count = job.attempt_count + 1,
      started_at = coalesce(job.started_at, now()),
      queue_message_id = v_message.msg_id, updated_at = now()
  where job.id = v_job.id
  returning job.* into v_job;

  update public.knowledge_sources as source
  set status = 'processing', progress = greatest(source.progress, 5), updated_at = now()
  where source.id = v_job.source_id;
  update public.knowledge_versions as version
  set status = 'processing'
  where version.id = v_job.version_id;

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

revoke all on function public.claim_ingestion_job(integer) from public;
grant execute on function public.claim_ingestion_job(integer) to service_role;
