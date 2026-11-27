-- Server-side qualification/extraction can attach minimized lead context for
-- the representative. Browsers cannot call this port; later P2 tasks may reuse
-- it without granting direct UPDATE on conversations.
create function public.inbox_set_lead_context(
  p_conversation_id uuid,
  p_context jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if p_context is null or jsonb_typeof(p_context) <> 'object'
    or pg_column_size(p_context) > 8192 then
    raise exception 'invalid_lead_context' using errcode = '22023';
  end if;
  update public.conversations
  set lead_context = p_context
  where id = p_conversation_id;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.inbox_set_lead_context(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.inbox_set_lead_context(uuid, jsonb) to service_role;
