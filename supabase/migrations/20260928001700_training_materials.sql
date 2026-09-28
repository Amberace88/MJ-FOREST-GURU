-- ============================================================================
-- MJ FOREST GURU — 1700 Training materials library (Apmācības → Mācību materiāli)
-- Structured, versioned reading material (rules, guides, instructions) with
-- per-version acknowledgements ("Esmu izlasījis un sapratis").
--   * built-in (standard) materials are synced from code (builtin_key / builtin_version)
--   * `version` is the published version; publishing a changed body bumps it and
--     every employee must acknowledge again (acks point at material + version)
--   * soft delete only (deleted_at) — no DELETE policy
--   * acknowledgements are immutable, server-timestamped, own-employee only
-- ============================================================================

create table if not exists public.training_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  builtin_key text check (builtin_key is null or builtin_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  builtin_version integer check (builtin_version is null or builtin_version >= 1),
  is_customized boolean not null default false,          -- built-in copy edited by the organization
  category text not null default 'other'
    check (category in ('platform','safety','machinery','reporting','emergency','environment','other')),
  country_id uuid references public.countries(id) on delete set null,   -- null = all countries
  title text not null check (length(trim(title)) between 1 and 200),
  subtitle text check (subtitle is null or length(subtitle) <= 400),
  summary text check (summary is null or length(summary) <= 2000),
  audience text[] not null default '{}'
    check (audience <@ array['owner','admin','manager','foreman','mechanic','employee']::text[]),
  body text not null default '' check (length(body) <= 200000),
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft','published')),
  published_hash text,                                    -- sha-256 of the body at last publish
  published_at timestamptz,
  requires_acknowledgement boolean not null default true,
  reading_minutes integer check (reading_minutes is null or reading_minutes between 1 and 600),
  source_notes text check (source_notes is null or length(source_notes) <= 20000),   -- generator input
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_training_materials_builtin
  on public.training_materials(organization_id, builtin_key) where builtin_key is not null;
create index if not exists idx_training_materials_org
  on public.training_materials(organization_id, category, title) where deleted_at is null;
create index if not exists idx_training_materials_country on public.training_materials(country_id);

drop trigger if exists trg_training_materials_updated on public.training_materials;
create trigger trg_training_materials_updated before update on public.training_materials
  for each row execute function app.touch_updated_at();

-- guard: org immutable, country from the same org, version never goes backwards
create or replace function app.guard_training_material() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'CROSS_ORG_REFERENCE:training_materials' using errcode = '23514';
    end if;
    if new.version < old.version then
      raise exception 'INVALID_VERSION:training_materials' using errcode = '23514';
    end if;
  end if;
  perform app.assert_same_org(new.organization_id, 'countries', new.country_id);
  new.title := trim(new.title);
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_training_materials_guard on public.training_materials;
create trigger trg_training_materials_guard before insert or update on public.training_materials
  for each row execute function app.guard_training_material();

drop trigger if exists trg_audit_training_materials on public.training_materials;
create trigger trg_audit_training_materials after insert or update or delete on public.training_materials
  for each row execute function app.audit_row();

-- ACKNOWLEDGEMENTS -------------------------------------------------------------------
create table if not exists public.training_material_acks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.training_materials(id) on delete cascade,
  version integer not null check (version >= 1),
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  acknowledged_at timestamptz not null default now(),
  unique (material_id, version, employee_id)
);
create index if not exists idx_training_material_acks_employee on public.training_material_acks(employee_id);
create index if not exists idx_training_material_acks_material on public.training_material_acks(material_id, version);
create index if not exists idx_training_material_acks_org on public.training_material_acks(organization_id);

create or replace function app.training_ack_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_version integer; v_status text; v_deleted timestamptz;
begin
  select organization_id, version, status, deleted_at into v_org, v_version, v_status, v_deleted
    from public.training_materials where id = new.material_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'CROSS_ORG_REFERENCE:training_material_acks' using errcode = '23514';
  end if;
  if v_status <> 'published' or v_deleted is not null or new.version <> v_version then
    raise exception 'INVALID_ACKNOWLEDGEMENT' using errcode = '23514';
  end if;
  perform app.assert_same_org(new.organization_id, 'employees', new.employee_id);
  new.acknowledged_at := now();   -- server time, never client supplied
  return new;
