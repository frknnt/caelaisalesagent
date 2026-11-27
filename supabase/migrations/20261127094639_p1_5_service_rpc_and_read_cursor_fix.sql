-- Security-definer functions execute as their owner, so current_user is not the
-- calling Data API role. EXECUTE grants are the caller boundary; function
-- bodies still validate row ownership. Use clock_timestamp for read cursors so
-- they can cover messages created later in the same transaction.

create or replace function public.inbox_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations;
begin
  select * into target from public.conversations where id = p_conversation_id;
  if target.id is null or not private.can_manage_inbox(target.organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  insert into public.conversation_reads (organization_id, conversation_id, user_id, last_read_at)
  values (target.organization_id, target.id, (select auth.uid()), clock_timestamp())
  on conflict (conversation_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

create or replace function public.inbox_record_tool_event(
  p_conversation_id uuid,
  p_message_id uuid,
  p_tool_name text,
  p_outcome text,
  p_summary jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations;
begin
  select * into target from public.conversations where id = p_conversation_id;
  if target.id is null then return false; end if;
  insert into public.conversation_tool_events (
    organization_id, conversation_id, message_id, tool_name, outcome, summary
  ) values (target.organization_id, target.id, p_message_id, p_tool_name, p_outcome,
    coalesce(p_summary, '{}'::jsonb))
  on conflict (message_id, tool_name) do nothing;
  return true;
end;
$$;

create or replace function public.claim_inbox_notifications(p_limit integer default 25)
returns setof public.inbox_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select outbox.id
    from public.inbox_notification_outbox as outbox
    join public.conversations as conversation on conversation.id = outbox.conversation_id
    where outbox.delivered_at is null
      and outbox.attempt_count < 10
      and outbox.scheduled_at <= now()
      and (outbox.claimed_at is null or outbox.claimed_at < now() - interval '5 minutes')
      and (outbox.template <> 'sla_reminder'
        or (conversation.first_human_response_at is null and conversation.status = 'open'))
    order by outbox.scheduled_at, outbox.id
    limit p_limit
    for update of outbox skip locked
  )
  update public.inbox_notification_outbox as outbox
  set claimed_at = now(), attempt_count = outbox.attempt_count + 1
  from candidates where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_inbox_notification(
  p_id uuid, p_delivered boolean, p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  update public.inbox_notification_outbox
  set delivered_at = case when p_delivered then now() else delivered_at end,
      claimed_at = null,
      last_error_code = case when p_delivered then null else p_error_code end
  where id = p_id and delivered_at is null;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

create or replace function public.inbox_request_agent_handoff(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations;
begin
  select * into target from public.conversations where id = p_conversation_id for update;
  if target.id is null then return false; end if;
  if target.status <> 'open' or target.handoff_state = 'human' then return true; end if;
  update public.conversations
  set handoff_state = 'human', assigned_to = null, handoff_reason = 'agent_requested',
      handed_off_at = now(), sla_due_at = now() + interval '15 minutes',
      assignment_version = assignment_version + 1
  where id = target.id returning * into target;
  insert into public.audit_events (
    organization_id, site_id, actor_type, action, entity_type, entity_id,
    outcome, metadata
  ) values (target.organization_id, target.site_id, 'agent',
    'conversation.handoff_requested', 'conversation', target.id, 'success',
    jsonb_build_object('reason_code', 'agent_requested',
      'assignment_version', target.assignment_version));
  perform private.queue_inbox_email(target, 'handoff', now());
  perform private.queue_inbox_email(target, 'sla_reminder', target.sla_due_at);
  return true;
end;
$$;
