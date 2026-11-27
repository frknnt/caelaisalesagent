-- Agent-triggered handoff enters the unassigned team queue. A representative
-- must explicitly claim it; the database remains the authority that stops bot
-- replies on every later visitor message.
create function public.inbox_request_agent_handoff(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations;
begin
  if current_user <> 'service_role' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
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

revoke all on function public.inbox_request_agent_handoff(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.inbox_request_agent_handoff(uuid) to service_role;
