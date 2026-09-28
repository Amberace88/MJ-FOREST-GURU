-- ============================================================================
-- MJ FOREST GURU — 0500 Safety center, acknowledgements, training, incidents, documents
-- ============================================================================

create table public.safety_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id),    -- null = applies to all countries
  section text not null check (section in ('general','forestry','machinery','chainsaw','ppe','emergency','fire','first_aid','accident_reporting','country_specific')),
  title text not null check (length(trim(title)) between 1 and 200),
  current_version integer not null default 1 check (current_version >= 1),
  requires_acknowledgement boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_safety_rules_org on public.safety_rules(organization_id, section);
create trigger trg_safety_rules_updated before update on public.safety_rules
  for each row execute function app.touch_updated_at();

-- Immutable version history: an acknowledgement always points at exact text
create table public.safety_rule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.safety_rules(id) on delete cascade,
  version integer not null check (version >= 1),
  body text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (rule_id, version)
);

create table public.safety_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.safety_rules(id) on delete cascade,
  rule_version_id uuid not null references public.safety_rule_versions(id) on delete restrict,
  version integer not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  statement text not null default 'Es esmu iepazinies ar šo informāciju.',
  acknowledged_at timestamptz not null default now(),
  unique (rule_version_id, employee_id)
);
create index idx_safety_ack_employee on public.safety_acknowledgements(employee_id);
create index idx_safety_ack_rule on public.safety_acknowledgements(rule_id);

create or replace function app.safety_ack_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_rule uuid; v_version integer; v_org uuid;
begin
  select rule_id, version, organization_id into v_rule, v_version, v_org
  from public.safety_rule_versions where id = new.rule_version_id;
  if v_rule is null or v_rule <> new.rule_id or v_org <> new.organization_id then
    raise exception 'INVALID_ACKNOWLEDGEMENT' using errcode = '23514';
  end if;
  new.version := v_version;
  new.acknowledged_at := now();   -- server time, never client supplied
  return new;
end $$;
create trigger trg_safety_ack_before before insert on public.safety_acknowledgements
  for each row execute function app.safety_ack_before_insert();

create table public.safety_training (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id),
  title text not null,
  description text,
  validity_months integer check (validity_months is null or validity_months > 0),
  is_required boolean not null default false,
  applies_to_job_titles text[],
  created_at timestamptz not null default now()
);
create index idx_safety_training_org on public.safety_training(organization_id);

create table public.employee_training (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  training_id uuid references public.safety_training(id) on delete set null,
  title text not null,
  completed_at date,
  expires_at date,
  certificate_number text,
  certificate_file_id uuid references public.files(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (expires_at is null or completed_at is null or expires_at >= completed_at)
);
create index idx_employee_training_employee on public.employee_training(employee_id);
create index idx_employee_training_expiry on public.employee_training(organization_id, expires_at);

-- INCIDENTS ---------------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at timestamptz not null,
  location_text text,
  latitude double precision,
  longitude double precision,
  project_id uuid references public.projects(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  incident_type text not null default 'other' check (incident_type in ('injury','near_miss','property_damage','environmental','fire','vehicle','other')),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null,
  immediate_action text,
  manager_response text,
  investigation text,
  corrective_action text,
  status text not null default 'open' check (status in ('open','investigating','action_required','resolved','closed')),
  reported_by uuid references auth.users(id) default auth.uid(),
  closed_at timestamptz,
  idempotency_key text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index idx_incidents_org on public.incidents(organization_id, occurred_at desc) where deleted_at is null;
create index idx_incidents_status on public.incidents(organization_id, status);
create index idx_incidents_project on public.incidents(project_id);
create trigger trg_incidents_updated before update on public.incidents
  for each row execute function app.touch_updated_at();

create or replace function app.incident_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  if new.occurred_at > now() + interval '1 hour' then
    raise exception 'INVALID_DATE:incident' using errcode = '23514';
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then new.closed_at := now(); end if;
  if tg_op = 'UPDATE' and (select auth.uid()) is not null
     and not (app.has_perm(old.organization_id, 'manage_incidents') or app.has_perm(old.organization_id, 'manage_safety')) then
    raise exception 'PERMISSION_DENIED:incident_update' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_incidents_before before insert or update on public.incidents
  for each row execute function app.incident_before_write();

create or replace function app.incident_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.notify_permission_holders(new.organization_id, 'manage_incidents', 'incident_reported',
    case when new.severity in ('high','critical') then 'Nopietns drošības incidents' else 'Ziņots par incidentu' end,
    new.title, '/incidents/' || new.id, 'incident', new.id, new.reported_by);
  return new;
end $$;
create trigger trg_incidents_notify after insert on public.incidents
  for each row execute function app.incident_notify();

-- DOCUMENTS -------------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('employee','machine','project','organization','safety_rule','repair','expense','incident')),
  entity_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  document_type text not null default 'other',
  file_id uuid references public.files(id) on delete set null,
  issued_at date,
  expiry_date date,
  version integer not null default 1 check (version >= 1),
  visibility text not null default 'management' check (visibility in ('management','entity','organization')),
  status text not null default 'active' check (status in ('active','archived','superseded')),
  notes text,
  is_demo boolean not null default false,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  uploaded_at timestamptz not null default now(),
  archived_at timestamptz,
  check (entity_type = 'organization' or entity_id is not null)
);
create index idx_documents_entity on public.documents(entity_type, entity_id);
create index idx_documents_expiry on public.documents(organization_id, expiry_date) where status = 'active';

create view public.employee_documents with (security_invoker = true) as
  select * from public.documents where entity_type = 'employee';
create view public.machine_documents with (security_invoker = true) as
  select * from public.documents where entity_type = 'machine';
