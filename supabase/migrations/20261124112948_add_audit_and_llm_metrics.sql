-- P0.4: append-only audit trail and LLM cost, latency and token metrics.
--
-- Clients never write either table. Audit rows come from triggers in the same
-- transaction as the change, or from the service role for events that change
-- no row (such as a denied request). No API role may update, delete or truncate.

-- Metadata carries codes, identifiers and counts only. Prose, e-mail addresses,
-- phone-like numbers, nested values and personal or secret keys are rejected.
create function private.is_safe_audit_metadata(p_metadata jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_metadata) = 'object'
    and octet_length(p_metadata::text) <= 2048
    and not exists (
      select 1
      from jsonb_each(
        case when jsonb_typeof(p_metadata) = 'object' then p_metadata else '{}'::jsonb end
      ) as entry (key, value)
      where entry.key !~ '^[a-z][a-z0-9_]{0,39}$'
        or entry.key ~ '(password|passwd|secret|token|authorization|cookie|api_?key|credential|jwt|signature|session|email|e_mail|phone)'
        or entry.key in (
          'address', 'body', 'content', 'display_name', 'first_name',
          'full_name', 'gsm', 'headers', 'ip', 'ip_address', 'last_name',
          'message', 'messages', 'mobile', 'name', 'note', 'notes', 'payload',
          'prompt', 'query', 'subject', 'text', 'transcript', 'user_agent',
          'username'
        )
        or case jsonb_typeof(entry.value)
          when 'null' then false
          when 'boolean' then false
          when 'number' then abs((entry.value #>> '{}')::numeric) >= 1000000000
          when 'string' then
            (entry.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and (
              (entry.value #>> '{}') !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,63}$'
              or (entry.value #>> '{}') ~ '([0-9][_.:-]?){10,}'
            )
          else true
        end
    );
$$;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  -- Restrict: deleting a tenant must not silently erase its trail. Retention
  -- and tenant erasure are explicit jobs (P3.4).
  organization_id uuid not null references public.organizations (id) on delete restrict,
  site_id uuid,
  actor_type text not null check (actor_type in ('user', 'system', 'agent')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null
    check (char_length(action) <= 80 and action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{0,39}$'),
  entity_id uuid,
  outcome text not null check (outcome in ('success', 'denied', 'failure')),
  request_id uuid,
  trace_id text check (trace_id ~ '^[0-9a-f]{32}$'),
  metadata jsonb not null default '{}'::jsonb
    check (private.is_safe_audit_metadata(metadata)),
  occurred_at timestamptz not null default now(),
  check (actor_user_id is null or actor_type = 'user'),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete set null (site_id)
);

create index audit_events_organization_occurred_idx
  on public.audit_events (organization_id, occurred_at desc, id);
create index audit_events_organization_site_idx
  on public.audit_events (organization_id, site_id);
create index audit_events_actor_user_idx
  on public.audit_events (actor_user_id);

create table public.llm_call_metrics (
  -- Set by the server, so a retried write of one call cannot count twice.
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid,
  request_id uuid not null,
  trace_id text not null check (trace_id ~ '^[0-9a-f]{32}$'),
  provider text not null check (provider ~ '^[a-z][a-z0-9_.-]{0,39}$'),
  model text not null check (model ~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$'),
  purpose text not null check (purpose ~ '^[a-z][a-z0-9_]{0,39}$'),
  attempt smallint not null default 1 check (attempt between 1 and 100),
  outcome text not null check (
    outcome in (
      'completed', 'timeout', 'refusal', 'rate_limited', 'unavailable',
      'budget_exceeded', 'invalid_output'
    )
  ),
  -- Unknown usage and cost stay null. Zero would read as free.
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  cost_micros bigint check (cost_micros >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  pricing_version text check (pricing_version ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'),
  is_simulated boolean not null,
  occurred_at timestamptz not null default now(),
  check (num_nulls(input_tokens, output_tokens, cached_input_tokens) in (0, 3)),
  check (cached_input_tokens <= input_tokens),
  check (cost_micros is null or input_tokens is not null),
  check ((cost_micros is null) = (pricing_version is null)),
  check (outcome <> 'completed' or input_tokens is not null),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete set null (site_id)
);

create index llm_call_metrics_organization_occurred_idx
  on public.llm_call_metrics (organization_id, occurred_at desc, id);
create index llm_call_metrics_organization_site_idx
  on public.llm_call_metrics (organization_id, site_id);

-- The actor is read from the verified session, never from a parameter. A change
-- made without a user (seed, job, service role) is recorded as `system`.
create function private.write_row_audit(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
begin
  -- The tenant itself is being deleted and cascades to this row.
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    return;
  end if;

  select profile.id into actor
  from public.profiles as profile
  where profile.id = (select auth.uid());

  insert into public.audit_events (
    organization_id, actor_type, actor_user_id, action, entity_type, entity_id,
    outcome, metadata
  ) values (
    p_organization_id,
    case when actor is null then 'system' else 'user' end,
    actor,
    p_action,
    p_entity_type,
    p_entity_id,
    'success',
    p_metadata
  );
end;
$$;

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_row_audit(
      new.organization_id, 'membership.created', 'membership', new.user_id,
      jsonb_build_object('role', new.role)
    );
  elsif tg_op = 'DELETE' then
    perform private.write_row_audit(
      old.organization_id, 'membership.removed', 'membership', old.user_id,
      jsonb_build_object('role', old.role)
    );
  elsif new.role is distinct from old.role then
    perform private.write_row_audit(
      new.organization_id, 'membership.role_changed', 'membership', new.user_id,
      jsonb_build_object('previous_role', old.role, 'role', new.role)
    );
  end if;
  return null;
end;
$$;

create function private.audit_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'invitation.created';
  elsif old.accepted_at is null and new.accepted_at is not null then
    audit_action := 'invitation.accepted';
  elsif old.revoked_at is null and new.revoked_at is not null then
    audit_action := 'invitation.revoked';
  else
    return null;
  end if;

  perform private.write_row_audit(
    new.organization_id, audit_action, 'invitation', new.id,
    jsonb_build_object('role', new.role)
  );
  return null;
end;
$$;

create trigger cael_audit_membership_change
  after insert or update or delete on public.memberships
  for each row execute function private.audit_membership_change();

create trigger cael_audit_invitation_change
  after insert or update on public.organization_invitations
  for each row execute function private.audit_invitation_change();

alter table public.audit_events enable row level security;
alter table public.llm_call_metrics enable row level security;

-- The membership subquery is evaluated once per statement, not once per row.
create policy audit_events_select_manager
on public.audit_events for select
to authenticated
using (
  (select private.has_active_session())
  and organization_id in (
    select membership.organization_id
    from public.memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
);

create policy llm_call_metrics_select_manager
on public.llm_call_metrics for select
to authenticated
using (
  (select private.has_active_session())
  and organization_id in (
    select membership.organization_id
    from public.memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
);

revoke all on table public.audit_events from public, anon, authenticated, service_role;
revoke all on table public.llm_call_metrics from public, anon, authenticated, service_role;

grant select on table public.audit_events to authenticated, service_role;
grant select on table public.llm_call_metrics to authenticated, service_role;

-- `occurred_at` (and the audit id) always come from the database.
grant insert (
  organization_id, site_id, actor_type, actor_user_id, action, entity_type,
  entity_id, outcome, request_id, trace_id, metadata
) on table public.audit_events to service_role;
grant insert (
  id, organization_id, site_id, request_id, trace_id, provider, model, purpose,
  attempt, outcome, input_tokens, output_tokens, cached_input_tokens,
  latency_ms, cost_micros, pricing_version, is_simulated
) on table public.llm_call_metrics to service_role;

revoke all on function private.is_safe_audit_metadata(jsonb) from public;
revoke all on function private.write_row_audit(uuid, text, text, uuid, jsonb) from public;
revoke all on function private.audit_membership_change() from public;
revoke all on function private.audit_invitation_change() from public;

-- Check constraints run as the inserting role.
grant execute on function private.is_safe_audit_metadata(jsonb) to service_role;
