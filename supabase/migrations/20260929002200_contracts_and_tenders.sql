-- ============================================================================
-- MJ FOREST GURU — 2200 Contracts register (Līgumi) + public tender cache
--
-- contracts            signed / negotiated work contracts (client, value, volume,
--                      period, pricing, notice dates), linked to a contact, a won
--                      opportunity and the project that executes it
-- contract_milestones  deadlines, deliveries, invoices and payments per contract
-- tender_notices       shared, read-only cache of public procurement notices
--                      (IUB/EIS Latvia, TED) relevant to forestry; written only by
--                      the server (service role) during sync
-- tender_sync_state    last synced day per source
--
-- Visibility: manage_projects OR view_finance; edits: manage_projects.
-- Soft delete only; audited; cross-org references rejected.
-- ============================================================================

-- CONTRACTS -----------------------------------------------------------------------------------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  country_id uuid references public.countries(id) on delete set null,
  contact_id uuid references public.business_contacts(id) on delete set null,
  lead_id uuid references public.forest_leads(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  number text check (number is null or length(number) <= 100),
  title text not null check (length(trim(title)) between 1 and 200),
  client_name text check (client_name is null or length(client_name) <= 200),
  work_type text not null default 'harvesting' check (work_type in (
    'harvesting','thinning','forwarding','clearing','planting','young_stand','road','transport','timber_sale','other')),
  source text not null default 'private' check (source in ('tender','private','repeat','subcontract','other')),
  status text not null default 'negotiation' check (status in ('draft','negotiation','signed','active','completed','terminated','expired')),
  signed_at date,
  start_date date,
  end_date date,
  notice_date date,                                   -- last day to extend / terminate
  pricing_model text not null default 'per_m3' check (pricing_model in ('per_m3','per_ha','per_hour','per_tonne','fixed','other')),
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  total_value numeric(14,2) check (total_value is null or total_value >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK','NOK','USD')),
  volume_m3 numeric(12,1) check (volume_m3 is null or volume_m3 >= 0),
  area_ha numeric(10,2) check (area_ha is null or area_ha >= 0),
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days between 0 and 365),
  guarantee text check (guarantee is null or length(guarantee) <= 500),
  penalties text check (penalties is null or length(penalties) <= 2000),
  external_ref text check (external_ref is null or length(external_ref) <= 200),
  location text check (location is null or length(location) <= 300),
  notes text check (notes is null or length(notes) <= 5000),
  responsible_user uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contracts_period check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists idx_contracts_org on public.contracts(organization_id, status) where deleted_at is null;
create index if not exists idx_contracts_end on public.contracts(organization_id, end_date) where deleted_at is null;

create table if not exists public.contract_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  kind text not null default 'deadline' check (kind in ('deadline','delivery','invoice','payment','inspection','other')),
  title text not null check (length(trim(title)) between 1 and 200),
  due_date date,
  amount numeric(14,2) check (amount is null or amount >= 0),
  done_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_contract_milestones_contract on public.contract_milestones(contract_id) where deleted_at is null;
create index if not exists idx_contract_milestones_due on public.contract_milestones(organization_id, due_date) where deleted_at is null and done_at is null;

drop trigger if exists trg_contracts_updated on public.contracts;
create trigger trg_contracts_updated before update on public.contracts
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_contract_milestones_updated on public.contract_milestones;
create trigger trg_contract_milestones_updated before update on public.contract_milestones
  for each row execute function app.touch_updated_at();

create or replace function app.guard_contract() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'CROSS_ORG_REFERENCE:contracts' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'companies', new.company_id);
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  perform app.assert_same_org(new.organization_id, 'business_contacts', new.contact_id);
  perform app.assert_same_org(new.organization_id, 'forest_leads', new.lead_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  new.title := trim(new.title);
  return new;
end $$;
drop trigger if exists trg_contracts_guard on public.contracts;
create trigger trg_contracts_guard before insert or update on public.contracts
  for each row execute function app.guard_contract();

create or replace function app.guard_contract_milestone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.contract_id is distinct from old.contract_id) then
    raise exception 'CROSS_ORG_REFERENCE:contract_milestones' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'contracts', new.contract_id);
  new.title := trim(new.title);
  return new;
end $$;
drop trigger if exists trg_contract_milestones_guard on public.contract_milestones;
create trigger trg_contract_milestones_guard before insert or update on public.contract_milestones
  for each row execute function app.guard_contract_milestone();

drop trigger if exists trg_audit_contracts on public.contracts;
create trigger trg_audit_contracts after insert or update or delete on public.contracts
  for each row execute function app.audit_row();
drop trigger if exists trg_audit_contract_milestones on public.contract_milestones;
create trigger trg_audit_contract_milestones after insert or update or delete on public.contract_milestones
  for each row execute function app.audit_row();

