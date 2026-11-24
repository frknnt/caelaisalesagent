-- P0.5: domain-locked site keys, public widget sessions and rate limits.
--
-- The anon role loses its only RPC: a hostname in a parameter proves nothing
-- and let anyone ask which domains use Cael. The widget now talks to the
-- application server, which checks the browser's Origin, the key, the domain
-- and the rate limit in one service-role call.

drop function public.get_widget_bootstrap(text);
drop function private.lookup_widget_bootstrap(text);

-- Sites: theme tokens and the way to a person ---------------------------------

alter table public.sites
  add column widget_accent_color text not null default '#0b0c0f'
    check (widget_accent_color ~ '^#[0-9a-f]{6}$'),
  add column widget_position text not null default 'bottom-right'
    check (widget_position in ('bottom-right', 'bottom-left')),
  add column handoff_url text
    check (char_length(handoff_url) <= 300 and handoff_url ~ '^https://[^[:space:]"<>\\]+$');

-- Domains ---------------------------------------------------------------------

-- Until now a client could write `verified_at` itself, so the old value proves
-- nothing. Only rows with a `verification_method` count; existing rows keep
-- their timestamp but stay closed until they are verified.
alter table public.domains
  drop constraint domains_hostname_key,
  add column environment text not null default 'production'
    check (environment in ('production', 'preview')),
  add column allow_subdomains boolean not null default false,
  add column verification_token text not null
    default replace(gen_random_uuid()::text, '-', '')
    check (verification_token ~ '^[0-9a-f]{32}$'),
  add column verification_method text
    check (verification_method in ('dns_txt', 'operator')),
  add column expires_at timestamptz,
  add constraint domains_verification_complete
    check (verification_method is null or verified_at is not null),
  add constraint domains_subdomains_need_verification
    check (not allow_subdomains or verification_method is not null),
  -- Preview hosts are exact, temporary and never verified.
  add constraint domains_preview_rules check (
    case environment
      when 'preview' then
        expires_at is not null
        and expires_at > created_at
        and expires_at <= created_at + interval '30 days'
        and verification_method is null
        and not allow_subdomains
        and not is_primary
      else expires_at is null
    end
  ),
  add constraint domains_site_hostname_key unique (site_id, hostname);

-- Not valid: applies to new rows without failing on an old one.
alter table public.domains
  add constraint domains_hostname_is_a_name
    check (char_length(hostname) <= 253 and hostname !~ '\.[0-9]+$') not valid;

-- Uniqueness of unproven claims would let one tenant probe or block another.
create unique index domains_verified_hostname_key
  on public.domains (hostname)
  where verification_method is not null;

-- Site keys -------------------------------------------------------------------

-- Public by design: a key selects a site, it does not authenticate anyone.
create table public.site_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  public_key text not null unique
    default 'cael_pk_' || replace(gen_random_uuid()::text, '-', '')
    check (public_key ~ '^cael_pk_[0-9a-f]{32}$'),
  -- A key works only on domains of its own environment.
  environment text not null check (environment in ('production', 'preview')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > created_at),
  check (
    environment = 'production'
    or (expires_at is not null and expires_at <= created_at + interval '30 days')
  ),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete cascade
);

create index site_keys_organization_site_idx
  on public.site_keys (organization_id, site_id);
create index site_keys_created_by_idx
  on public.site_keys (created_by);

-- Widget sessions -------------------------------------------------------------

-- Technical access sessions: no visitor identity, no content, no IP address.
-- Visitor sessions and conversations (P1.4) refer to these rows.
create table public.widget_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  site_key_id uuid not null references public.site_keys (id) on delete cascade,
  -- Unique: a bootstrap token buys exactly one session.
  bootstrap_id uuid not null unique,
  origin text not null check (char_length(origin) between 8 and 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '1 hour'),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete cascade
);

create index widget_sessions_organization_site_created_idx
  on public.widget_sessions (organization_id, site_id, created_at desc);
create index widget_sessions_site_key_idx
  on public.widget_sessions (site_key_id);
create index widget_sessions_expires_idx
  on public.widget_sessions (expires_at);

-- Rate limits -----------------------------------------------------------------

