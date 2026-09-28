-- ============================================================================
-- MJ FOREST GURU — 0200 People, projects (darba objekti), machines
-- ============================================================================

-- LOOKUPS (work types, fuel types, expense categories, problem categories...) ----
create table public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('work_type','fuel_type','expense_category','problem_category','document_type','production_unit')),
  key text not null check (key ~ '^[a-z0-9_]{1,60}$'),
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (organization_id, kind, key)
);
create index idx_lookup_org_kind on public.lookup_values(organization_id, kind);

-- EMPLOYEES -----------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null default '' check (length(last_name) <= 100),
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  photo_path text,
  job_title text,               -- e.g. "Operators", "Brigadieris", "Mehāniķis"
  country_id uuid references public.countries(id),
  team_id uuid,                 -- FK added after teams table
  status text not null default 'active' check (status in ('active','on_leave','inactive','offboarding')),
  employment_start date,
  employment_end date,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (employment_end is null or employment_start is null or employment_end >= employment_start)
);
create index idx_employees_org on public.employees(organization_id) where deleted_at is null;
create index idx_employees_user on public.employees(user_id);
create index idx_employees_country on public.employees(country_id);
create index idx_employees_team on public.employees(team_id);
create index idx_employees_status on public.employees(organization_id, status);
create trigger trg_employees_updated before update on public.employees
  for each row execute function app.touch_updated_at();

-- Salary data is separated so it can be protected independently (view_salaries)
create table public.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hourly_rate numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  monthly_salary numeric(12,2) check (monthly_salary is null or monthly_salary >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  updated_at timestamptz not null default now()
);

-- TEAMS ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id),
  name text not null check (length(trim(name)) between 1 and 100),
  manager_employee_id uuid references public.employees(id) on delete set null,
  foreman_employee_id uuid references public.employees(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index idx_teams_org on public.teams(organization_id);
alter table public.employees add constraint employees_team_fk
  foreign key (team_id) references public.teams(id) on delete set null;

-- PROJECTS / WORK SITES (Darba objekti) ------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid not null references public.countries(id),
  code text not null check (length(trim(code)) between 1 and 40),   -- SE-042, LV-018 ...
  name text not null check (length(trim(name)) between 1 and 200),
  client_name text,
  status text not null default 'planned' check (status in ('planned','active','paused','completed','cancelled')),
  address text,
  location_name text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  timezone text,                -- optional override of country timezone
  -- Country-specific OPTIONAL identifiers, e.g.
  --   LV: {"cirsmas_numurs": "...", "kadastra_numurs": "..."}
  --   SE: {"fastighet": "...", "work_site_id": "..."}
  --   IS: {"work_site_id": "...", "local_description": "..."}
  site_identifiers jsonb not null default '{}'::jsonb,
  area_ha numeric(10,2) check (area_ha is null or area_ha >= 0),
  start_date date,
  expected_end_date date,
  actual_end_date date,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (expected_end_date is null or start_date is null or expected_end_date >= start_date),
  check (actual_end_date is null or start_date is null or actual_end_date >= start_date)
);
create index idx_projects_org on public.projects(organization_id) where deleted_at is null;
create index idx_projects_country on public.projects(country_id);
create index idx_projects_status on public.projects(organization_id, status);
create trigger trg_projects_updated before update on public.projects
  for each row execute function app.touch_updated_at();

-- Individual work sites inside a project (cirsmas / fastigheter / locations)
create table public.work_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  site_identifiers jsonb not null default '{}'::jsonb,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  area_ha numeric(10,2),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_work_sites_project on public.work_sites(project_id);
create index idx_work_sites_org on public.work_sites(organization_id);