alter table public.contracts enable row level security;
alter table public.contract_milestones enable row level security;

drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts for select to authenticated
  using (app.has_perm(organization_id, 'manage_projects') or app.has_perm(organization_id, 'view_finance'));
drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects'));
drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects')) with check (app.has_perm(organization_id, 'manage_projects'));

drop policy if exists contract_milestones_select on public.contract_milestones;
create policy contract_milestones_select on public.contract_milestones for select to authenticated
  using (app.has_perm(organization_id, 'manage_projects') or app.has_perm(organization_id, 'view_finance'));
drop policy if exists contract_milestones_insert on public.contract_milestones;
create policy contract_milestones_insert on public.contract_milestones for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects'));
drop policy if exists contract_milestones_update on public.contract_milestones;
create policy contract_milestones_update on public.contract_milestones for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects')) with check (app.has_perm(organization_id, 'manage_projects'));

revoke delete, truncate on public.contracts, public.contract_milestones from authenticated;
grant select, insert, update on public.contracts, public.contract_milestones to authenticated;

-- contract documents live in public.files (entity_type = 'contract')
alter table public.files drop constraint if exists files_entity_type_check;
alter table public.files add constraint files_entity_type_check check (entity_type in (
  'employee','machine','project','organization','safety_rule','repair','expense','fuel','incident','task','production','receipt','contract'));

create or replace function app.entity_visible(p_type text, p_id uuid) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_id is null then return false; end if;
  case p_type
    when 'task'        then return exists (select 1 from public.tasks where id = p_id);
    when 'repair'      then return exists (select 1 from public.repair_requests where id = p_id);
    when 'project'     then return exists (select 1 from public.projects where id = p_id);
    when 'incident'    then return exists (select 1 from public.incidents where id = p_id);
    when 'expense'     then return exists (select 1 from public.expenses where id = p_id);
    when 'employee'    then return exists (select 1 from public.employees where id = p_id);
    when 'machine'     then return exists (select 1 from public.machines where id = p_id);
    when 'fuel'        then return exists (select 1 from public.fuel_logs where id = p_id);
    when 'receipt'     then return exists (select 1 from public.receipts where id = p_id);
    when 'production'  then return exists (select 1 from public.production_logs where id = p_id);
    when 'safety_rule' then return exists (select 1 from public.safety_rules where id = p_id);
    when 'contract'    then return exists (select 1 from public.contracts where id = p_id and deleted_at is null);
    when 'organization' then return app.is_member(p_id);
    else return false;
  end case;
end $$;
grant execute on function app.entity_visible(text, uuid) to authenticated;

-- new notification kinds: new relevant tender, contract deadline
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'task_assigned','repair_submitted','repair_approved','repair_status','expense_submitted','expense_approved','expense_rejected',
  'incident_reported','training_expiring','document_expiring','service_due','missing_checkout','system_alert',
  'tender_new','contract_due'));

-- PUBLIC TENDER CACHE (shared, read-only for users) -------------------------------------------
create table if not exists public.tender_notices (
  id text primary key,                                -- '<source>:<identifier>'
  source text not null check (source in ('iub','ted')),
  country text not null check (country in ('LV','SE','IS','EE','LT','FI','NO')),
  stage text not null check (stage in ('planning','competition','result','other')),
  notice_type text,
  title text not null,
  description text,
  buyer_name text,
  buyer_reg_no text,
  buyer_city text,
  buyer_email text,
  buyer_phone text,
  region text,
  cpv text,
  cpv_extra text[] not null default '{}',
  category text not null default 'other' check (category in ('harvesting','trees','planting','timber','other')),
  score integer not null default 0,
  nature text,
  procedure text,
  reference text,
  published_on date,
  deadline timestamptz,
  duration_months integer,
  estimated_value numeric(16,2),
  currency text,
  url text,
  fetched_at timestamptz not null default now()
);
create index if not exists idx_tender_notices_pub on public.tender_notices(published_on desc);
create index if not exists idx_tender_notices_deadline on public.tender_notices(deadline);

create table if not exists public.tender_sync_state (
  source text primary key,
  last_day date,
  last_run_at timestamptz,
  last_error text
);

alter table public.tender_notices enable row level security;
alter table public.tender_sync_state enable row level security;
drop policy if exists tender_notices_select on public.tender_notices;
create policy tender_notices_select on public.tender_notices for select to authenticated using (true);
drop policy if exists tender_sync_state_select on public.tender_sync_state;
create policy tender_sync_state_select on public.tender_sync_state for select to authenticated using (true);
revoke insert, update, delete, truncate on public.tender_notices, public.tender_sync_state from authenticated;
grant select on public.tender_notices, public.tender_sync_state to authenticated;
revoke all on public.tender_notices, public.tender_sync_state from anon;