-- Buckets hold a keyed daily hash of the client network, never an address.
create table private.widget_rate_counters (
  bucket text not null check (char_length(bucket) between 3 and 160),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  used integer not null check (used > 0),
  primary key (bucket, window_start)
);

create index widget_rate_counters_expires_idx
  on private.widget_rate_counters (expires_at);

alter table private.widget_rate_counters enable row level security;
revoke all on table private.widget_rate_counters
  from public, anon, authenticated, service_role;

-- 0 when the call is within the limit, otherwise the seconds to wait. One
-- statement takes the row lock, so every application instance shares the count.
create function private.consume_widget_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  window_end timestamptz := current_window + make_interval(secs => p_window_seconds);
  is_new boolean;
begin
  insert into private.widget_rate_counters as counter (
    bucket, window_start, expires_at, used
  ) values (p_bucket, current_window, window_end, 1)
  on conflict (bucket, window_start) do update
    set used = counter.used + 1
    where counter.used < p_limit
  returning counter.used = 1 into is_new;

  if is_new is null then
    return greatest(1, ceil(extract(epoch from window_end - now()))::integer);
  end if;

  -- Finished windows are removed as new ones open, so hashes do not pile up.
  if is_new then
    delete from private.widget_rate_counters
    where ctid in (
      select expired.ctid
      from private.widget_rate_counters as expired
      where expired.expires_at < now()
      limit 50
      for update skip locked
    );
  end if;
  return 0;
end;
$$;

-- Lookups ---------------------------------------------------------------------

create function private.is_widget_host_allowed(
  p_site_id uuid,
  p_environment text,
  p_hostname text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.domains as domain
    where domain.site_id = p_site_id
      and domain.environment = p_environment
      and case p_environment
        when 'preview' then
          domain.hostname = p_hostname and domain.expires_at > now()
        else
          domain.verification_method is not null
          and (
            domain.hostname = p_hostname
            -- One label below the verified name, never deeper.
            or (
              domain.allow_subdomains
              and domain.hostname = substring(p_hostname from '^[^.]+\.(.+)$')
            )
          )
      end
  );
$$;

