-- P0.3: authenticated sessions, five-role RBAC, invitations, and tenant context.
-- Existing generic `member` rows intentionally migrate to least-privilege `viewer`.

alter table public.memberships
  drop constraint memberships_role_check;

update public.memberships
set role = 'viewer'
where role = 'member';

alter table public.memberships
  add constraint memberships_role_check
  check (role in ('owner', 'admin', 'editor', 'sales', 'viewer'));

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  role text not null check (role in ('admin', 'editor', 'sales', 'viewer')),
  invited_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);

create unique index organization_invitations_pending_email_key
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create index organization_invitations_organization_created_idx
  on public.organization_invitations (organization_id, created_at desc);

create function private.has_active_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions as session
    where session.id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
      and session.user_id = (select auth.uid())
      and (session.not_after is null or session.not_after > now())
  );
$$;

create or replace function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_active_session()) and exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_active_session()) and exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role = any (p_roles)
  );
$$;

create or replace function private.shares_organization(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_active_session()) and exists (
    select 1
    from public.memberships as viewer_membership
    inner join public.memberships as profile_membership
      on profile_membership.organization_id = viewer_membership.organization_id
    where viewer_membership.user_id = (select auth.uid())
      and profile_membership.user_id = p_profile_id
  );
$$;

create function public.get_authorization_context()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select organization.id, organization.name, organization.slug, membership.role
  from public.memberships as membership
  inner join public.organizations as organization on organization.id = membership.organization_id
  where membership.user_id = (select auth.uid())
    and (select private.has_active_session())
  order by organization.name, organization.id;
$$;

create function public.create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_expires_at timestamptz
)
returns public.organization_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations;
  normalized_email text := lower(btrim(p_email));
  actor_role text;
begin
  if not (select private.has_active_session()) then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select membership.role into actor_role
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid());

  if actor_role is null
    or actor_role not in ('owner', 'admin')
    or p_role not in ('admin', 'editor', 'sales', 'viewer')
    or (actor_role = 'admin' and p_role = 'admin') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'invalid_invitation_expiry' using errcode = '22023';
  end if;

  insert into public.organization_invitations (
    organization_id, email, role, invited_by, expires_at
  ) values (
    p_organization_id, normalized_email, p_role, (select auth.uid()), p_expires_at
  )
  returning * into invitation;

  return invitation;
end;
$$;

create function public.accept_organization_invitation(p_invitation_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations;
  accepted_membership public.memberships;
  actor_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if not (select private.has_active_session()) then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into invitation
  from public.organization_invitations
  where id = p_invitation_id
  for update;

  if invitation.id is null
    or invitation.revoked_at is not null
    or invitation.accepted_at is not null
    or invitation.expires_at <= now()
    or invitation.email <> actor_email then
    raise exception 'invitation_invalid' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (invitation.organization_id, (select auth.uid()), invitation.role)
  on conflict (organization_id, user_id) do nothing
  returning * into accepted_membership;

  if accepted_membership.user_id is null then
    raise exception 'membership_exists' using errcode = '23505';
  end if;

  update public.organization_invitations
  set accepted_at = now(), accepted_by = (select auth.uid())
  where id = invitation.id;

  return accepted_membership;
end;
$$;

create function public.change_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  changed_membership public.memberships;
begin
  if not (select private.has_active_session()) then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'self_role_change_forbidden' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'editor', 'sales', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select membership.role into actor_role
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid());
  select membership.role into target_role
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_user_id;

  if actor_role is null or target_role is null
    or actor_role not in ('owner', 'admin')
    or (actor_role = 'admin' and (target_role in ('owner', 'admin') or p_role in ('owner', 'admin'))) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if target_role = 'owner' and p_role <> 'owner' and (
    select count(*) from public.memberships
    where organization_id = p_organization_id and role = 'owner'
  ) <= 1 then
    raise exception 'last_owner_required' using errcode = '23514';
  end if;

  update public.memberships
  set role = p_role
  where organization_id = p_organization_id and user_id = p_user_id
  returning * into changed_membership;
  return changed_membership;
end;
$$;

create function public.remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
begin
  if not (select private.has_active_session()) then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'self_removal_forbidden' using errcode = '42501';
  end if;
  select role into actor_role from public.memberships
    where organization_id = p_organization_id and user_id = (select auth.uid());
  select role into target_role from public.memberships
    where organization_id = p_organization_id and user_id = p_user_id;

  if actor_role is null or target_role is null
    or actor_role not in ('owner', 'admin')
    or (actor_role = 'admin' and target_role in ('owner', 'admin')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if target_role = 'owner' and (
    select count(*) from public.memberships
    where organization_id = p_organization_id and role = 'owner'
  ) <= 1 then
    raise exception 'last_owner_required' using errcode = '23514';
  end if;

  delete from public.memberships
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;

create function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations;
begin
  select * into invitation from public.organization_invitations where id = p_invitation_id;
  if invitation.id is null or invitation.accepted_at is not null
    or not (select private.has_organization_role(invitation.organization_id, array['owner', 'admin'])) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.organization_invitations set revoked_at = now()
  where id = p_invitation_id and revoked_at is null;
end;
$$;

alter table public.organization_invitations enable row level security;

drop policy memberships_insert_owner on public.memberships;
drop policy memberships_update_owner on public.memberships;
drop policy memberships_delete_owner on public.memberships;

drop policy sites_insert_admin on public.sites;
drop policy sites_update_admin on public.sites;
drop policy sites_delete_admin on public.sites;
drop policy domains_insert_admin on public.domains;
drop policy domains_update_admin on public.domains;
drop policy domains_delete_admin on public.domains;

create policy sites_insert_editor on public.sites for insert to authenticated
with check ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));
create policy sites_update_editor on public.sites for update to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));
create policy sites_delete_editor on public.sites for delete to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));

create policy domains_insert_editor on public.domains for insert to authenticated
with check ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));
create policy domains_update_editor on public.domains for update to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));
create policy domains_delete_editor on public.domains for delete to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'editor'])));

create policy organization_invitations_select_manager
on public.organization_invitations for select to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin'])));

revoke insert, update, delete on table public.memberships from authenticated;
grant select on table public.organization_invitations to authenticated;
grant all on table public.organization_invitations to service_role;

revoke all on function private.has_active_session() from public;
revoke all on function public.get_authorization_context() from public;
revoke all on function public.create_organization_invitation(uuid, text, text, timestamptz) from public;
revoke all on function public.accept_organization_invitation(uuid) from public;
revoke all on function public.change_organization_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_organization_member(uuid, uuid) from public;
revoke all on function public.revoke_organization_invitation(uuid) from public;

grant execute on function private.has_active_session() to authenticated, service_role;
grant execute on function public.get_authorization_context() to authenticated, service_role;
grant execute on function public.create_organization_invitation(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;
grant execute on function public.change_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
