-- ============================================================================
-- MJ FOREST GURU — 0600 GPS, Mapon, integrations, audit log, invitations
-- ============================================================================

create table public.gps_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid references public.machines(id) on delete set null,
  provider text not null check (provider in ('mapon','manual','phone','other')),
  external_id text,
  label text,
  status text not null default 'unknown' check (status in ('online','offline','unknown')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);
create index idx_gps_devices_machine on public.gps_devices(machine_id);

create table public.gps_positions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid references public.gps_devices(id) on delete set null,
  machine_id uuid references public.machines(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed_kmh numeric(6,1),
  heading numeric(5,1),
  accuracy_m numeric(10,1),
  engine_hours numeric(12,1),
  mileage_km numeric(12,1),
  ignition boolean,
  source text not null check (source in ('manual','mapon_gps','mapon_can','employee')),
  created_at timestamptz not null default now(),
  check (machine_id is not null or employee_id is not null)
);
create index idx_gps_positions_machine_time on public.gps_positions(machine_id, recorded_at desc);
create index idx_gps_positions_employee_time on public.gps_positions(employee_id, recorded_at desc);
create index idx_gps_positions_org_time on public.gps_positions(organization_id, recorded_at desc);
create unique index uq_gps_positions_dedupe on public.gps_positions(machine_id, recorded_at, source) where machine_id is not null;

-- Latest known position per machine (security_invoker => RLS of gps_positions applies)
create view public.machine_latest_positions with (security_invoker = true) as
  select distinct on (gp.machine_id)
    gp.machine_id, gp.organization_id, gp.recorded_at, gp.latitude, gp.longitude, gp.speed_kmh,
    gp.heading, gp.engine_hours, gp.mileage_km, gp.ignition, gp.source
  from public.gps_positions gp
  where gp.machine_id is not null
  order by gp.machine_id, gp.recorded_at desc;

create table public.mapon_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id bigint not null,
  label text,
  number text,
  vehicle_title text,
  vin text,
  machine_id uuid references public.machines(id) on delete set null,
  last_update timestamptz,
  latitude double precision,
  longitude double precision,
  mileage_km numeric(12,1),
  engine_hours numeric(12,1),
  state text,
  connected boolean,
  raw jsonb,
  synced_at timestamptz not null default now(),
  unique (organization_id, unit_id)
);
create index idx_mapon_devices_machine on public.mapon_devices(machine_id);

create table public.mapon_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id bigint,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_mapon_events_org_time on public.mapon_events(organization_id, occurred_at desc);

-- Non-secret integration state (readable by manage_integrations) --------------------
create table public.integration_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('mapon','mapbox','email','ocr')),
  enabled boolean not null default false,
  status text not null default 'not_configured' check (status in ('connected','delayed','error','not_configured')),
  has_secret boolean not null default false,
  secret_hint text,                 -- e.g. last 4 chars, never the secret itself
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  device_count integer,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);

-- SECRETS: no RLS policies at all => unreachable for anon/authenticated.
-- Only the server (service role) reads/writes. Prefer env vars / Supabase Vault in prod.
create table public.integration_secrets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  secret text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- INVITATIONS ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  employee_id uuid references public.employees(id) on delete cascade,
  role_key text not null check (role_key in ('employee','foreman','manager','mechanic','admin')),
  invited_by uuid references auth.users(id) default auth.uid(),
  user_id uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_invitations_org on public.invitations(organization_id, created_at desc);
create unique index uq_invitations_open on public.invitations(organization_id, lower(email)) where accepted_at is null and revoked_at is null;

-- AUDIT LOG (append-only) ------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid,             -- no FK on purpose: audit history outlives records
  user_id uuid,
  actor_name text,
  action text not null,
  entity text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_audit_org_time on public.audit_logs(organization_id, created_at desc);
create index idx_audit_entity on public.audit_logs(entity, entity_id);
create index idx_audit_user on public.audit_logs(user_id, created_at desc);

-- Immutable: block UPDATE/DELETE for everyone except superuser maintenance.
create or replace function app.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE' using errcode = '42501';
end $$;
create trigger trg_audit_no_update before update or delete on public.audit_logs
  for each row execute function app.audit_immutable();

create or replace function app.request_header(p_name text) returns text
language sql stable as $$
  select nullif(current_setting('request.headers', true), '')::json ->> p_name
$$;

