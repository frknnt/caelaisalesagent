-- P1.5: tenant-safe sales inbox, atomic human handoff and durable notification
-- outbox. Browser roles can read their tenant but every mutation goes through a
-- role-checking RPC. Secrets and e-mail delivery remain server-only.

alter table public.conversations
  add column handoff_state text not null default 'bot'
    check (handoff_state in ('bot', 'human')),
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column assignment_version bigint not null default 0
    check (assignment_version >= 0),
  add column handoff_reason text
    check (handoff_reason is null or handoff_reason ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  add column handed_off_at timestamptz,
  add column sla_due_at timestamptz,
  add column first_human_response_at timestamptz,
  add column closed_at timestamptz,
  add column lead_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(lead_context) = 'object');

create index conversations_inbox_idx
  on public.conversations
  (organization_id, status, handoff_state, assigned_to, last_message_at desc);
create index conversations_sla_idx
  on public.conversations (sla_due_at)
  where handoff_state = 'human' and first_human_response_at is null and status = 'open';

alter table public.messages add column sender_type text;
update public.messages
set sender_type = case role when 'visitor' then 'visitor' else 'bot' end;
alter table public.messages
  alter column sender_type set not null,
  alter column sender_type set default 'bot',
  add column author_user_id uuid references public.profiles (id) on delete set null;
alter table public.messages drop constraint messages_role_check;
alter table public.messages drop constraint messages_check;
alter table public.messages
  add constraint messages_role_check check (role in ('visitor', 'assistant')),
  add constraint messages_sender_check check (
    (role = 'visitor' and sender_type = 'visitor' and client_message_id is not null
      and reply_to is null and status = 'completed' and feedback is null
      and author_user_id is null and char_length(body) between 1 and 1000)
    or
    (role = 'assistant' and sender_type = 'bot' and client_message_id is null
      and reply_to is not null and author_user_id is null)
    or
    (role = 'assistant' and sender_type = 'human' and client_message_id is null
      and reply_to is null and status = 'completed' and author_user_id is not null
      and char_length(body) between 1 and 4000)
  );

create table public.conversation_reads (
  organization_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);

create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  author_user_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);
create index conversation_notes_conversation_idx
  on public.conversation_notes (organization_id, conversation_id, created_at);

