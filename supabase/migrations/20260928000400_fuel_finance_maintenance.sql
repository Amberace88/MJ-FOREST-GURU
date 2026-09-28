-- ============================================================================
-- MJ FOREST GURU — 0400 Fuel, receipts, expenses, maintenance, repairs
-- ============================================================================

-- RECEIPTS ------------------------------------------------------------------------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  merchant text,
  receipt_date date,
  amount numeric(12,2) check (amount is null or amount >= 0),
  vat_amount numeric(12,2) check (vat_amount is null or vat_amount >= 0),
  currency text check (currency is null or currency in ('EUR','SEK','ISK')),
  ocr_raw jsonb,
  ocr_confirmed boolean not null default false,   -- OCR is never trusted without confirmation
  uploaded_by uuid not null references auth.users(id) default auth.uid(),
  employee_id uuid references public.employees(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_receipts_org on public.receipts(organization_id, created_at desc);
create index idx_receipts_uploader on public.receipts(uploaded_by);

-- FUEL -------------------------------------------------------------------------------
create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at timestamptz not null,
  employee_id uuid references public.employees(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  country_id uuid references public.countries(id),
  fuel_type text not null default 'diesel',
  litres numeric(10,2) not null check (litres > 0 and litres <= 5000),
  price_per_litre numeric(10,4) check (price_per_litre is null or price_per_litre >= 0),
  total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  location_text text,
  latitude double precision,
  longitude double precision,
  engine_hours numeric(12,1) check (engine_hours is null or engine_hours >= 0),
  mileage_km numeric(12,1) check (mileage_km is null or mileage_km >= 0),
  receipt_id uuid references public.receipts(id) on delete set null,
  notes text,
  source text not null default 'employee' check (source in ('manual','employee','mapon_can','import','offline')),
  idempotency_key text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
-- duplicate fuel record guard (same machine, same minute, same litres)
create unique index uq_fuel_duplicate on public.fuel_logs(machine_id, date_trunc('minute', occurred_at at time zone 'UTC'), litres)
  where deleted_at is null and machine_id is not null;
create index idx_fuel_org_time on public.fuel_logs(organization_id, occurred_at desc) where deleted_at is null;
create index idx_fuel_machine on public.fuel_logs(machine_id, occurred_at desc);
create index idx_fuel_project on public.fuel_logs(project_id);
create index idx_fuel_employee on public.fuel_logs(employee_id);
create index idx_fuel_country on public.fuel_logs(country_id);
create trigger trg_fuel_updated before update on public.fuel_logs
  for each row execute function app.touch_updated_at();

create or replace function app.validate_fuel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  perform app.assert_same_org(new.organization_id, 'receipts', new.receipt_id);
  if new.occurred_at > now() + interval '1 day' or new.occurred_at < now() - interval '400 days' then
    raise exception 'INVALID_DATE:fuel' using errcode = '23514';
  end if;
  -- derive missing money values, never overwrite provided ones
  if new.total_amount is null and new.price_per_litre is not null then
    new.total_amount := round(new.litres * new.price_per_litre, 2);
  elsif new.price_per_litre is null and new.total_amount is not null and new.litres > 0 then
    new.price_per_litre := round(new.total_amount / new.litres, 4);
  end if;
  if new.country_id is null and new.project_id is not null then
    select country_id into new.country_id from public.projects where id = new.project_id;
  end if;
  if new.country_id is null and new.machine_id is not null then
    select country_id into new.country_id from public.machines where id = new.machine_id;
  end if;
  -- keep machine meters current (only increases)
  if new.machine_id is not null and new.engine_hours is not null then
    update public.machines set engine_hours = new.engine_hours
      where id = new.machine_id and (engine_hours is null or engine_hours < new.engine_hours);
  end if;
  if new.machine_id is not null and new.mileage_km is not null then
    update public.machines set mileage_km = new.mileage_km
      where id = new.machine_id and (mileage_km is null or mileage_km < new.mileage_km);
  end if;
  return new;
end $$;
create trigger trg_fuel_validate before insert or update on public.fuel_logs
  for each row execute function app.validate_fuel();

-- EXPENSES ------------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expense_date date not null,
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  country_id uuid references public.countries(id),
  category text not null check (category in ('fuel','repair','parts','accommodation','food','transport','tools','materials','other')),
  receipt_id uuid references public.receipts(id) on delete set null,
  description text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','correction_requested','paid')),
  submitted_at timestamptz,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_comment text,
  paid_at timestamptz,
  idempotency_key text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index idx_expenses_org_date on public.expenses(organization_id, expense_date desc) where deleted_at is null;
create index idx_expenses_status on public.expenses(organization_id, status);
create index idx_expenses_employee on public.expenses(employee_id);
create index idx_expenses_project on public.expenses(project_id);
create index idx_expenses_machine on public.expenses(machine_id);
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function app.touch_updated_at();

create or replace function app.expense_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_is_approver boolean; v_is_finance boolean;
begin
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'receipts', new.receipt_id);
  if new.expense_date > (now() + interval '1 day')::date or new.expense_date < (now() - interval '400 days')::date then
    raise exception 'INVALID_DATE:expense' using errcode = '23514';
  end if;
  if new.country_id is null and new.project_id is not null then
    select country_id into new.country_id from public.projects where id = new.project_id;
  end if;
  -- submission needs minimal information
  if new.status = 'submitted' and new.receipt_id is null and coalesce(trim(new.description), '') = '' then
    raise exception 'EXPENSE_INCOMPLETE:receipt_or_description_required' using errcode = '23514';
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at := now();
  end if;

  if v_uid is null then return new; end if; -- system/service role

  v_is_finance := app.has_perm(new.organization_id, 'view_finance');
  v_is_approver := v_is_finance or (app.has_perm(new.organization_id, 'approve_expense')
                   and (new.project_id is null or app.leads_project(new.project_id)));

  if tg_op = 'INSERT' then
    if new.status not in ('draft','submitted') and not v_is_approver then
      raise exception 'PERMISSION_DENIED:expense_status' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('approved','rejected','correction_requested') then
      if not v_is_approver then raise exception 'PERMISSION_DENIED:approve_expense' using errcode = '42501'; end if;
      if old.created_by = v_uid and not app.has_role(new.organization_id, 'owner') then
        raise exception 'PERMISSION_DENIED:self_approval' using errcode = '42501';
      end if;
      new.decided_by := v_uid; new.decided_at := now();
    elsif new.status = 'paid' then
      if not v_is_finance then raise exception 'PERMISSION_DENIED:mark_paid' using errcode = '42501'; end if;
      if old.status <> 'approved' then raise exception 'INVALID_STATUS_TRANSITION' using errcode = '23514'; end if;
      new.paid_at := now();
    elsif new.status = 'submitted' then
      if old.status not in ('draft','correction_requested','rejected') then
        raise exception 'INVALID_STATUS_TRANSITION' using errcode = '23514';
      end if;
    end if;
  elsif not v_is_approver and old.status not in ('draft','correction_requested') then
    -- submitter can edit only drafts / returned expenses
    raise exception 'PERMISSION_DENIED:expense_locked' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_expenses_before before insert or update on public.expenses
  for each row execute function app.expense_before_write();

create or replace function app.expense_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    perform app.notify_permission_holders(new.organization_id, 'approve_expense', 'expense_submitted',
      'Jauns izdevums apstiprināšanai', new.amount::text || ' ' || new.currency, '/expenses/' || new.id, 'expense', new.id, new.created_by);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved','rejected','correction_requested') then
    select coalesce(e.user_id, new.created_by) into v_user from public.employees e where e.id = new.employee_id;
    v_user := coalesce(v_user, new.created_by);
    if v_user is not null then
      insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_user,
        case when new.status = 'approved' then 'expense_approved' else 'expense_rejected' end,
        case new.status when 'approved' then 'Izdevums apstiprināts' when 'rejected' then 'Izdevums noraidīts' else 'Izdevumam nepieciešami labojumi' end,
        coalesce(new.decision_comment, new.amount::text || ' ' || new.currency), '/expenses/' || new.id, 'expense', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger trg_expenses_notify after insert or update on public.expenses
  for each row execute function app.expense_notify();

-- MAINTENANCE -----------------------------------------------------------------------------
create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  performed_at date not null,
  engine_hours numeric(12,1) check (engine_hours is null or engine_hours >= 0),
  mileage_km numeric(12,1),
  maintenance_type text not null default 'service' check (maintenance_type in ('service','inspection','oil_change','tyres','other')),
  description text,
  cost numeric(12,2) check (cost is null or cost >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  performed_by_employee_id uuid references public.employees(id) on delete set null,
  external_service text,
  next_service_hours numeric(12,1),
  next_service_at date,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_maintenance_machine on public.maintenance_records(machine_id, performed_at desc);
create index idx_maintenance_org on public.maintenance_records(organization_id, performed_at desc);

create or replace function app.maintenance_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_interval integer;
begin
  select service_interval_hours into v_interval from public.machines where id = new.machine_id;
  if new.maintenance_type in ('service','oil_change') then
    update public.machines set
      last_service_at = new.performed_at,
      last_service_hours = coalesce(new.engine_hours, last_service_hours),
      next_service_hours = coalesce(new.next_service_hours,
                                    case when new.engine_hours is not null and v_interval is not null then new.engine_hours + v_interval end,
                                    next_service_hours),
      next_service_at = coalesce(new.next_service_at, next_service_at),
      engine_hours = greatest(coalesce(engine_hours, 0), coalesce(new.engine_hours, 0))
    where id = new.machine_id;
  end if;
  return new;
end $$;
create trigger trg_maintenance_after after insert on public.maintenance_records
  for each row execute function app.maintenance_after_insert();

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  title text not null,
  interval_hours integer check (interval_hours is null or interval_hours > 0),
  interval_days integer check (interval_days is null or interval_days > 0),
  last_done_hours numeric(12,1),
  last_done_at date,
  due_hours numeric(12,1),
  due_at date,
  status text not null default 'open' check (status in ('open','done','skipped')),
  created_at timestamptz not null default now()
);
create index idx_maintenance_tasks_machine on public.maintenance_tasks(machine_id);

-- REPAIRS ----------------------------------------------------------------------------------
create table public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  reported_by_employee_id uuid references public.employees(id) on delete set null,
  category text not null default 'other',
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'new' check (status in ('new','acknowledged','assigned','in_progress','waiting_parts','external_service','completed','cancelled')),
  latitude double precision,
  longitude double precision,
  location_text text,
  assigned_mechanic_id uuid references public.employees(id) on delete set null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  external_service text,
  labour_hours numeric(8,2) check (labour_hours is null or labour_hours >= 0),
  labour_cost numeric(12,2) check (labour_cost is null or labour_cost >= 0),
  external_cost numeric(12,2) check (external_cost is null or external_cost >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  downtime_hours numeric(10,2) check (downtime_hours is null or downtime_hours >= 0),
  resolution text,
  completed_at timestamptz,
  machine_down_since timestamptz,
  idempotency_key text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index idx_repairs_org_status on public.repair_requests(organization_id, status) where deleted_at is null;
create index idx_repairs_machine on public.repair_requests(machine_id, created_at desc);
create index idx_repairs_mechanic on public.repair_requests(assigned_mechanic_id);
create index idx_repairs_reporter on public.repair_requests(reported_by_employee_id);
create index idx_repairs_project on public.repair_requests(project_id);
create trigger trg_repairs_updated before update on public.repair_requests
  for each row execute function app.touch_updated_at();

create table public.repair_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repair_id uuid not null references public.repair_requests(id) on delete cascade,
  name text not null,
  part_number text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK')),
  supplier text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_repair_parts_repair on public.repair_parts(repair_id);

create table public.repair_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repair_id uuid not null references public.repair_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  comment text
);
create index idx_repair_history_repair on public.repair_status_history(repair_id, changed_at);

create or replace function app.repair_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_manage boolean;
begin
  perform app.assert_same_org(new.organization_id, 'machines', new.machine_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.reported_by_employee_id);
  perform app.assert_same_org(new.organization_id, 'employees', new.assigned_mechanic_id);
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
    if new.machine_down_since is not null and new.downtime_hours is null then
      new.downtime_hours := round(extract(epoch from (new.completed_at - new.machine_down_since)) / 3600.0, 2);
    end if;
  end if;
  if tg_op = 'INSERT' and new.priority = 'critical' and new.machine_down_since is null then
    new.machine_down_since := now();
  end if;
  if new.assigned_mechanic_id is not null and new.status in ('new','acknowledged')
     and (tg_op = 'INSERT' or old.assigned_mechanic_id is distinct from new.assigned_mechanic_id) then
    new.status := 'assigned';
  end if;
  if tg_op = 'UPDATE' and v_uid is not null then
    v_manage := app.has_perm(old.organization_id, 'manage_repairs') or app.has_perm(old.organization_id, 'approve_repairs');
    if not v_manage then
      -- reporter may only edit description/photos while still new
      if old.status <> 'new' or new.status is distinct from old.status
         or new.assigned_mechanic_id is distinct from old.assigned_mechanic_id
         or new.deleted_at is distinct from old.deleted_at then
        raise exception 'PERMISSION_DENIED:repair_update' using errcode = '42501';
      end if;
    end if;
    if new.approved_at is distinct from old.approved_at and not app.has_perm(old.organization_id, 'approve_repairs') then
      raise exception 'PERMISSION_DENIED:approve_repairs' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_repairs_before before insert or update on public.repair_requests
  for each row execute function app.repair_before_write();

create or replace function app.repair_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.repair_status_history (organization_id, repair_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, null, new.status, coalesce((select auth.uid()), new.created_by));
    perform app.notify_permission_holders(new.organization_id, 'manage_repairs', 'repair_submitted',
      case when new.priority = 'critical' then 'KRITISKS remonta pieteikums' else 'Jauns remonta pieteikums' end,
      new.title, '/repairs/' || new.id, 'repair', new.id, new.created_by);
    if new.priority = 'critical' then
      update public.machines set status = 'broken' where id = new.machine_id;
    end if;
  elsif new.status is distinct from old.status then
    insert into public.repair_status_history (organization_id, repair_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, old.status, new.status, (select auth.uid()));
    select user_id into v_user from public.employees where id = new.reported_by_employee_id;
    if v_user is not null and v_user is distinct from (select auth.uid()) then
      insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_user, 'repair_status', 'Remonta statuss mainīts', new.title, '/repairs/' || new.id, 'repair', new.id);
    end if;
    if new.status = 'completed' then
      update public.machines set status = 'active'
        where id = new.machine_id and status in ('broken','maintenance')
          and not exists (select 1 from public.repair_requests r where r.machine_id = new.machine_id and r.id <> new.id
                          and r.priority = 'critical' and r.status not in ('completed','cancelled') and r.deleted_at is null);
    elsif new.status in ('in_progress','waiting_parts','external_service') then
      update public.machines set status = 'maintenance' where id = new.machine_id and status = 'active' and new.priority in ('high','critical');
    end if;
  end if;
  if tg_op = 'UPDATE' and new.assigned_mechanic_id is distinct from old.assigned_mechanic_id and new.assigned_mechanic_id is not null then
    select user_id into v_user from public.employees where id = new.assigned_mechanic_id;
    if v_user is not null then
      insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_user, 'repair_submitted', 'Tev piešķirts remonts', new.title, '/repairs/' || new.id, 'repair', new.id);
    end if;
  end if;
  if tg_op = 'UPDATE' and new.approved_at is not null and old.approved_at is null then
    select user_id into v_user from public.employees where id = new.assigned_mechanic_id;
    if v_user is not null then
      insert into public.notifications (organization_id, user_id, type, title, body, link, entity_type, entity_id)
      values (new.organization_id, v_user, 'repair_approved', 'Remonts apstiprināts', new.title, '/repairs/' || new.id, 'repair', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger trg_repairs_after after insert or update on public.repair_requests
  for each row execute function app.repair_after_write();