end $$;
drop trigger if exists trg_training_ack_before on public.training_material_acks;
create trigger trg_training_ack_before before insert on public.training_material_acks
  for each row execute function app.training_ack_before_insert();

drop trigger if exists trg_audit_training_material_acks on public.training_material_acks;
create trigger trg_audit_training_material_acks after insert or update or delete on public.training_material_acks
  for each row execute function app.audit_row();

-- RLS ---------------------------------------------------------------------------------
alter table public.training_materials enable row level security;
alter table public.training_material_acks enable row level security;

drop policy if exists training_materials_select on public.training_materials;
create policy training_materials_select on public.training_materials for select to authenticated
  using (
    app.is_member(organization_id) and (
      (status = 'published' and deleted_at is null)
      or app.has_perm(organization_id, 'manage_safety')
    )
  );
drop policy if exists training_materials_insert on public.training_materials;
create policy training_materials_insert on public.training_materials for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_safety'));
drop policy if exists training_materials_update on public.training_materials;
create policy training_materials_update on public.training_materials for update to authenticated
  using (app.has_perm(organization_id, 'manage_safety')) with check (app.has_perm(organization_id, 'manage_safety'));
-- no DELETE policy: materials are soft-deleted (deleted_at)

drop policy if exists training_acks_select on public.training_material_acks;
create policy training_acks_select on public.training_material_acks for select to authenticated
  using (
    app.is_member(organization_id) and (
      employee_id = app.my_employee_id(organization_id)
      or user_id = (select auth.uid())
      or app.has_perm(organization_id, 'manage_safety')
      or app.has_perm(organization_id, 'view_all_employees')
    )
  );
drop policy if exists training_acks_insert on public.training_material_acks;
create policy training_acks_insert on public.training_material_acks for insert to authenticated
  with check (
    app.is_member(organization_id)
    and user_id = (select auth.uid())
    and employee_id = app.my_employee_id(organization_id)
  );

-- AUDIENCE (manager progress) ------------------------------------------------------------
-- Employees who can acknowledge (linked, active user account) with their role keys.
-- user_roles is only readable with manage_users, so this is a narrow definer RPC
-- gated by manage_safety — it exposes names + role keys, nothing else.
create or replace function public.training_audience(p_org uuid)
returns table (employee_id uuid, full_name text, country_id uuid, roles text[])
language sql stable security definer set search_path = '' as $$
  select e.id, e.full_name, e.country_id,
         coalesce(array_agg(distinct r.key) filter (where r.key is not null), '{}'::text[])
    from public.employees e
    join public.organization_members m
      on m.organization_id = e.organization_id and m.user_id = e.user_id and m.status = 'active'
    left join public.user_roles ur on ur.organization_id = e.organization_id and ur.user_id = e.user_id
    left join public.roles r on r.id = ur.role_id
   where e.organization_id = p_org
     and app.has_perm(p_org, 'manage_safety')
     and e.user_id is not null
     and e.deleted_at is null
     and e.archived_at is null
     and e.status in ('active', 'on_leave')
   group by e.id, e.full_name, e.country_id
   order by e.full_name
$$;
revoke execute on function public.training_audience(uuid) from public, anon;
grant execute on function public.training_audience(uuid) to authenticated, service_role;

-- grants: RLS is the barrier; acknowledgements are append-only
revoke all on public.training_materials, public.training_material_acks from anon;
grant select, insert, update on public.training_materials to authenticated;
grant select, insert on public.training_material_acks to authenticated;
revoke update, delete, truncate on public.training_material_acks from authenticated;
revoke delete, truncate on public.training_materials from authenticated;
grant all on public.training_materials, public.training_material_acks to service_role;
grant execute on function app.guard_training_material(), app.training_ack_before_insert() to service_role;
