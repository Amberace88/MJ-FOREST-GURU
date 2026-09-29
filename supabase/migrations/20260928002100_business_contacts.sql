-- ============================================================================
-- MJ FOREST GURU — 2100 Business contacts (Klienti un darbi → Kontakti)
-- Buyers, forest owners, agencies and partners the owners work with or target.
-- Visible to manage_projects / view_finance, editable with manage_projects.
-- Soft delete only; audited; opportunities (forest_leads) can point to a contact.
-- ============================================================================
create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id) on delete set null,
  kind text not null default 'client' check (kind in ('client','buyer','forest_owner','agency','contractor','association','portal','other')),
  status text not null default 'prospect' check (status in ('prospect','contacted','active','inactive')),
  company_name text not null check (length(trim(company_name)) between 1 and 200),
  contact_name text check (contact_name is null or length(contact_name) <= 200),
  role text check (role is null or length(role) <= 120),
  phone text check (phone is null or length(phone) <= 50),
  email text check (email is null or length(email) <= 200),
  website text check (website is null or length(website) <= 300),
  notes text check (notes is null or length(notes) <= 5000),
  last_contact_at date,
  next_action text check (next_action is null or length(next_action) <= 300),
  next_action_at date,
  seed_key text,                                  -- standard market directory entries
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, seed_key)
);
create index if not exists idx_business_contacts_org on public.business_contacts(organization_id, kind) where deleted_at is null;

alter table public.forest_leads add column if not exists contact_id uuid references public.business_contacts(id) on delete set null;

drop trigger if exists trg_business_contacts_updated on public.business_contacts;
create trigger trg_business_contacts_updated before update on public.business_contacts
  for each row execute function app.touch_updated_at();

create or replace function app.guard_business_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'CROSS_ORG_REFERENCE:business_contacts' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  new.company_name := trim(new.company_name);
  return new;
end $$;
drop trigger if exists trg_business_contacts_guard on public.business_contacts;
create trigger trg_business_contacts_guard before insert or update on public.business_contacts
  for each row execute function app.guard_business_contact();

drop trigger if exists trg_audit_business_contacts on public.business_contacts;
create trigger trg_audit_business_contacts after insert or update or delete on public.business_contacts
  for each row execute function app.audit_row();

alter table public.business_contacts enable row level security;
drop policy if exists business_contacts_select on public.business_contacts;
create policy business_contacts_select on public.business_contacts for select to authenticated
  using (app.has_perm(organization_id, 'manage_projects') or app.has_perm(organization_id, 'view_finance'));
drop policy if exists business_contacts_insert on public.business_contacts;
create policy business_contacts_insert on public.business_contacts for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects'));
drop policy if exists business_contacts_update on public.business_contacts;
create policy business_contacts_update on public.business_contacts for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects')) with check (app.has_perm(organization_id, 'manage_projects'));
revoke delete, truncate on public.business_contacts from authenticated;
grant select, insert, update on public.business_contacts to authenticated;
