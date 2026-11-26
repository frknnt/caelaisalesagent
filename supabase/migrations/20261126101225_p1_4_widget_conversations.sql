-- P1.4: widget conversations and session memory.
--
-- `widget_sessions` (P0.5) stays the 30 minute technical access session. A
-- `visitor_identities` row is the anonymous visitor behind one or more of them;
-- `visitor_sessions` links each technical session to exactly one visitor. The
-- browser keeps only a random visitor secret; the database stores its SHA-256.
-- A visitor is resumed within two hours of activity (refresh, reconnect), and
-- after that only with an active memory consent. Every write goes through the
-- service-role functions below; members of the organization may read.

-- Tables ----------------------------------------------------------------------

create table public.visitor_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  -- base64url SHA-256 of the browser's random secret. Never the secret.
  secret_hash text not null check (secret_hash ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  memory_consent_at timestamptz,
  memory_consent_text_version text
    check (memory_consent_text_version ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  check ((memory_consent_at is null) = (memory_consent_text_version is null)),
  unique (site_id, secret_hash),
  unique (organization_id, id),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete cascade
);

create index visitor_identities_organization_site_idx
  on public.visitor_identities (organization_id, site_id, last_seen_at desc);

-- Append-only consent history: purpose, text version, time and source.
create table public.visitor_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  visitor_id uuid not null,
  purpose text not null check (purpose = 'conversation_memory'),
  granted boolean not null,
  text_version text not null check (text_version ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  source text not null check (source = 'widget'),
  recorded_at timestamptz not null default now(),
  foreign key (organization_id, visitor_id)
    references public.visitor_identities (organization_id, id)
    on delete cascade
);

create index visitor_consents_visitor_idx
  on public.visitor_consents (organization_id, visitor_id, recorded_at desc);

create table public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  widget_session_id uuid not null unique
    references public.widget_sessions (id) on delete cascade,
  visitor_id uuid not null,
  resumed boolean not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, visitor_id)
    references public.visitor_identities (organization_id, id)
    on delete cascade
);

create index visitor_sessions_visitor_idx
  on public.visitor_sessions (organization_id, visitor_id, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  visitor_id uuid not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  visitor_message_count integer not null default 0 check (visitor_message_count >= 0),
  -- Deterministic digest of the turns that no longer fit the model window.
  -- Visitor-derived: always passed to the model as untrusted data.
  summary text check (char_length(summary) <= 4000),
  summarized_through timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, visitor_id)
    references public.visitor_identities (organization_id, id)
    on delete cascade,
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete cascade
);

create index conversations_organization_site_last_idx
  on public.conversations (organization_id, site_id, last_message_at desc);
create index conversations_visitor_idx
  on public.conversations (organization_id, visitor_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('visitor', 'assistant')),
  -- Visitor: the browser's id for the message, which makes a resend a no-op.
  client_message_id uuid,
  -- Assistant: the visitor message it answers. Unique, so one reply at most.
  reply_to uuid unique references public.messages (id) on delete cascade,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  body text not null default '' check (char_length(body) <= 4000),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  handoff boolean not null default false,
  prompt_version text check (prompt_version ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,59}$'),
  feedback smallint check (feedback in (-1, 1)),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  claimed_at timestamptz,
  -- Wall clock, not transaction time: a reply sorts after its question.
  created_at timestamptz not null default clock_timestamp(),
  check (
    (role = 'visitor' and client_message_id is not null and reply_to is null
      and status = 'completed' and feedback is null
      and char_length(body) between 1 and 1000)
    or (role = 'assistant' and client_message_id is null and reply_to is not null)
  ),
  unique (conversation_id, client_message_id),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id)
    on delete cascade
);

create index messages_conversation_created_idx
  on public.messages (organization_id, conversation_id, created_at);

-- Functions -------------------------------------------------------------------

