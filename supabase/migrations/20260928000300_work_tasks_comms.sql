-- ============================================================================
-- MJ FOREST GURU — 0300 Work logs, production, tasks, comments, notifications, files
-- ============================================================================

-- WORK LOGS (check-in / check-out) -------------------------------------------------
create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  work_site_id uuid references public.work_sites(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  work_type text,
  started_at timestamptz not null,
  ended_at timestamptz,
  start_lat double precision check (start_lat is null or start_lat between -90 and 90),
  start_lng double precision check (start_lng is null or start_lng between -180 and 180),
  start_accuracy_m numeric(10,1),
  end_lat double precision check (end_lat is null or end_lat between -90 and 90),
  end_lng double precision check (end_lng is null or end_lng between -180 and 180),
  end_accuracy_m numeric(10,1),
  device_info jsonb,
  status text not null default 'active' check (status in ('active','completed','approved','corrected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  notes text,
  source text not null default 'app' check (source in ('app','offline','manual','import')),
  idempotency_key text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_logs_end_after_start check (ended_at is null or ended_at > started_at),
  constraint work_logs_max_duration check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  unique (organization_id, idempotency_key)
);
-- only ONE open shift per employee (prevents duplicate check-in)
create unique index uq_work_logs_one_active on public.work_logs(employee_id) where ended_at is null and deleted_at is null;
create index idx_work_logs_org_started on public.work_logs(organization_id, started_at desc) where deleted_at is null;
create index idx_work_logs_employee on public.work_logs(employee_id, started_at desc);
create index idx_work_logs_project on public.work_logs(project_id, started_at desc);
create index idx_work_logs_machine on public.work_logs(machine_id, started_at desc);
create trigger trg_work_logs_updated before update on public.work_logs
  for each row execute function app.touch_updated_at();

create table public.work_breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_log_id uuid not null references public.work_logs(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at),
  unique (organization_id, idempotency_key)
);
create unique index uq_work_breaks_one_open on public.work_breaks(work_log_id) where ended_at is null;
create index idx_work_breaks_log on public.work_breaks(work_log_id);

-- Validation for work logs --------------------------------------------------------------
create or replace function app.validate_work_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_proj_status text; v_machine_archived timestamptz; v_emp_status text;
begin
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'work_sites', new.work_site_id);

  if new.started_at > now() + interval '10 minutes' then
    raise exception 'INVALID_DATE:start_in_future' using errcode = '23514';
  end if;
  if new.ended_at is not null and new.ended_at > now() + interval '10 minutes' then
    raise exception 'INVALID_DATE:end_in_future' using errcode = '23514';
  end if;
  if new.started_at < now() - interval '400 days' then
    raise exception 'INVALID_DATE:too_old' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.project_id is not null then
      select status into v_proj_status from public.projects where id = new.project_id;
      if v_proj_status in ('completed','cancelled') then
        raise exception 'INVALID_PROJECT_ASSIGNMENT:closed' using errcode = '23514';
      end if;
    end if;
    if new.machine_id is not null then
      select archived_at into v_machine_archived from public.machines where id = new.machine_id;
      if v_machine_archived is not null then
        raise exception 'INVALID_MACHINE_ASSIGNMENT:archived' using errcode = '23514';
      end if;
    end if;
    select status into v_emp_status from public.employees where id = new.employee_id;
    if v_emp_status = 'inactive' then
      raise exception 'EMPLOYEE_INACTIVE' using errcode = '23514';
    end if;
  end if;

  if new.ended_at is not null and new.status = 'active' then
    new.status := 'completed';
  end if;
  return new;
end $$;
create trigger trg_work_logs_validate before insert or update on public.work_logs
  for each row execute function app.validate_work_log();

