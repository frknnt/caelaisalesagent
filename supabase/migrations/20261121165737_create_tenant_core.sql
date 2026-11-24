create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  public_name text not null check (char_length(public_name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx
  on public.memberships (user_id, organization_id);
create index memberships_organization_role_idx
  on public.memberships (organization_id, role);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  public_name text not null check (char_length(public_name) between 2 and 120),
  widget_title text not null check (char_length(widget_title) between 2 and 120),
  default_locale text not null default 'tr-TR'
    check (default_locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index sites_organization_name_key
  on public.sites (organization_id, lower(name));

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  site_id uuid not null,
  hostname text not null unique
    check (
      hostname = lower(hostname)
      and hostname = btrim(hostname)
      and hostname ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    ),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, site_id)
    references public.sites (organization_id, id)
    on delete cascade
);

create index domains_organization_site_idx
  on public.domains (organization_id, site_id);
create unique index domains_one_primary_per_site_key
  on public.domains (site_id)
  where is_primary;

create function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;

create function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role = any (p_roles)
  );
$$;

create function private.shares_organization(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as viewer_membership
    inner join public.memberships as profile_membership
      on profile_membership.organization_id = viewer_membership.organization_id
    where viewer_membership.user_id = (select auth.uid())
      and profile_membership.user_id = p_profile_id
  );
$$;

create function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Cael user'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger cael_create_profile_after_auth_user
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create function private.lookup_widget_bootstrap(p_hostname text)
returns table (
  site_id uuid,
  site_name text,
  widget_title text,
  locale text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    site.id,
    site.public_name,
    site.widget_title,
    site.default_locale
  from public.domains as domain
  inner join public.sites as site
    on site.id = domain.site_id
    and site.organization_id = domain.organization_id
  where domain.hostname = lower(btrim(p_hostname))
    and domain.verified_at is not null
    and site.is_active
  limit 1;
$$;

create function public.get_widget_bootstrap(p_hostname text)
returns table (
  site_id uuid,
  site_name text,
  widget_title text,
  locale text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.lookup_widget_bootstrap(p_hostname);
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.domains enable row level security;

create policy organizations_select_member
on public.organizations for select
to authenticated
using ((select private.is_organization_member(id)));

create policy organizations_update_admin
on public.organizations for update
to authenticated
using ((select private.has_organization_role(id, array['owner', 'admin'])))
with check ((select private.has_organization_role(id, array['owner', 'admin'])));

create policy profiles_select_shared_organization
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_organization(id))
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy memberships_select_member
on public.memberships for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy memberships_insert_owner
on public.memberships for insert
to authenticated
with check ((select private.has_organization_role(organization_id, array['owner'])));

create policy memberships_update_owner
on public.memberships for update
to authenticated
using ((select private.has_organization_role(organization_id, array['owner'])))
with check ((select private.has_organization_role(organization_id, array['owner'])));

create policy memberships_delete_owner
on public.memberships for delete
to authenticated
using (
  user_id <> (select auth.uid())
  and (select private.has_organization_role(organization_id, array['owner']))
);

create policy sites_select_member
on public.sites for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy sites_insert_admin
on public.sites for insert
to authenticated
with check (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

create policy sites_update_admin
on public.sites for update
to authenticated
using (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
)
with check (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

create policy sites_delete_admin
on public.sites for delete
to authenticated
using (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

create policy domains_select_member
on public.domains for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy domains_insert_admin
on public.domains for insert
to authenticated
with check (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

create policy domains_update_admin
on public.domains for update
to authenticated
using (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
)
with check (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

create policy domains_delete_admin
on public.domains for delete
to authenticated
using (
  (select private.has_organization_role(organization_id, array['owner', 'admin']))
);

revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

grant select, update on table public.organizations to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.memberships to authenticated;
grant select, insert, update, delete on table public.sites to authenticated;
grant select, insert, update, delete on table public.domains to authenticated;

grant all on table public.organizations to service_role;
grant all on table public.profiles to service_role;
grant all on table public.memberships to service_role;
grant all on table public.sites to service_role;
grant all on table public.domains to service_role;

revoke all on function private.is_organization_member(uuid) from public;
revoke all on function private.has_organization_role(uuid, text[]) from public;
revoke all on function private.shares_organization(uuid) from public;
revoke all on function private.create_profile_for_auth_user() from public;
revoke all on function private.lookup_widget_bootstrap(text) from public;
revoke all on function public.get_widget_bootstrap(text) from public;

grant execute on function private.is_organization_member(uuid) to authenticated, service_role;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.shares_organization(uuid) to authenticated, service_role;
grant execute on function private.lookup_widget_bootstrap(text) to anon, authenticated, service_role;
grant execute on function public.get_widget_bootstrap(text) to anon, authenticated, service_role;