-- The one definition of "this key may be used on this host right now".
create function private.active_widget_site(p_site_key_id uuid, p_hostname text)
returns table (
  organization_id uuid,
  site_id uuid,
  site_key_id uuid,
  environment text,
  site_name text,
  widget_title text,
  locale text,
  accent_color text,
  widget_position text,
  handoff_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    site.organization_id,
    site.id,
    site_key.id,
    site_key.environment,
    site.public_name,
    site.widget_title,
    site.default_locale,
    site.widget_accent_color,
    site.widget_position,
    site.handoff_url
  from public.site_keys as site_key
  inner join public.sites as site
    on site.id = site_key.site_id
    and site.organization_id = site_key.organization_id
  where site_key.id = p_site_key_id
    and site_key.revoked_at is null
    and (site_key.expires_at is null or site_key.expires_at > now())
    and site.is_active
    and private.is_widget_host_allowed(site.id, site_key.environment, p_hostname);
$$;

create function private.assert_client_hash(p_client_hash text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_client_hash is not null and p_client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_client_hash' using errcode = '22023';
  end if;
end;
$$;

-- Service role only. Every refusal looks the same to the caller: an unknown
-- key, a revoked key, a foreign host and an inactive site are all `denied`.
create function public.widget_bootstrap(
  p_public_key text,
  p_hostname text,
  p_client_hash text
)
returns table (
  outcome text,
  retry_after integer,
  organization_id uuid,
  site_id uuid,
  site_key_id uuid,
  environment text,
  site_name text,
  widget_title text,
  locale text,
  accent_color text,
  widget_position text,
  handoff_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := 0;
  found_site record;
begin
  perform private.assert_client_hash(p_client_hash);

  -- The client pays first, so one client cannot spend a site's whole budget.
  if p_client_hash is not null then
    wait := private.consume_widget_rate_limit(
      'bootstrap:client:' || p_client_hash, 240, 60
    );
    if wait > 0 then
      return query select 'rate_limited'::text, wait, null::uuid, null::uuid,
        null::uuid, null::text, null::text, null::text, null::text, null::text,
        null::text, null::text;
      return;
    end if;
  end if;

  select active.* into found_site
  from public.site_keys as site_key
  cross join lateral private.active_widget_site(site_key.id, p_hostname) as active
  where site_key.public_key = p_public_key;

  if found_site.site_id is null then
    return query select 'denied'::text, 0, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::text, null::text, null::text, null::text,
      null::text;
    return;
  end if;

  if p_client_hash is not null then
    wait := private.consume_widget_rate_limit(
      'bootstrap:site:' || found_site.site_id || ':client:' || p_client_hash, 60, 60
    );
  end if;
  if wait = 0 then
    wait := private.consume_widget_rate_limit(
      'bootstrap:site:' || found_site.site_id, 6000, 60
    );
  end if;
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::uuid,
      null::uuid, null::text, null::text, null::text, null::text, null::text,
      null::text, null::text;
    return;
  end if;

  return query select 'allowed'::text, 0, found_site.organization_id,
    found_site.site_id, found_site.site_key_id, found_site.environment,
    found_site.site_name, found_site.widget_title, found_site.locale,
    found_site.accent_color, found_site.widget_position, found_site.handoff_url;
end;
$$;

-- What the frame shows. Runs after a signed ticket was verified.
create function public.widget_frame(
  p_site_key_id uuid,
  p_hostname text,
  p_client_hash text
)
returns table (
  outcome text,
  retry_after integer,
  site_id uuid,
  site_name text,
  widget_title text,
  locale text,
  accent_color text,
  handoff_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := 0;
begin
  perform private.assert_client_hash(p_client_hash);
  if p_client_hash is not null then
    wait := private.consume_widget_rate_limit('frame:client:' || p_client_hash, 240, 60);
  else
    wait := private.consume_widget_rate_limit('frame:key:' || p_site_key_id, 6000, 60);
  end if;
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::text,
      null::text, null::text, null::text, null::text;
    return;
  end if;

  return query
  select 'allowed'::text, 0, active.site_id, active.site_name, active.widget_title,
    active.locale, active.accent_color, active.handoff_url
  from private.active_widget_site(p_site_key_id, p_hostname) as active;
  if not found then
    return query select 'denied'::text, 0, null::uuid, null::text, null::text,
      null::text, null::text, null::text;
  end if;
end;
$$;

create function public.create_widget_session(
  p_site_key_id uuid,
  p_hostname text,
  p_origin text,
  p_bootstrap_id uuid,
  p_client_hash text,
  p_ttl_seconds integer
)
returns table (
  outcome text,
  retry_after integer,
  session_id uuid,
  site_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := 0;
  found_site record;
  created public.widget_sessions;
begin
  perform private.assert_client_hash(p_client_hash);
  if p_ttl_seconds not between 60 and 3600 then
    raise exception 'invalid_session_ttl' using errcode = '22023';
  end if;

  select active.* into found_site
  from private.active_widget_site(p_site_key_id, p_hostname) as active;

  if found_site.site_id is null then
    return query select 'denied'::text, 0, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  if p_client_hash is not null then
    wait := private.consume_widget_rate_limit(
      'session:site:' || found_site.site_id || ':client:' || p_client_hash, 30, 600
    );
  end if;
  if wait = 0 then
    wait := private.consume_widget_rate_limit(
      'session:site:' || found_site.site_id, 1200, 60
    );
  end if;
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.widget_sessions (
    organization_id, site_id, site_key_id, bootstrap_id, origin, expires_at
  ) values (
    found_site.organization_id, found_site.site_id, p_site_key_id,
    p_bootstrap_id, p_origin, now() + make_interval(secs => p_ttl_seconds)
  )
  on conflict (bootstrap_id) do nothing
  returning * into created;

  if created.id is null then
    return query select 'replayed'::text, 0, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  return query select 'allowed'::text, 0, created.id, created.site_id, created.expires_at;
end;
$$;

-- Live check behind every use of a session token: the session, its key, its
-- host and its site must all still be valid.
create function public.check_widget_session(
  p_session_id uuid,
  p_site_key_id uuid,
  p_origin text,
  p_hostname text
)
returns table (
  outcome text,
  retry_after integer,
  organization_id uuid,
  site_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := 0;
  live record;
begin
  select active.organization_id, active.site_id, session.expires_at into live
  from public.widget_sessions as session
  cross join lateral private.active_widget_site(session.site_key_id, p_hostname) as active
  where session.id = p_session_id
    and session.site_key_id = p_site_key_id
    and session.origin = p_origin
    and session.site_id = active.site_id
    and session.revoked_at is null
    and session.expires_at > now();

  if live.site_id is null then
    return query select 'denied'::text, 0, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  wait := private.consume_widget_rate_limit('check:session:' || p_session_id, 120, 60);
  if wait > 0 then
    return query select 'rate_limited'::text, wait, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;

  return query select 'allowed'::text, 0, live.organization_id, live.site_id, live.expires_at;
end;
$$;

-- Retention (P3.4 schedules it): sessions end after at most one hour and are
-- kept 30 days for abuse review; finished rate windows go immediately.
create function public.purge_widget_runtime()
returns table (removed_sessions bigint, removed_counters bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with sessions as (
    delete from public.widget_sessions as session
    where session.expires_at < now() - interval '30 days'
    returning 1
  ), counters as (
    delete from private.widget_rate_counters as counter
    where counter.expires_at < now()
    returning 1
  )
  select (select count(*) from sessions), (select count(*) from counters);
end;
$$;

-- Key and preview management --------------------------------------------------

-- Organization of a site the caller may manage. A foreign and a missing site
-- fail the same way.
create function private.require_site_manager(p_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed_organization uuid;
begin
  if not (select private.has_active_session()) then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  select site.organization_id into managed_organization
  from public.sites as site
  where site.id = p_site_id
    and private.has_organization_role(site.organization_id, array['owner', 'admin'])
  for update;
  if managed_organization is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return managed_organization;
end;
$$;

create function public.create_site_key(
  p_site_id uuid,
  p_environment text,
  p_expires_at timestamptz default null
)
returns public.site_keys
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed_organization uuid := private.require_site_manager(p_site_id);
  created public.site_keys;
begin
  if (
    select count(*) from public.site_keys as site_key
    where site_key.site_id = p_site_id
      and site_key.environment = p_environment
      and site_key.revoked_at is null
      and (site_key.expires_at is null or site_key.expires_at > now())
  ) >= 5 then
    raise exception 'too_many_active_keys' using errcode = '54000';
  end if;

  insert into public.site_keys (
    organization_id, site_id, environment, created_by, expires_at
  ) values (
    managed_organization, p_site_id, p_environment, (select auth.uid()), p_expires_at
  )
  returning * into created;
  return created;
end;
$$;

create function public.revoke_site_key(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_site uuid;
begin
  select site_key.site_id into key_site
  from public.site_keys as site_key
  where site_key.id = p_key_id;
  perform private.require_site_manager(key_site);
  update public.site_keys
  set revoked_at = now()
  where id = p_key_id and revoked_at is null;
end;
$$;

-- A preview host needs no DNS proof (nobody controls the DNS of a shared
-- preview suffix), so it is limited to owners and admins, to exact names, to
-- 30 days and to preview keys.
create function public.add_preview_domain(
  p_site_id uuid,
  p_hostname text,
  p_expires_at timestamptz
)
returns public.domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed_organization uuid := private.require_site_manager(p_site_id);
  created public.domains;
begin
  insert into public.domains (
    organization_id, site_id, hostname, environment, expires_at
  ) values (
    managed_organization, p_site_id, lower(btrim(p_hostname)), 'preview', p_expires_at
  )
  returning * into created;
  return created;
end;
$$;

-- Audit -----------------------------------------------------------------------

create function private.audit_domain_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_row_audit(
      new.organization_id, 'domain.added', 'domain', new.id,
      jsonb_build_object(
        'environment', new.environment,
        'verified', new.verification_method is not null
      )
    );
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform private.write_row_audit(
      old.organization_id, 'domain.removed', 'domain', old.id,
      jsonb_build_object(
        'environment', old.environment,
        'verified', old.verification_method is not null
      )
    );
    return null;
  end if;
  if new.verification_method is distinct from old.verification_method then
    perform private.write_row_audit(
      new.organization_id,
      case
        when new.verification_method is null then 'domain.verification_removed'
        else 'domain.verified'
      end,
      'domain', new.id,
      jsonb_build_object('method', coalesce(new.verification_method, old.verification_method))
    );
  end if;
  if new.allow_subdomains is distinct from old.allow_subdomains then
    perform private.write_row_audit(
      new.organization_id, 'domain.subdomains_changed', 'domain', new.id,
      jsonb_build_object('allowed', new.allow_subdomains)
    );
  end if;
  if (new.hostname, new.site_id, new.environment, new.expires_at)
    is distinct from (old.hostname, old.site_id, old.environment, old.expires_at) then
    perform private.write_row_audit(
      new.organization_id, 'domain.changed', 'domain', new.id,
      jsonb_build_object('environment', new.environment)
    );
  end if;
  return null;
end;
$$;

create function private.audit_site_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_row_audit(
      new.organization_id, 'site_key.created', 'site_key', new.id,
      jsonb_build_object('environment', new.environment)
    );
  elsif tg_op = 'DELETE' then
    perform private.write_row_audit(
      old.organization_id, 'site_key.removed', 'site_key', old.id,
      jsonb_build_object('environment', old.environment)
    );
  elsif new.revoked_at is distinct from old.revoked_at then
    perform private.write_row_audit(
      new.organization_id,
      case when new.revoked_at is null then 'site_key.restored' else 'site_key.revoked' end,
      'site_key', new.id,
      jsonb_build_object('environment', new.environment)
    );
  end if;
  return null;
end;
$$;

create trigger cael_audit_domain_change
  after insert or update or delete on public.domains
  for each row execute function private.audit_domain_change();

create trigger cael_audit_site_key_change
  after insert or update or delete on public.site_keys
  for each row execute function private.audit_site_key_change();

-- RLS and grants --------------------------------------------------------------

alter table public.site_keys enable row level security;
alter table public.widget_sessions enable row level security;

create policy site_keys_select_member
on public.site_keys for select
to authenticated
using ((select private.has_active_session()) and organization_id in (
  select membership.organization_id
  from public.memberships as membership
  where membership.user_id = (select auth.uid())
));

create policy widget_sessions_select_manager
on public.widget_sessions for select
to authenticated
using ((select private.has_active_session()) and organization_id in (
  select membership.organization_id
  from public.memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.role in ('owner', 'admin')
));

revoke all on table public.site_keys from public, anon, authenticated, service_role;
revoke all on table public.widget_sessions from public, anon, authenticated, service_role;

grant select on table public.site_keys to authenticated, service_role;
grant select on table public.widget_sessions to authenticated, service_role;
grant update (revoked_at) on table public.widget_sessions to service_role;

-- Verification, wildcard, environment and expiry are decided by the server or
-- by the functions above. A client may only claim a name and mark a primary.
revoke insert, update on table public.domains from authenticated;
grant insert (id, organization_id, site_id, hostname, is_primary)
  on table public.domains to authenticated;
grant update (is_primary) on table public.domains to authenticated;

revoke all on function private.consume_widget_rate_limit(text, integer, integer) from public;
revoke all on function private.is_widget_host_allowed(uuid, text, text) from public;
revoke all on function private.active_widget_site(uuid, text) from public;
revoke all on function private.assert_client_hash(text) from public;
revoke all on function private.require_site_manager(uuid) from public;
revoke all on function private.audit_domain_change() from public;
revoke all on function private.audit_site_key_change() from public;

revoke all on function public.widget_bootstrap(text, text, text) from public, anon, authenticated;
revoke all on function public.widget_frame(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_widget_session(uuid, text, text, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.check_widget_session(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.purge_widget_runtime() from public, anon, authenticated;
revoke all on function public.create_site_key(uuid, text, timestamptz) from public, anon;
revoke all on function public.revoke_site_key(uuid) from public, anon;
revoke all on function public.add_preview_domain(uuid, text, timestamptz) from public, anon;

grant execute on function public.widget_bootstrap(text, text, text) to service_role;
grant execute on function public.widget_frame(uuid, text, text) to service_role;
grant execute on function public.create_widget_session(uuid, text, text, uuid, text, integer)
  to service_role;
grant execute on function public.check_widget_session(uuid, uuid, text, text) to service_role;
grant execute on function public.purge_widget_runtime() to service_role;
grant execute on function public.create_site_key(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_site_key(uuid) to authenticated;
grant execute on function public.add_preview_domain(uuid, text, timestamptz) to authenticated;