-- Employees may only close their own shift; changing times of a closed log or someone
-- else's log requires edit_employee_hours (and is audited as a correction).
create or replace function app.guard_work_log_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_can_edit boolean;
begin
  if (select auth.uid()) is null then return new; end if; -- service role / system
  v_can_edit := app.has_perm(old.organization_id, 'edit_employee_hours')
                or (app.has_perm(old.organization_id, 'approve_hours') and app.in_my_scope_employee(old.employee_id));
  if v_can_edit then
    if (new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at)
       and old.ended_at is not null then
      new.status := 'corrected';
    end if;
    return new;
  end if;
  -- plain employee path
  if new.employee_id <> old.employee_id or new.organization_id <> old.organization_id
     or new.started_at <> old.started_at or new.project_id is distinct from old.project_id
     or new.machine_id is distinct from old.machine_id then
    raise exception 'PERMISSION_DENIED:work_log_fields' using errcode = '42501';
  end if;
  if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
    raise exception 'PERMISSION_DENIED:work_log_closed' using errcode = '42501';
  end if;
  if new.status in ('approved','corrected') and new.status is distinct from old.status then
    raise exception 'PERMISSION_DENIED:approve' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'PERMISSION_DENIED:delete' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_work_logs_guard before update on public.work_logs
  for each row execute function app.guard_work_log_update();

-- Check-in with a machine opens a machine assignment; check-out closes it.
create or replace function app.sync_machine_assignment_from_work_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_country uuid;
begin
  if new.machine_id is null then return new; end if;
  if tg_op = 'INSERT' and new.ended_at is null then
    select country_id into v_country from public.projects where id = new.project_id;
    -- close any other open assignment of this machine
    update public.machine_assignments set ended_at = new.started_at
      where machine_id = new.machine_id and ended_at is null and started_at < new.started_at;
    insert into public.machine_assignments (organization_id, machine_id, employee_id, project_id, country_id, started_at, source, work_log_id, created_by)
    values (new.organization_id, new.machine_id, new.employee_id, new.project_id, v_country, new.started_at, 'check_in', new.id, new.created_by);
    update public.machines set current_operator_id = new.employee_id,
      current_project_id = coalesce(new.project_id, current_project_id)
      where id = new.machine_id;
  elsif tg_op = 'INSERT' and new.ended_at is not null then
    select country_id into v_country from public.projects where id = new.project_id;
    insert into public.machine_assignments (organization_id, machine_id, employee_id, project_id, country_id, started_at, ended_at, source, work_log_id, created_by)
    values (new.organization_id, new.machine_id, new.employee_id, new.project_id, v_country, new.started_at, new.ended_at, 'check_in', new.id, new.created_by);
  elsif tg_op = 'UPDATE' and old.ended_at is null and new.ended_at is not null then
    update public.machine_assignments set ended_at = new.ended_at
      where work_log_id = new.id and ended_at is null;
    update public.machines set current_operator_id = null
      where id = new.machine_id and current_operator_id = new.employee_id;
  end if;
  return new;
end $$;
create trigger trg_work_logs_machine_assign after insert or update on public.work_logs
  for each row execute function app.sync_machine_assignment_from_work_log();

-- PRODUCTION -------------------------------------------------------------------------
create table public.production_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_site_id uuid references public.work_sites(id) on delete set null,
  production_date date not null,
  employee_id uuid references public.employees(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  quantity numeric(12,2) not null check (quantity > 0 and quantity < 100000),
  unit text not null check (unit in ('m3','units','loads','other')),
  unit_label text,
  work_type text,
  notes text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (unit <> 'other' or unit_label is not null)
);
create index idx_production_org_date on public.production_logs(organization_id, production_date desc);
create index idx_production_project on public.production_logs(project_id, production_date desc);
create index idx_production_machine on public.production_logs(machine_id);

create or replace function app.validate_production() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'teams', new.team_id);
  if new.production_date > (now() + interval '1 day')::date or new.production_date < (now() - interval '400 days')::date then
    raise exception 'INVALID_DATE:production' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_production_validate before insert or update on public.production_logs
  for each row execute function app.validate_production();

