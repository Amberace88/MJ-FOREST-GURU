-- ============================================================================
-- MJ FOREST GURU — 1800 Forest map opportunities (Meža karte → Iespējas)
-- A lightweight sales pipeline for new work: a pinned place on the forest map
-- (e.g. a Swedish felling notification, an LVM tender lot, a private owner's
-- stand) with contact, volume/value estimate and status. "Won" leads can be
-- turned into projects.
--   * visibility: manage_projects OR view_finance (owners/admins/managers)
--   * soft delete only (deleted_at) — no DELETE policy
--   * cross-org references rejected (app.assert_same_org), audited
-- ============================================================================

create table if not exists public.forest_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  country_id uuid references public.countries(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,   -- set when won → project
  title text not null check (length(trim(title)) between 1 and 200),
  status text not null default 'new' check (status in ('new','contacted','survey','offer','won','lost')),
  source text not null default 'other' check (source in ('felling_notice','tender','owner','buyer','referral','map','other')),
  work_type text check (work_type is null or work_type in ('final_felling','thinning','planting','young_stand','road','other')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  area_ha numeric(10,2) check (area_ha is null or area_ha >= 0),
  volume_m3 numeric(12,1) check (volume_m3 is null or volume_m3 >= 0),
  price_per_m3 numeric(10,2) check (price_per_m3 is null or price_per_m3 >= 0),
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  currency text not null default 'EUR' check (currency in ('EUR','SEK','ISK','NOK','USD')),
  probability integer check (probability is null or probability between 0 and 100),
  cadastre_no text check (cadastre_no is null or length(cadastre_no) <= 100),
  external_ref text check (external_ref is null or length(external_ref) <= 100),  -- e.g. avverkningsanmälan nr, EIS id
  owner_name text check (owner_name is null or length(owner_name) <= 200),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 50),
  contact_email text check (contact_email is null or length(contact_email) <= 200),
  next_action text check (next_action is null or length(next_action) <= 300),
  next_action_at date,
  notes text check (notes is null or length(notes) <= 5000),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_forest_leads_org on public.forest_leads(organization_id, status) where deleted_at is null;
create index if not exists idx_forest_leads_next on public.forest_leads(organization_id, next_action_at) where deleted_at is null and status not in ('won','lost');

drop trigger if exists trg_forest_leads_updated on public.forest_leads;
create trigger trg_forest_leads_updated before update on public.forest_leads
  for each row execute function app.touch_updated_at();

create or replace function app.guard_forest_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'CROSS_ORG_REFERENCE:forest_leads' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'companies', new.company_id);
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  perform app.assert_same_org(new.organization_id, 'projects', new.project_id);
  new.title := trim(new.title);
  if new.estimated_value is null and new.volume_m3 is not null and new.price_per_m3 is not null then
    new.estimated_value := round(new.volume_m3 * new.price_per_m3, 2);
  end if;
  return new;
end $$;
drop trigger if exists trg_forest_leads_guard on public.forest_leads;
create trigger trg_forest_leads_guard before insert or update on public.forest_leads
  for each row execute function app.guard_forest_lead();

drop trigger if exists trg_audit_forest_leads on public.forest_leads;
create trigger trg_audit_forest_leads after insert or update or delete on public.forest_leads
  for each row execute function app.audit_row();

alter table public.forest_leads enable row level security;

drop policy if exists forest_leads_select on public.forest_leads;
create policy forest_leads_select on public.forest_leads for select to authenticated
  using (app.has_perm(organization_id, 'manage_projects') or app.has_perm(organization_id, 'view_finance'));
drop policy if exists forest_leads_insert on public.forest_leads;
create policy forest_leads_insert on public.forest_leads for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects'));
drop policy if exists forest_leads_update on public.forest_leads;
create policy forest_leads_update on public.forest_leads for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects')) with check (app.has_perm(organization_id, 'manage_projects'));

revoke delete, truncate on public.forest_leads from authenticated;
grant select, insert, update on public.forest_leads to authenticated;