create or replace function app.write_audit(
  p_org uuid, p_action text, p_entity text, p_entity_id text, p_old jsonb, p_new jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_name text;
begin
  if v_uid is not null then
    select full_name into v_name from public.profiles where id = v_uid;
  end if;
  insert into public.audit_logs (organization_id, user_id, actor_name, action, entity, entity_id, old_values, new_values, ip_address, user_agent)
  values (p_org, v_uid, coalesce(v_name, case when v_uid is null then 'system' end), p_action, p_entity, p_entity_id, p_old, p_new,
          split_part(coalesce(app.request_header('x-forwarded-for'), app.request_header('x-real-ip'), ''), ',', 1),
          left(app.request_header('user-agent'), 300));
end $$;

-- Generic row-audit trigger with semantic action names
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_action text := lower(tg_op);
  v_org uuid := coalesce((v_row ->> 'organization_id')::uuid,
                         case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end);
  v_id text := coalesce(v_row ->> 'id', v_row ->> 'employee_id', v_row ->> 'role_id');
  k text;
begin
  if tg_op = 'UPDATE' then
    -- strip unchanged keys to keep the log readable
    for k in select jsonb_object_keys(v_new) loop
      if v_new -> k = v_old -> k then
        v_new := v_new - k; v_old := v_old - k;
      end if;
    end loop;
    v_new := v_new - 'updated_at'; v_old := v_old - 'updated_at';
    if v_new = '{}'::jsonb then return null; end if;

    if v_new ? 'deleted_at' and (v_new ->> 'deleted_at') is not null then v_action := 'deleted';
    elsif v_new ? 'archived_at' and (v_new ->> 'archived_at') is not null then v_action := 'archived';
    elsif tg_table_name = 'expenses' and v_new ? 'status' then
      v_action := case v_new ->> 'status' when 'approved' then 'expense_approved' when 'rejected' then 'expense_rejected'
                  when 'correction_requested' then 'expense_correction_requested' when 'paid' then 'expense_paid'
                  when 'submitted' then 'expense_submitted' else 'update' end;
    elsif tg_table_name = 'work_logs' and (v_new ? 'started_at' or (v_new ? 'ended_at' and v_old ->> 'ended_at' is not null)) then
      v_action := 'work_hours_corrected';
    elsif tg_table_name = 'work_logs' and v_new ? 'status' and v_new ->> 'status' = 'approved' then
      v_action := 'work_hours_approved';
    elsif tg_table_name = 'repair_requests' and v_new ? 'status' then v_action := 'repair_status_changed';
    elsif tg_table_name = 'machine_assignments' then v_action := 'machine_assignment_changed';
    elsif tg_table_name = 'integration_settings' then v_action := 'integration_changed';
    end if;
  elsif tg_op = 'INSERT' then
    v_action := case tg_table_name
      when 'user_roles' then 'role_granted'
      when 'role_permissions' then 'permission_granted'
      when 'files' then 'document_uploaded'
      when 'documents' then 'document_uploaded'
      when 'machine_assignments' then 'machine_assignment_changed'
      when 'project_workers' then 'project_assignment_changed'
      when 'project_machines' then 'project_assignment_changed'
      else 'create' end;
  elsif tg_op = 'DELETE' then
    v_action := case tg_table_name
      when 'user_roles' then 'role_revoked'
      when 'role_permissions' then 'permission_revoked'
      when 'files' then 'document_deleted'
      when 'documents' then 'document_deleted'
      else 'delete' end;
  end if;

  perform app.write_audit(v_org, v_action, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','organization_settings','countries','employees','employee_compensation','teams',
    'projects','work_sites','project_workers','project_teams','project_machines','machines','machine_assignments',
    'work_logs','production_logs','tasks','fuel_logs','receipts','expenses','maintenance_records',
    'repair_requests','repair_parts','safety_rules','safety_rule_versions','employee_training','incidents',
    'documents','files','roles','role_permissions','user_roles','organization_members','integration_settings','invitations'
  ] loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function app.audit_row()', t);
  end loop;
end $$;

-- Public RPC for auth events (login / logout) of the *current* user only
create or replace function public.log_auth_event(p_action text, p_org uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_org uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_action not in ('login','logout') then raise exception 'INVALID_ACTION' using errcode = '22023'; end if;
  for v_org in select organization_id from public.organization_members where user_id = v_uid and status = 'active'
               and (p_org is null or organization_id = p_org) loop
    perform app.write_audit(v_org, p_action, 'auth', v_uid::text, null, null);
    if p_action = 'login' then
      update public.organization_members set last_login_at = now() where organization_id = v_org and user_id = v_uid;
    end if;
  end loop;
  if p_action = 'login' then
    update public.profiles set last_login_at = now() where id = v_uid;
  end if;
end $$;
revoke execute on function public.log_auth_event(text, uuid) from public, anon;
grant execute on function public.log_auth_event(text, uuid) to authenticated;
