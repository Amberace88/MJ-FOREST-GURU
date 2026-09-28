-- ============================================================================
-- MJ FOREST GURU — 0100 Core: organizations, profiles, roles, permissions
-- ============================================================================
-- Conventions
--   * Every company-specific table carries organization_id (multi-tenant ready)
--   * All timestamps are timestamptz (stored UTC)
--   * Status/enum-like columns are text + CHECK (easy to extend, i18n in UI)
--   * Helper functions live in the private `app` schema (not exposed by API)
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Harden defaults: anonymous clients never need direct table access.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- generic updated_at trigger ---------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ORGANIZATIONS ----------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function app.touch_updated_at();

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  legal_name text,
  registration_number text,
  default_language text not null default 'lv' check (default_language in ('lv','sv','en','is')),
  default_timezone text not null default 'Europe/Riga',
  default_currency text not null default 'EUR' check (default_currency in ('EUR','SEK','ISK')),
  overtime_after_hours numeric(4,2) not null default 8 check (overtime_after_hours between 1 and 24),
  max_shift_hours numeric(4,2) not null default 12 check (max_shift_hours between 1 and 24),
  missing_checkout_after_hours numeric(4,2) not null default 13 check (missing_checkout_after_hours between 1 and 48),
  service_warning_hours integer not null default 50 check (service_warning_hours >= 0),
  alert_config jsonb not null default '{}'::jsonb,
  setup_step integer not null default 1,
  setup_completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger trg_org_settings_updated before update on public.organization_settings
  for each row execute function app.touch_updated_at();

-- COUNTRIES (per organization, extensible) ---------------------------------------
create table public.countries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{2}$'),
  name text not null,
  flag text,
  timezone text not null,
  currency text not null check (currency in ('EUR','SEK','ISK')),
  -- which optional site-identification fields this country uses, e.g.
  -- ["cirsmas_numurs","kadastra_numurs"] for LV, ["fastighet"] for SE
  site_identifier_fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index idx_countries_org on public.countries(organization_id);

-- PROFILES (1:1 with auth.users) ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_path text,
  locale text not null default 'lv' check (locale in ('lv','sv','en','is')),
  timezone text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function app.touch_updated_at();

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- MEMBERSHIP ------------------------------------------------------------------------
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','disabled')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz default now(),
  last_login_at timestamptz,
  primary key (organization_id, user_id)
);
create index idx_org_members_user on public.organization_members(user_id);

-- PERMISSIONS / ROLES -----------------------------------------------------------------
create table public.permissions (
  key text primary key check (key ~ '^[a-z_]{3,64}$'),
  category text not null,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,40}$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  rank integer not null default 0, -- higher = more privileged (for UI ordering / guard rails)
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);
create index idx_roles_org on public.roles(organization_id);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (role_id, permission_key)
);
create index idx_role_permissions_org on public.role_permissions(organization_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role_id)
);
create index idx_user_roles_user on public.user_roles(user_id, organization_id);
create index idx_user_roles_role on public.user_roles(role_id);

-- Guard: role must belong to the same organization as the grant
create or replace function app.check_role_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.roles r where r.id = new.role_id and r.organization_id = new.organization_id) then
    raise exception 'ROLE_ORG_MISMATCH' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_user_roles_org before insert or update on public.user_roles
  for each row execute function app.check_role_org();

create or replace function app.check_role_permission_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.roles r where r.id = new.role_id and r.organization_id = new.organization_id) then
    raise exception 'ROLE_ORG_MISMATCH' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_role_permissions_org before insert or update on public.role_permissions
  for each row execute function app.check_role_permission_org();

-- ============================================================================
-- AUTHORIZATION HELPERS (SECURITY DEFINER, fixed search_path)
-- These are the single source of truth used by every RLS policy.
-- ============================================================================

create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
$$;

create or replace function app.has_perm(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.organization_members m on m.organization_id = ur.organization_id and m.user_id = ur.user_id
    where ur.organization_id = p_org
      and ur.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission_key = p_perm
  )
$$;

create or replace function app.has_role(p_org uuid, p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.organization_id = p_org and ur.user_id = (select auth.uid()) and r.key = p_role
  )
$$;

create or replace function app.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.organization_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

grant execute on all functions in schema app to authenticated, service_role;

-- Public RPC: the caller's permissions (used by the UI to show/hide actions;
-- the database still enforces every permission independently).
create or replace function public.my_permissions(p_org uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct rp.permission_key order by rp.permission_key), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.organization_members m on m.organization_id = ur.organization_id and m.user_id = ur.user_id and m.status = 'active'
  where ur.organization_id = p_org and ur.user_id = (select auth.uid())
$$;
revoke execute on function public.my_permissions(uuid) from public, anon;
grant execute on function public.my_permissions(uuid) to authenticated;

create or replace function public.my_roles(p_org uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(r.key order by r.rank desc), '{}')
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.organization_id = p_org and ur.user_id = (select auth.uid())
    and app.is_member(p_org)
$$;
revoke execute on function public.my_roles(uuid) from public, anon;
grant execute on function public.my_roles(uuid) to authenticated;

-- ============================================================================
-- PERMISSION CATALOG
-- ============================================================================
insert into public.permissions (key, category, description) values
  ('view_dashboard','general','Skatīt paneli'),
  ('view_all_employees','people','Skatīt visus darbiniekus'),
  ('edit_employees','people','Rediģēt darbiniekus'),
  ('view_team','people','Skatīt savas komandas/objektu darbiniekus un datus'),
  ('manage_teams','people','Pārvaldīt komandas'),
  ('view_salaries','finance','Skatīt atalgojumu'),
  ('view_employee_hours','hours','Skatīt visu darbinieku stundas'),
  ('edit_employee_hours','hours','Labot darba stundas'),
  ('approve_hours','hours','Apstiprināt darba stundas'),
  ('view_finance','finance','Skatīt uzņēmuma finanses'),
  ('create_expense','finance','Izveidot izdevumu'),
  ('approve_expense','finance','Apstiprināt izdevumus'),
  ('view_fuel','fleet','Skatīt visu degvielu'),
  ('edit_fuel','fleet','Labot degvielas ierakstus'),
  ('view_gps','gps','Skatīt GPS'),
  ('view_live_gps','gps','Skatīt tiešsaistes GPS'),
  ('view_gps_history','gps','Skatīt GPS vēsturi'),
  ('view_all_projects','operations','Skatīt visus darba objektus'),
  ('manage_projects','operations','Pārvaldīt darba objektus'),
  ('manage_tasks','operations','Pārvaldīt uzdevumus'),
  ('view_all_machines','fleet','Skatīt visu tehniku'),
  ('manage_machines','fleet','Pārvaldīt tehniku'),
  ('manage_repairs','fleet','Pārvaldīt remontus'),
  ('approve_repairs','fleet','Apstiprināt remontus'),
  ('manage_documents','documents','Pārvaldīt dokumentus'),
  ('manage_safety','safety','Pārvaldīt drošību'),
  ('manage_incidents','safety','Pārvaldīt incidentus'),
  ('manage_users','system','Pārvaldīt lietotājus'),
  ('manage_permissions','system','Pārvaldīt atļaujas'),
  ('manage_settings','system','Pārvaldīt iestatījumus'),
  ('view_audit_log','system','Skatīt audita žurnālu'),
  ('view_analytics','analytics','Skatīt analītiku'),
  ('export_reports','analytics','Eksportēt atskaites'),
  ('manage_integrations','system','Pārvaldīt integrācijas');