create function private.assert_secret_hash(p_hash text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_hash is null or p_hash !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_secret_hash' using errcode = '22023';
  end if;
end;
$$;

-- The live session row of a token the application has already checked.
create function private.live_widget_session(p_widget_session_id uuid)
returns public.widget_sessions
language sql
stable
security definer
set search_path = ''
as $$
  select session.*
  from public.widget_sessions as session
  where session.id = p_widget_session_id
    and session.revoked_at is null
    and session.expires_at > now();
$$;

-- Binds a technical session to a visitor, once. A known secret resumes its
-- visitor when the visitor was active in the last two hours, or at any time
-- within 180 days while a memory consent is active. Anything else starts a new
-- anonymous visitor with the new secret. Repeating the call returns the
-- visitor already bound, whatever secrets it carries.
create function public.widget_attach_visitor(
  p_widget_session_id uuid,
  p_secret_hash text,
  p_new_secret_hash text
)
returns table (
  outcome text,
  visitor_id uuid,
  resumed boolean,
  memory_consent boolean,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  live public.widget_sessions;
  bound public.visitor_sessions;
  found_visitor public.visitor_identities;
  was_resumed boolean := false;
begin
  perform private.assert_secret_hash(p_new_secret_hash);
  if p_secret_hash is not null then
    perform private.assert_secret_hash(p_secret_hash);
  end if;

  live := private.live_widget_session(p_widget_session_id);
  if live.id is null then
    return query select 'denied'::text, null::uuid, false, false, null::uuid;
    return;
  end if;

  select * into bound
  from public.visitor_sessions as link
  where link.widget_session_id = live.id;

  if bound.id is null then
    if p_secret_hash is not null then
      select * into found_visitor
      from public.visitor_identities as identity
      where identity.site_id = live.site_id
        and identity.secret_hash = p_secret_hash
        and (
          identity.last_seen_at > now() - interval '2 hours'
          or (identity.memory_consent_at is not null
            and identity.last_seen_at > now() - interval '180 days')
        )
      for update;
      was_resumed := found_visitor.id is not null;
    end if;

    if found_visitor.id is null then
      insert into public.visitor_identities (organization_id, site_id, secret_hash)
      values (live.organization_id, live.site_id, p_new_secret_hash)
      on conflict (site_id, secret_hash) do nothing
      returning * into found_visitor;
      if found_visitor.id is null then
        -- A fresh 256-bit secret that collides is not a real visitor.
        raise exception 'secret_collision' using errcode = '23505';
      end if;
    end if;

    insert into public.visitor_sessions (
      organization_id, site_id, widget_session_id, visitor_id, resumed
    ) values (
      live.organization_id, live.site_id, live.id, found_visitor.id, was_resumed
    )
    on conflict (widget_session_id) do nothing
    returning * into bound;
    if bound.id is null then
      select * into bound
      from public.visitor_sessions as link
      where link.widget_session_id = live.id;
    end if;
  end if;

  update public.visitor_identities as identity
  set last_seen_at = now()
  where identity.id = bound.visitor_id
  returning * into found_visitor;

  return query
  select
    'allowed'::text,
    found_visitor.id,
    bound.resumed,
    found_visitor.memory_consent_at is not null,
    (
      select conversation.id
      from public.conversations as conversation
      where conversation.organization_id = found_visitor.organization_id
        and conversation.visitor_id = found_visitor.id
        and conversation.status = 'open'
      order by conversation.last_message_at desc
      limit 1
    );
end;
$$;

-- Visitor of a live, bound technical session.
create function private.session_visitor(p_widget_session_id uuid)
returns public.visitor_identities
language sql
stable
security definer
set search_path = ''
as $$
  select identity.*
  from public.visitor_sessions as link
  join public.widget_sessions as session on session.id = link.widget_session_id
  join public.visitor_identities as identity
    on identity.organization_id = link.organization_id
   and identity.id = link.visitor_id
  where link.widget_session_id = p_widget_session_id
    and session.revoked_at is null
    and session.expires_at > now();
$$;

-- Records a visitor message and claims the one reply to it. A resend of the
-- same client message id never adds a message or a second reply: a finished
-- reply comes back as `duplicate`, a running one as `in_progress`; a failed or
-- abandoned (90 s) reply is claimed again, at most 5 times.
create function public.widget_post_message(
  p_widget_session_id uuid,
  p_client_message_id uuid,
  p_body text
)
returns table (
  outcome text,
  retry_after integer,
  conversation_id uuid,
  message_id uuid,
  reply_id uuid,
  reply_status text,
  reply_body text,
  reply_citations jsonb,
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
      null::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  -- Resend: answer from what is stored, before any limit is spent.
  select message.* into visitor_message
  from public.messages as message
  join public.conversations as owner
    on owner.organization_id = message.organization_id
   and owner.id = message.conversation_id
  where owner.organization_id = visitor.organization_id
    and owner.visitor_id = visitor.id
    and message.client_message_id = p_client_message_id;

  if visitor_message.id is not null then
    select * into reply
    from public.messages as answer
    where answer.reply_to = visitor_message.id
    for update;

    if reply.status = 'completed' then
      return query select 'duplicate'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, reply.body, reply.citations, reply.handoff;
      return;
    end if;
    if reply.status = 'pending' and reply.claimed_at > now() - interval '90 seconds' then
      return query select 'in_progress'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean;
      return;
    end if;
    if reply.attempts >= 5 then
      return query select 'failed'::text, 0, visitor_message.conversation_id,
        visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean;
      return;
    end if;
    update public.messages as answer
    set status = 'pending', claimed_at = now(), attempts = answer.attempts + 1
    where answer.id = reply.id
    returning * into reply;
    return query select 'claimed'::text, 0, visitor_message.conversation_id,
      visitor_message.id, reply.id, reply.status, null::text, null::jsonb, null::boolean;
    return;
  end if;

  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 1000 then
    return query select 'invalid'::text, 0, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  wait := private.consume_widget_rate_limit('message:session:' || p_widget_session_id, 12, 60);
  if wait = 0 then
    wait := private.consume_widget_rate_limit('message:site:' || visitor.site_id, 600, 60);
  end if;
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  select * into conversation
  from public.conversations as open_one
  where open_one.organization_id = visitor.organization_id
    and open_one.visitor_id = visitor.id
    and open_one.status = 'open'
  order by open_one.last_message_at desc
  limit 1
  for update;

  if conversation.id is null then
    insert into public.conversations (organization_id, site_id, visitor_id)
    values (visitor.organization_id, visitor.site_id, visitor.id)
    returning * into conversation;
  end if;

  if conversation.visitor_message_count >= 100 then
    return query select 'limit_reached'::text, 0, conversation.id, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  -- The same text again within 30 seconds, under a new id, is a repeat.
  select message.body, message.created_at into last_body, last_at
  from public.messages as message
  where message.organization_id = conversation.organization_id
    and message.conversation_id = conversation.id
    and message.role = 'visitor'
  order by message.created_at desc
  limit 1;
  if last_body is not null
    and lower(btrim(last_body)) = lower(btrim(p_body))
    and last_at > now() - interval '30 seconds' then
    return query select 'spam'::text, 0, conversation.id, null::uuid, null::uuid,
      null::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  insert into public.messages (
    organization_id, conversation_id, role, client_message_id, body
  ) values (
    conversation.organization_id, conversation.id, 'visitor', p_client_message_id, p_body
  )
  on conflict on constraint messages_conversation_id_client_message_id_key do nothing
  returning * into visitor_message;
  if visitor_message.id is null then
    -- A concurrent resend inserted it first; it owns the reply.
    return query select 'in_progress'::text, 0, conversation.id, null::uuid, null::uuid,
      'pending'::text, null::text, null::jsonb, null::boolean;
    return;
  end if;

  insert into public.messages (
    organization_id, conversation_id, role, reply_to, status, attempts, claimed_at
  ) values (
    conversation.organization_id, conversation.id, 'assistant', visitor_message.id,
    'pending', 1, now()
  )
  returning * into reply;

  update public.conversations as owner
  set visitor_message_count = owner.visitor_message_count + 1,
      last_message_at = now()
  where owner.id = conversation.id;

  return query select 'claimed'::text, 0, conversation.id, visitor_message.id, reply.id,
    reply.status, null::text, null::jsonb, null::boolean;
end;
$$;

-- Ends a claimed reply. Only a pending reply changes; a late duplicate worker
-- cannot overwrite an answer that is already there.
create function public.widget_complete_reply(
  p_reply_id uuid,
  p_status text,
  p_body text,
  p_citations jsonb,
  p_handoff boolean,
  p_prompt_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'invalid_reply_status' using errcode = '22023';
  end if;
  update public.messages as reply
  set status = p_status,
      body = case when p_status = 'completed' then coalesce(p_body, '') else '' end,
      citations = case when p_status = 'completed' then coalesce(p_citations, '[]'::jsonb)
        else '[]'::jsonb end,
      handoff = p_status = 'completed' and coalesce(p_handoff, false),
      prompt_version = p_prompt_version
  where reply.id = p_reply_id
    and reply.role = 'assistant'
    and reply.status = 'pending';
  get diagnostics changed = row_count;
  if changed > 0 then
    update public.conversations as owner
    set last_message_at = now()
    from public.messages as reply
    where reply.id = p_reply_id
      and owner.organization_id = reply.organization_id
      and owner.id = reply.conversation_id;
  end if;
  return changed > 0;
end;
$$;

-- The newest messages of the visitor's open conversation, oldest first, with
-- the conversation summary. Empty when there is no conversation yet.
create function public.widget_conversation(
  p_widget_session_id uuid,
  p_limit integer
)
returns table (
  conversation_id uuid,
  summary text,
  summarized_through timestamptz,
  memory_consent boolean,
  message_id uuid,
  role text,
  client_message_id uuid,
  reply_to uuid,
  status text,
  body text,
  citations jsonb,
  handoff boolean,
  feedback smallint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  visitor public.visitor_identities;
  conversation public.conversations;
begin
  if p_limit not between 1 and 200 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  visitor := private.session_visitor(p_widget_session_id);
  if visitor.id is null then
    raise exception 'session_not_bound' using errcode = '28000';
  end if;
  select * into conversation
  from public.conversations as open_one
  where open_one.organization_id = visitor.organization_id
    and open_one.visitor_id = visitor.id
    and open_one.status = 'open'
  order by open_one.last_message_at desc
  limit 1;
  if conversation.id is null then
    return;
  end if;
  return query
  select conversation.id, conversation.summary, conversation.summarized_through,
    visitor.memory_consent_at is not null,
    recent.id, recent.role, recent.client_message_id, recent.reply_to, recent.status,
    recent.body, recent.citations, recent.handoff, recent.feedback, recent.created_at
  from (
    select message.*
    from public.messages as message
    where message.organization_id = conversation.organization_id
      and message.conversation_id = conversation.id
    -- A reply shares its question's timestamp; newest-first keeps it with it.
    order by message.created_at desc, message.role asc
    limit p_limit
  ) as recent
  order by recent.created_at, recent.role desc;
end;
$$;

-- Stores the digest of older turns. Only moves forward in time.
create function public.widget_update_summary(
  p_conversation_id uuid,
  p_summary text,
  p_through timestamptz
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with changed as (
    update public.conversations as conversation
    set summary = p_summary, summarized_through = p_through
    where conversation.id = p_conversation_id
      and (conversation.summarized_through is null or conversation.summarized_through < p_through)
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- Thumbs up or down on an assistant reply of the visitor's own conversation.
create function public.widget_set_feedback(
  p_widget_session_id uuid,
  p_message_id uuid,
  p_value smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  visitor public.visitor_identities;
  changed integer;
begin
  if p_value is not null and p_value not in (-1, 1) then
    raise exception 'invalid_feedback' using errcode = '22023';
  end if;
  visitor := private.session_visitor(p_widget_session_id);
  if visitor.id is null then
    return false;
  end if;
  update public.messages as message
  set feedback = p_value
  from public.conversations as owner
  where message.id = p_message_id
    and message.role = 'assistant'
    and message.status = 'completed'
    and owner.organization_id = message.organization_id
    and owner.id = message.conversation_id
    and owner.organization_id = visitor.organization_id
    and owner.visitor_id = visitor.id;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Grants or withdraws memory across visits. Each answer is kept in the history.
create function public.widget_set_memory_consent(
  p_widget_session_id uuid,
  p_granted boolean,
  p_text_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  visitor public.visitor_identities;
begin
  if p_granted is null or p_text_version is null
    or p_text_version !~ '^[a-z0-9][a-z0-9_.-]{0,39}$' then
    raise exception 'invalid_consent' using errcode = '22023';
  end if;
  visitor := private.session_visitor(p_widget_session_id);
  if visitor.id is null then
    return false;
  end if;
  insert into public.visitor_consents (
    organization_id, site_id, visitor_id, purpose, granted, text_version, source
  ) values (
    visitor.organization_id, visitor.site_id, visitor.id, 'conversation_memory',
    p_granted, p_text_version, 'widget'
  );
  update public.visitor_identities as identity
  set memory_consent_at = case when p_granted then now() end,
      memory_consent_text_version = case when p_granted then p_text_version end
  where identity.id = visitor.id;
  return true;
end;
$$;

-- RLS and grants --------------------------------------------------------------

alter table public.visitor_identities enable row level security;
alter table public.visitor_consents enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy visitor_consents_select_member
on public.visitor_consents for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy visitor_sessions_select_member
on public.visitor_sessions for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy conversations_select_member
on public.conversations for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy messages_select_member
on public.messages for select to authenticated
using ((select private.is_organization_member(organization_id)));

revoke all on table public.visitor_identities from public, anon, authenticated, service_role;
revoke all on table public.visitor_consents from public, anon, authenticated, service_role;
revoke all on table public.visitor_sessions from public, anon, authenticated, service_role;
revoke all on table public.conversations from public, anon, authenticated, service_role;
revoke all on table public.messages from public, anon, authenticated, service_role;

-- The secret hash stays server-side: members read no identity column at all.
grant select on table public.visitor_consents to authenticated, service_role;
grant select on table public.visitor_sessions to authenticated, service_role;
grant select on table public.conversations to authenticated, service_role;
grant select on table public.messages to authenticated, service_role;
grant select on table public.visitor_identities to service_role;

revoke all on function private.assert_secret_hash(text) from public;
revoke all on function private.live_widget_session(uuid) from public;
revoke all on function private.session_visitor(uuid) from public;

revoke all on function public.widget_attach_visitor(uuid, text, text) from public, anon, authenticated;
revoke all on function public.widget_post_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.widget_complete_reply(uuid, text, text, jsonb, boolean, text)
  from public, anon, authenticated;
revoke all on function public.widget_conversation(uuid, integer) from public, anon, authenticated;
revoke all on function public.widget_update_summary(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.widget_set_feedback(uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function public.widget_set_memory_consent(uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.widget_attach_visitor(uuid, text, text) to service_role;
grant execute on function public.widget_post_message(uuid, uuid, text) to service_role;
grant execute on function public.widget_complete_reply(uuid, text, text, jsonb, boolean, text)
  to service_role;
grant execute on function public.widget_conversation(uuid, integer) to service_role;
grant execute on function public.widget_update_summary(uuid, text, timestamptz) to service_role;
grant execute on function public.widget_set_feedback(uuid, uuid, smallint) to service_role;
grant execute on function public.widget_set_memory_consent(uuid, boolean, text) to service_role;