-- TASKS ----------------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  assignee_employee_id uuid references public.employees(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  deadline timestamptz,
  status text not null default 'todo' check (status in ('todo','in_progress','waiting','done','cancelled')),
  position double precision not null default 0,
  completed_at timestamptz,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_org_status on public.tasks(organization_id, status) where deleted_at is null;
create index idx_tasks_assignee on public.tasks(assignee_employee_id);
create index idx_tasks_project on public.tasks(project_id);
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function app.touch_updated_at();

create or replace function app.task_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'employees', new.assignee_employee_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'teams', new.team_id);
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  -- assignee without manage_tasks may change status only
  if tg_op = 'UPDATE' and (select auth.uid()) is not null
     and not app.has_perm(old.organization_id, 'manage_tasks') then
    if new.title <> old.title or new.description is distinct from old.description
       or new.assignee_employee_id is distinct from old.assignee_employee_id
       or new.project_id is distinct from old.project_id or new.priority <> old.priority
       or new.deadline is distinct from old.deadline or new.deleted_at is distinct from old.deleted_at then
      raise exception 'PERMISSION_DENIED:task_fields' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_tasks_before before insert or update on public.tasks
  for each row execute function app.task_before_write();

-- CONTEXTUAL COMMENTS (no giant company chat) -------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('task','repair','project','incident','expense','employee','machine')),
  entity_id uuid not null,
  body text not null check (length(trim(body)) between 1 and 5000),
  author_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index idx_comments_entity on public.comments(entity_type, entity_id, created_at);
create index idx_comments_org on public.comments(organization_id);

-- Spec-named compatibility views
create view public.task_comments with (security_invoker = true) as
  select id, organization_id, entity_id as task_id, body, author_id, created_at
  from public.comments where entity_type = 'task' and deleted_at is null;
create view public.project_comments with (security_invoker = true) as
  select id, organization_id, entity_id as project_id, body, author_id, created_at
  from public.comments where entity_type = 'project' and deleted_at is null;

-- NOTIFICATIONS -------------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('task_assigned','repair_submitted','repair_approved','repair_status','expense_submitted','expense_approved','expense_rejected','incident_reported','training_expiring','document_expiring','service_due','missing_checkout','system_alert')),
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, created_at desc);
create index idx_notifications_unread on public.notifications(user_id) where read_at is null;

-- Internal: fan-out notification to every active user holding a permission
create or replace function app.notify_permission_holders(
  p_org uuid, p_perm text, p_type text, p_title text, p_body text, p_link text, p_entity_type text, p_entity_id uuid, p_exclude uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
  select distinct p_org, ur.user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = p_perm
  join public.organization_members m on m.organization_id = ur.organization_id and m.user_id = ur.user_id and m.status = 'active'
  where ur.organization_id = p_org and (p_exclude is null or ur.user_id <> p_exclude);
end $$;

create or replace function app.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if new.assignee_employee_id is not null
     and (tg_op = 'INSERT' or new.assignee_employee_id is distinct from old.assignee_employee_id) then
    select user_id into v_user from public.employees where id = new.assignee_employee_id;
    if v_user is not null and v_user is distinct from (select auth.uid()) then
      insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_user, 'task_assigned', 'Jauns uzdevums', new.title, '/tasks?task=' || new.id, 'task', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger trg_tasks_notify after insert or update on public.tasks
  for each row execute function app.notify_task_assigned();

-- FILES (metadata for private storage objects) ---------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null check (bucket in ('receipts','documents','media')),
  path text not null,
  entity_type text not null check (entity_type in ('employee','machine','project','organization','safety_rule','repair','expense','fuel','incident','task','production','receipt')),
  entity_id uuid,
  kind text not null default 'photo' check (kind in ('photo','video','before','after','receipt','document','avatar','other')),
  original_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 52428800),
  preview_path text,
  uploaded_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  unique (bucket, path),
  -- path must be scoped under the organization folder
  check (split_part(path, '/', 1) = organization_id::text)
);
create index idx_files_entity on public.files(entity_type, entity_id);
create index idx_files_org on public.files(organization_id, created_at desc);