create table public.project_workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_role text not null default 'worker' check (project_role in ('worker','foreman','manager','mechanic')),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  assigned_by uuid references auth.users(id) default auth.uid(),
  check (unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index uq_project_workers_active on public.project_workers(project_id, employee_id) where unassigned_at is null;
create index idx_project_workers_employee on public.project_workers(employee_id) where unassigned_at is null;
create index idx_project_workers_org on public.project_workers(organization_id);

create table public.project_teams (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (project_id, team_id)
);
create index idx_project_teams_team on public.project_teams(team_id);

-- MACHINES -------------------------------------------------------------------------
create table public.machine_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (category in ('harvester','forwarder','tractor','skidder','mulcher','truck','trailer','van','car','other')),
  name text not null,
  default_service_interval_hours integer check (default_service_interval_hours is null or default_service_interval_hours > 0),
  unique (organization_id, name)
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (category in ('harvester','forwarder','tractor','skidder','mulcher','truck','trailer','van','car','other')),
  machine_type_id uuid references public.machine_types(id) on delete set null,
  manufacturer text,
  model text,
  year integer check (year is null or year between 1950 and 2100),
  vin text,
  registration_number text,
  internal_code text,
  country_id uuid references public.countries(id),
  status text not null default 'active' check (status in ('active','idle','maintenance','broken','offline')),
  engine_hours numeric(12,1) check (engine_hours is null or engine_hours >= 0),
  mileage_km numeric(12,1) check (mileage_km is null or mileage_km >= 0),
  fuel_type text,
  service_interval_hours integer check (service_interval_hours is null or service_interval_hours > 0),
  last_service_hours numeric(12,1),
  last_service_at date,
  next_service_hours numeric(12,1),
  next_service_at date,
  insurance_valid_until date,
  inspection_valid_until date,
  photo_path text,
  current_project_id uuid references public.projects(id) on delete set null,
  current_operator_id uuid references public.employees(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_machines_org on public.machines(organization_id) where deleted_at is null;
create index idx_machines_country on public.machines(country_id);
create index idx_machines_project on public.machines(current_project_id);
create index idx_machines_operator on public.machines(current_operator_id);
create index idx_machines_status on public.machines(organization_id, status);
create unique index uq_machines_vin on public.machines(organization_id, vin) where vin is not null and deleted_at is null;
create trigger trg_machines_updated before update on public.machines
  for each row execute function app.touch_updated_at();

create table public.project_machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  assigned_by uuid references auth.users(id) default auth.uid(),
  check (unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index uq_project_machines_active on public.project_machines(project_id, machine_id) where unassigned_at is null;
create index idx_project_machines_machine on public.project_machines(machine_id) where unassigned_at is null;

-- Who used which machine, when, where (answers "who operated X on date Y")
create table public.machine_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  country_id uuid references public.countries(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'manual' check (source in ('manual','check_in','mapon')),
  work_log_id uuid,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index idx_machine_assign_machine on public.machine_assignments(machine_id, started_at desc);
create index idx_machine_assign_employee on public.machine_assignments(employee_id, started_at desc);
create index idx_machine_assign_org on public.machine_assignments(organization_id);

-- Cross-org integrity guard used by several tables --------------------------------
create or replace function app.assert_same_org(p_org uuid, p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  if p_id is null then return; end if;
  execute format('select organization_id from public.%I where id = $1', p_table) into v_org using p_id;
  if v_org is null or v_org <> p_org then
    raise exception 'CROSS_ORG_REFERENCE:%', p_table using errcode = '23514';
  end if;
end $$;

create or replace function app.guard_employee_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  perform app.assert_same_org(new.organization_id, 'teams', new.team_id);
  return new;
end $$;
create trigger trg_employees_refs before insert or update on public.employees
  for each row execute function app.guard_employee_refs();

create or replace function app.guard_project_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  return new;
end $$;
create trigger trg_projects_refs before insert or update on public.projects
  for each row execute function app.guard_project_refs();

create or replace function app.guard_machine_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.current_project_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.current_operator_id);
  return new;
end $$;
create trigger trg_machines_refs before insert or update on public.machines
  for each row execute function app.guard_machine_refs();

create or replace function app.guard_project_link_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  if tg_table_name = 'project_workers' then
    perform app.assert_same_org(new.organization_id, 'employees', (to_jsonb(new) ->> 'employee_id')::uuid);
  elsif tg_table_name = 'project_machines' then
    perform app.assert_same_org(new.organization_id, 'machines', (to_jsonb(new) ->> 'machine_id')::uuid);
  elsif tg_table_name = 'project_teams' then
    perform app.assert_same_org(new.organization_id, 'teams', (to_jsonb(new) ->> 'team_id')::uuid);
  elsif tg_table_name = 'work_sites' then
    null;
  end if;
  return new;
end $$;
create trigger trg_project_workers_refs before insert or update on public.project_workers
  for each row execute function app.guard_project_link_refs();
create trigger trg_project_machines_refs before insert or update on public.project_machines
  for each row execute function app.guard_project_link_refs();
create trigger trg_project_teams_refs before insert or update on public.project_teams
  for each row execute function app.guard_project_link_refs();
create trigger trg_work_sites_refs before insert or update on public.work_sites
  for each row execute function app.guard_project_link_refs();

create or replace function app.guard_machine_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status text; v_archived timestamptz; v_emp_status text;
begin
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  select status, archived_at into v_status, v_archived from public.machines where id = new.machine_id;
  if v_archived is not null then
    raise exception 'INVALID_MACHINE_ASSIGNMENT:archived' using errcode = '23514';
  end if;
  select status into v_emp_status from public.employees where id = new.employee_id;
  if tg_op = 'INSERT' and v_emp_status in ('inactive') then
    raise exception 'INVALID_MACHINE_ASSIGNMENT:employee_inactive' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_machine_assignments_guard before insert or update on public.machine_assignments
  for each row execute function app.guard_machine_assignment();

-- SCOPE HELPERS (who can see what) -------------------------------------------------------
create or replace function app.my_employee_id(p_org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e
  where e.organization_id = p_org and e.user_id = (select auth.uid()) and e.deleted_at is null
  limit 1
$$;

-- Projects the current user is assigned to (directly, as team member, or as team lead)
create or replace function app.my_project_ids(p_org uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with me as (select app.my_employee_id(p_org) as eid)
  select pw.project_id from public.project_workers pw, me
    where pw.organization_id = p_org and pw.employee_id = me.eid and pw.unassigned_at is null
  union
  select pt.project_id from public.project_teams pt
    join public.teams t on t.id = pt.team_id, me
    where pt.organization_id = p_org
      and (t.manager_employee_id = me.eid or t.foreman_employee_id = me.eid
           or exists (select 1 from public.employees e where e.id = me.eid and e.team_id = t.id))
$$;

-- Projects where the current user is a lead (manager/foreman) — for managerial scope
create or replace function app.my_led_project_ids(p_org uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with me as (select app.my_employee_id(p_org) as eid)
  select pw.project_id from public.project_workers pw, me
    where pw.organization_id = p_org and pw.employee_id = me.eid and pw.unassigned_at is null
      and pw.project_role in ('manager','foreman')
  union
  select pt.project_id from public.project_teams pt
    join public.teams t on t.id = pt.team_id, me
    where pt.organization_id = p_org and (t.manager_employee_id = me.eid or t.foreman_employee_id = me.eid)
$$;

create or replace function app.can_access_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and app.is_member(p.organization_id)
      and (
        app.has_perm(p.organization_id, 'view_all_projects')
        or p.id in (select app.my_project_ids(p.organization_id))
      )
  )
$$;

-- Managerial scope over a project: lead of it, or org-wide project visibility + view_team
create or replace function app.leads_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and app.is_member(p.organization_id)
      and (
        app.has_perm(p.organization_id, 'view_all_projects')
        or p.id in (select app.my_led_project_ids(p.organization_id))
      )
  )
$$;

-- Employees within the current user's managerial scope
create or replace function app.in_my_scope_employee(p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with emp as (select e.id, e.organization_id, e.team_id from public.employees e where e.id = p_employee),
       me as (select app.my_employee_id(emp.organization_id) as eid, emp.organization_id as org from emp)
  select exists (
    select 1 from emp, me
    where app.has_perm(me.org, 'view_team')
      and (
        -- team lead of the employee's team
        exists (select 1 from public.teams t where t.id = emp.team_id
                and (t.manager_employee_id = me.eid or t.foreman_employee_id = me.eid))
        -- or employee works on a project the current user leads
        or exists (select 1 from public.project_workers pw
                   where pw.employee_id = emp.id and pw.unassigned_at is null
                     and pw.project_id in (select app.my_led_project_ids(me.org)))
      )
  )
$$;

create or replace function app.can_view_employee(p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee and app.is_member(e.organization_id)
      and (
        e.user_id = (select auth.uid())
        or app.has_perm(e.organization_id, 'view_all_employees')
        or app.in_my_scope_employee(e.id)
      )
  )
$$;

create or replace function app.can_access_machine(p_machine uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.machines m
    where m.id = p_machine and app.is_member(m.organization_id)
      and (
        app.has_perm(m.organization_id, 'view_all_machines')
        or m.current_operator_id = app.my_employee_id(m.organization_id)
        or exists (select 1 from public.machine_assignments ma
                   where ma.machine_id = m.id and ma.ended_at is null
                     and ma.employee_id = app.my_employee_id(m.organization_id))
        or exists (select 1 from public.project_machines pm
                   where pm.machine_id = m.id and pm.unassigned_at is null
                     and pm.project_id in (select app.my_project_ids(m.organization_id)))
        or (m.current_project_id is not null and m.current_project_id in (select app.my_project_ids(m.organization_id)))
      )
  )
$$;

grant execute on all functions in schema app to authenticated, service_role;