create table public.conversation_tool_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  message_id uuid references public.messages (id) on delete cascade,
  tool_name text not null check (tool_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  outcome text not null check (outcome in ('success', 'failure')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  unique (message_id, tool_name),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);

create table public.inbox_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  recipient_user_id uuid references public.profiles (id) on delete cascade,
  recipient_email text not null check (recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  template text not null check (template in ('handoff', 'sla_reminder')),
  scheduled_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  last_error_code text check (last_error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  created_at timestamptz not null default now(),
  unique (conversation_id, recipient_user_id, template),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);
create index inbox_notification_pending_idx
  on public.inbox_notification_outbox (scheduled_at, id)
  where delivered_at is null;

create function private.can_manage_inbox(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_active_session()) and exists (
    select 1 from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'sales')
  );
$$;

create function private.inbox_actor_role(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid())
    and (select private.has_active_session())
    and membership.role in ('owner', 'admin', 'sales');
$$;

create function private.queue_inbox_email(
  p_conversation public.conversations,
  p_template text,
  p_scheduled_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.inbox_notification_outbox (
    organization_id, conversation_id, recipient_user_id, recipient_email,
    template, scheduled_at
  )
  select p_conversation.organization_id, p_conversation.id, membership.user_id,
    lower(user_row.email), p_template, p_scheduled_at
  from public.memberships as membership
  join auth.users as user_row on user_row.id = membership.user_id
  where membership.organization_id = p_conversation.organization_id
    and membership.role in ('owner', 'admin', 'sales')
    and user_row.email is not null
  on conflict (conversation_id, recipient_user_id, template) do nothing;
$$;

create function public.inbox_takeover(
  p_conversation_id uuid,
  p_expected_version bigint,
  p_reason text,
  p_sla_minutes integer default 15
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.conversations;
  actor_role text;
begin
  if p_reason is null or p_reason !~ '^[a-z][a-z0-9_.-]{1,63}$'
    or p_sla_minutes not between 1 and 1440 then
    raise exception 'invalid_handoff' using errcode = '22023';
  end if;
  select * into target from public.conversations where id = p_conversation_id for update;
  actor_role := private.inbox_actor_role(target.organization_id);
  if target.id is null or actor_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if target.status <> 'open' then
    raise exception 'conversation_closed' using errcode = '55000';
  end if;
  if target.assignment_version <> p_expected_version
    or (target.handoff_state = 'human' and target.assigned_to is distinct from (select auth.uid())) then
    raise exception 'assignment_conflict' using errcode = '40001';
  end if;

  update public.conversations
  set handoff_state = 'human', assigned_to = (select auth.uid()),
      handoff_reason = p_reason, handed_off_at = coalesce(handed_off_at, now()),
      sla_due_at = coalesce(sla_due_at, now() + make_interval(mins => p_sla_minutes)),
      assignment_version = assignment_version + 1
  where id = target.id returning * into target;

  -- A late model worker must not publish after a representative has taken over.
  update public.messages set status = 'failed', body = '', citations = '[]'::jsonb,
    handoff = true
  where conversation_id = target.id and sender_type = 'bot' and status = 'pending';

  insert into public.audit_events (
    organization_id, site_id, actor_type, actor_user_id, action, entity_type,
    entity_id, outcome, metadata
  ) values (
    target.organization_id, target.site_id, 'user', (select auth.uid()),
    'conversation.takeover', 'conversation', target.id, 'success',
    jsonb_build_object('reason_code', p_reason, 'assignment_version', target.assignment_version)
  );
  perform private.queue_inbox_email(target, 'handoff', now());
  perform private.queue_inbox_email(target, 'sla_reminder', target.sla_due_at);
  return target;
end;
$$;

create function public.inbox_release_to_bot(
  p_conversation_id uuid,
  p_expected_version bigint
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.conversations;
  actor_role text;
begin
  select * into target from public.conversations where id = p_conversation_id for update;
  actor_role := private.inbox_actor_role(target.organization_id);
  if target.id is null or actor_role is null or target.status <> 'open' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if target.assignment_version <> p_expected_version then
    raise exception 'assignment_conflict' using errcode = '40001';
  end if;
  if target.assigned_to is distinct from (select auth.uid()) and actor_role not in ('owner', 'admin') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.conversations
  set handoff_state = 'bot', assigned_to = null, handoff_reason = null,
      sla_due_at = null, assignment_version = assignment_version + 1
  where id = target.id returning * into target;
  insert into public.audit_events (
    organization_id, site_id, actor_type, actor_user_id, action, entity_type,
    entity_id, outcome, metadata
  ) values (target.organization_id, target.site_id, 'user', (select auth.uid()),
    'conversation.release_to_bot', 'conversation', target.id, 'success',
    jsonb_build_object('assignment_version', target.assignment_version));
  return target;
end;
$$;

create function public.inbox_close_conversation(
  p_conversation_id uuid,
  p_expected_version bigint
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations;
begin
  select * into target from public.conversations where id = p_conversation_id for update;
  if target.id is null or not private.can_manage_inbox(target.organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if target.assignment_version <> p_expected_version then
    raise exception 'assignment_conflict' using errcode = '40001';
  end if;
  update public.conversations
  set status = 'closed', closed_at = now(), assignment_version = assignment_version + 1
  where id = target.id returning * into target;
  insert into public.audit_events (
    organization_id, site_id, actor_type, actor_user_id, action, entity_type,
    entity_id, outcome, metadata
  ) values (target.organization_id, target.site_id, 'user', (select auth.uid()),
    'conversation.close', 'conversation', target.id, 'success',
    jsonb_build_object('assignment_version', target.assignment_version));
  return target;
end;
$$;

create function public.inbox_send_reply(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.conversations;
  sent public.messages;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  select * into target from public.conversations where id = p_conversation_id for update;
  if target.id is null or not private.can_manage_inbox(target.organization_id)
    or target.status <> 'open' or target.handoff_state <> 'human'
    or target.assigned_to is distinct from (select auth.uid()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  insert into public.messages (
    organization_id, conversation_id, role, sender_type, author_user_id, body
  ) values (
    target.organization_id, target.id, 'assistant', 'human', (select auth.uid()), btrim(p_body)
  ) returning * into sent;
  update public.conversations
  set last_message_at = sent.created_at,
      first_human_response_at = coalesce(first_human_response_at, sent.created_at)
  where id = target.id;
  insert into public.audit_events (
    organization_id, site_id, actor_type, actor_user_id, action, entity_type,
    entity_id, outcome, metadata
  ) values (target.organization_id, target.site_id, 'user', (select auth.uid()),
    'conversation.reply', 'conversation', target.id, 'success',
    jsonb_build_object('message_id', sent.id));
  return sent;
end;
$$;

create function public.inbox_add_note(p_conversation_id uuid, p_body text)
returns public.conversation_notes
language plpgsql
security definer
set search_path = ''
as $$
declare target public.conversations; note public.conversation_notes;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  select * into target from public.conversations where id = p_conversation_id;
  if target.id is null or not private.can_manage_inbox(target.organization_id) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  insert into public.conversation_notes (organization_id, conversation_id, author_user_id, body)
  values (target.organization_id, target.id, (select auth.uid()), btrim(p_body))
  returning * into note;
  insert into public.audit_events (
    organization_id, site_id, actor_type, actor_user_id, action, entity_type,
    entity_id, outcome, metadata
  ) values (target.organization_id, target.site_id, 'user', (select auth.uid()),
    'conversation.note_added', 'conversation', target.id, 'success',
    jsonb_build_object('note_id', note.id));
  return note;
end;
$$;

create function public.inbox_mark_read(p_conversation_id uuid)
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
  values (target.organization_id, target.id, (select auth.uid()), now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

create function public.inbox_record_tool_event(
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
  if current_user <> 'service_role' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
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

create function public.claim_inbox_notifications(p_limit integer default 25)
returns setof public.inbox_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user <> 'service_role' or p_limit not between 1 and 100 then
    raise exception 'permission_denied' using errcode = '42501';
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

create function public.complete_inbox_notification(
  p_id uuid, p_delivered boolean, p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if current_user <> 'service_role' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.inbox_notification_outbox
  set delivered_at = case when p_delivered then now() else delivered_at end,
      claimed_at = null,
      last_error_code = case when p_delivered then null else p_error_code end
  where id = p_id and delivered_at is null;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Human mode: store the visitor message but never claim a bot reply.
create or replace function public.widget_post_message(
  p_widget_session_id uuid,
  p_client_message_id uuid,
  p_body text
)
returns table (
  outcome text, retry_after integer, conversation_id uuid, message_id uuid,
  reply_id uuid, reply_status text, reply_body text, reply_citations jsonb,
  reply_handoff boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  visitor public.visitor_identities;
  conversation public.conversations;
  visitor_message public.messages;
  reply public.messages;
  wait integer;
  last_body text;
  last_at timestamptz;
begin
  if p_client_message_id is null then
    raise exception 'invalid_client_message_id' using errcode = '22023';
  end if;
  visitor := private.session_visitor(p_widget_session_id);
  if visitor.id is null then
    return query select 'denied'::text, 0, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean; return;
  end if;
  select message.* into visitor_message
  from public.messages as message
  join public.conversations as owner on owner.id = message.conversation_id
    and owner.organization_id = message.organization_id
  where owner.organization_id = visitor.organization_id
    and owner.visitor_id = visitor.id and message.client_message_id = p_client_message_id;
  if visitor_message.id is not null then
    select * into reply from public.messages as answer
    where answer.reply_to = visitor_message.id for update;
    if reply.id is null then
      return query select 'human_active'::text, 0, visitor_message.conversation_id,
        visitor_message.id, null::uuid, null::text, null::text, null::jsonb, true; return;
    end if;
    if reply.status = 'completed' then
      return query select 'duplicate'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, reply.body, reply.citations, reply.handoff; return;
    end if;
    if reply.status = 'pending' and reply.claimed_at > now() - interval '90 seconds' then
      return query select 'in_progress'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean; return;
    end if;
    if reply.attempts >= 5 then
      return query select 'failed'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean; return;
    end if;
    update public.messages as answer set status = 'pending', claimed_at = now(),
      attempts = answer.attempts + 1 where answer.id = reply.id returning * into reply;
    return query select 'claimed'::text, 0, visitor_message.conversation_id,
      visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean; return;
  end if;
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 1000 then
    return query select 'invalid'::text, 0, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean; return;
  end if;
  wait := private.consume_widget_rate_limit('message:session:' || p_widget_session_id, 12, 60);
  if wait = 0 then wait := private.consume_widget_rate_limit('message:site:' || visitor.site_id, 600, 60); end if;
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean; return;
  end if;
  select * into conversation from public.conversations as open_one
  where open_one.organization_id = visitor.organization_id
    and open_one.visitor_id = visitor.id and open_one.status = 'open'
  order by open_one.last_message_at desc limit 1 for update;
  if conversation.id is null then
    insert into public.conversations (organization_id, site_id, visitor_id)
    values (visitor.organization_id, visitor.site_id, visitor.id) returning * into conversation;
  end if;
  if conversation.visitor_message_count >= 100 then
    return query select 'limit_reached'::text, 0, conversation.id, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean; return;
  end if;
  select message.body, message.created_at into last_body, last_at from public.messages as message
  where message.organization_id = conversation.organization_id
    and message.conversation_id = conversation.id and message.role = 'visitor'
  order by message.created_at desc limit 1;
  if last_body is not null and lower(btrim(last_body)) = lower(btrim(p_body))
    and last_at > now() - interval '30 seconds' then
    return query select 'spam'::text, 0, conversation.id, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean; return;
  end if;
  insert into public.messages (organization_id, conversation_id, role, sender_type, client_message_id, body)
  values (conversation.organization_id, conversation.id, 'visitor', 'visitor', p_client_message_id, p_body)
  on conflict on constraint messages_conversation_id_client_message_id_key do nothing
  returning * into visitor_message;
  if visitor_message.id is null then
    return query select 'in_progress'::text, 0, conversation.id, null::uuid, null::uuid,
      'pending'::text, null::text, null::jsonb, null::boolean; return;
  end if;
  update public.conversations as owner
  set visitor_message_count = owner.visitor_message_count + 1, last_message_at = now()
  where owner.id = conversation.id;
  if conversation.handoff_state = 'human' then
    return query select 'human_active'::text, 0, conversation.id, visitor_message.id,
      null::uuid, null::text, null::text, null::jsonb, true; return;
  end if;
  insert into public.messages (
    organization_id, conversation_id, role, sender_type, reply_to, status, attempts, claimed_at
  ) values (conversation.organization_id, conversation.id, 'assistant', 'bot', visitor_message.id,
    'pending', 1, now()) returning * into reply;
  return query select 'claimed'::text, 0, conversation.id, visitor_message.id, reply.id,
    reply.status, null::text, null::jsonb, null::boolean;
end;
$$;

-- A pending model answer may finish only while the conversation is still bot-owned.
create or replace function public.widget_complete_reply(
  p_reply_id uuid, p_status text, p_body text, p_citations jsonb,
  p_handoff boolean, p_prompt_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'invalid_reply_status' using errcode = '22023';
  end if;
  update public.messages as reply
  set status = p_status,
      body = case when p_status = 'completed' then coalesce(p_body, '') else '' end,
      citations = case when p_status = 'completed' then coalesce(p_citations, '[]'::jsonb) else '[]'::jsonb end,
      handoff = p_status = 'completed' and coalesce(p_handoff, false),
      prompt_version = p_prompt_version
  from public.conversations as owner
  where reply.id = p_reply_id and reply.role = 'assistant' and reply.sender_type = 'bot'
    and reply.status = 'pending' and owner.id = reply.conversation_id
    and owner.organization_id = reply.organization_id and owner.handoff_state = 'bot';
  get diagnostics changed = row_count;
  if changed > 0 then
    update public.conversations as owner set last_message_at = now()
    from public.messages as reply where reply.id = p_reply_id
      and owner.organization_id = reply.organization_id and owner.id = reply.conversation_id;
  end if;
  return changed > 0;
end;
$$;

alter table public.conversation_reads enable row level security;
alter table public.conversation_notes enable row level security;
alter table public.conversation_tool_events enable row level security;
alter table public.inbox_notification_outbox enable row level security;

create policy conversation_reads_select on public.conversation_reads for select to authenticated
  using ((select private.can_manage_inbox(organization_id)));
create policy conversation_notes_select on public.conversation_notes for select to authenticated
  using ((select private.can_manage_inbox(organization_id)));
create policy conversation_tool_events_select on public.conversation_tool_events for select to authenticated
  using ((select private.can_manage_inbox(organization_id)));

revoke all on table public.conversation_reads from public, anon, authenticated, service_role;
revoke all on table public.conversation_notes from public, anon, authenticated, service_role;
revoke all on table public.conversation_tool_events from public, anon, authenticated, service_role;
revoke all on table public.inbox_notification_outbox from public, anon, authenticated, service_role;
grant select on table public.conversation_reads, public.conversation_notes,
  public.conversation_tool_events to authenticated, service_role;
grant select, insert, update on table public.inbox_notification_outbox to service_role;
grant select, insert on table public.conversation_tool_events to service_role;

revoke all on function private.can_manage_inbox(uuid) from public;
revoke all on function private.inbox_actor_role(uuid) from public;
revoke all on function private.queue_inbox_email(public.conversations, text, timestamptz) from public;
grant execute on function private.can_manage_inbox(uuid) to authenticated;

revoke all on function public.inbox_takeover(uuid, bigint, text, integer) from public, anon, authenticated;
revoke all on function public.inbox_release_to_bot(uuid, bigint) from public, anon, authenticated;
revoke all on function public.inbox_close_conversation(uuid, bigint) from public, anon, authenticated;
revoke all on function public.inbox_send_reply(uuid, text) from public, anon, authenticated;
revoke all on function public.inbox_add_note(uuid, text) from public, anon, authenticated;
revoke all on function public.inbox_mark_read(uuid) from public, anon, authenticated;
grant execute on function public.inbox_takeover(uuid, bigint, text, integer) to authenticated;
grant execute on function public.inbox_release_to_bot(uuid, bigint) to authenticated;
grant execute on function public.inbox_close_conversation(uuid, bigint) to authenticated;
grant execute on function public.inbox_send_reply(uuid, text) to authenticated;
grant execute on function public.inbox_add_note(uuid, text) to authenticated;
grant execute on function public.inbox_mark_read(uuid) to authenticated;

revoke all on function public.inbox_record_tool_event(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_inbox_notifications(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_inbox_notification(uuid, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.inbox_record_tool_event(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.claim_inbox_notifications(integer) to service_role;
grant execute on function public.complete_inbox_notification(uuid, boolean, text) to service_role;
