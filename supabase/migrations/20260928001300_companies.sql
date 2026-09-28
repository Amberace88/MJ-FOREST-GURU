-- ============================================================================
-- MJ FOREST GURU — 1300 Companies (legal entities inside the platform organization)
-- The organization is the holding ("MJ Forest Guru"); it manages several legal
-- companies (e.g. "Land Guru" LV, "Skog Guru" SE). Projects, employees, machines
-- and expenses can belong to one of them; the UI filters by company.
--   * soft delete only (deleted_at) — no DELETE policy
--   * cross-org references are rejected by triggers (app.assert_same_org)
--   * idempotent where cheap (re-runnable on a partially migrated database)
-- ============================================================================

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  legal_name text check (legal_name is null or length(legal_name) <= 200),
  registration_number text check (registration_number is null or length(registration_number) <= 60),
  vat_number text check (vat_number is null or length(vat_number) <= 60),
  country_id uuid references public.countries(id) on delete set null,
  address text check (address is null or length(address) <= 300),
  email text check (email is null or length(email) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  color text not null default '#3a7a48' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_companies_org_name on public.companies(organization_id, lower(name)) where deleted_at is null;
create index if not exists idx_companies_org on public.companies(organization_id, sort_order);

-- updated_at ----------------------------------------------------------------------
drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated before update on public.companies
  for each row execute function app.touch_updated_at();

-- cross-org guard (country) + immutable organization -------------------------------
create or replace function app.guard_company_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'CROSS_ORG_REFERENCE:companies' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  new.name := trim(new.name);
  return new;
end $$;
drop trigger if exists trg_companies_refs on public.companies;
create trigger trg_companies_refs before insert or update on public.companies
  for each row execute function app.guard_company_row();

-- audit (same generic row audit as every other business table) ---------------------
drop trigger if exists trg_audit_companies on public.companies;
create trigger trg_audit_companies after insert or update or delete on public.companies
  for each row execute function app.audit_row();

-- RLS -----------------------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (app.is_member(organization_id));
drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_settings'));
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (app.has_perm(organization_id, 'manage_settings')) with check (app.has_perm(organization_id, 'manage_settings'));
-- no DELETE policy: companies are soft-deleted (deleted_at)

-- grants: same shape as every other public table (RLS is the barrier; anon nothing)
revoke all on public.companies from anon;
grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;

-- company_id on business records ---------------------------------------------------
alter table public.projects  add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.employees add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.machines  add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.expenses  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_projects_company  on public.projects(company_id)  where company_id is not null;
create index if not exists idx_employees_company on public.employees(company_id) where company_id is not null;
create index if not exists idx_machines_company  on public.machines(company_id)  where company_id is not null;
create index if not exists idx_expenses_company  on public.expenses(company_id, expense_date) where company_id is not null;

-- Guard: company must belong to the same organization and must not be deleted when
-- it is (re)assigned. Existing links to a later-deleted company stay valid.
create or replace function app.guard_company_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_deleted timestamptz;
begin
  if new.company_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.company_id is not distinct from old.company_id then return new; end if;
  perform app.assert_same_org(new.organization_id, 'companies', new.company_id);
  select c.deleted_at into v_deleted from public.companies c where c.id = new.company_id;
  if v_deleted is not null then
    raise exception 'INVALID_REFERENCE:company_deleted' using errcode = '23514';
  end if;
  return new;
end $$;

-- Expenses without an explicit company inherit the project's company (like country_id).
-- Runs before the guard (trigger names fire alphabetically: _a… then _b…).
create or replace function app.expense_default_company() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.company_id is null and new.project_id is not null then
    select p.company_id into new.company_id
    from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_projects_company_ref on public.projects;
create trigger trg_projects_company_ref before insert or update of company_id on public.projects
  for each row execute function app.guard_company_ref();
drop trigger if exists trg_employees_company_ref on public.employees;
create trigger trg_employees_company_ref before insert or update of company_id on public.employees
  for each row execute function app.guard_company_ref();
drop trigger if exists trg_machines_company_ref on public.machines;
create trigger trg_machines_company_ref before insert or update of company_id on public.machines
  for each row execute function app.guard_company_ref();
drop trigger if exists trg_expenses_company_a_default on public.expenses;
create trigger trg_expenses_company_a_default before insert or update of company_id, project_id on public.expenses
  for each row execute function app.expense_default_company();
drop trigger if exists trg_expenses_company_b_ref on public.expenses;
create trigger trg_expenses_company_b_ref before insert or update of company_id, project_id on public.expenses
  for each row execute function app.guard_company_ref();

-- function privileges (consistent with 1100 hardening: trigger helpers are internal)
revoke execute on function app.guard_company_row(), app.guard_company_ref(), app.expense_default_company() from public, anon, authenticated;
grant execute on function app.guard_company_row(), app.guard_company_ref(), app.expense_default_company() to service_role;
