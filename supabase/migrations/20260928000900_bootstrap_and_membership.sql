-- ============================================================================
-- MJ FOREST GURU — 0900 Organization bootstrap, default roles, membership helpers
-- These functions are callable ONLY by the service role (server / setup scripts).
-- ============================================================================

create or replace function app.default_role_permissions(p_role text) returns text[]
language sql immutable as $$
  select case p_role
    when 'owner' then array(select key from public.permissions)
    when 'admin' then array[
      'view_dashboard','view_all_employees','edit_employees','view_team','manage_teams','view_employee_hours','edit_employee_hours',
      'approve_hours','view_finance','create_expense','approve_expense','view_fuel','edit_fuel','view_gps','view_live_gps',
      'view_gps_history','view_all_projects','manage_projects','manage_tasks','view_all_machines','manage_machines',
      'manage_repairs','approve_repairs','manage_documents','manage_safety','manage_incidents','manage_users',
      'manage_settings','view_analytics','export_reports']
    when 'manager' then array[
      'view_dashboard','view_team','approve_hours','manage_projects','manage_tasks','create_expense','approve_expense',
      'view_gps','view_live_gps','view_analytics','export_reports']
    when 'foreman' then array[
      'view_dashboard','view_team','approve_hours','manage_tasks','create_expense']
    when 'mechanic' then array[
      'view_dashboard','view_all_machines','manage_repairs','create_expense']
    when 'employee' then array['view_dashboard','create_expense']
    else array[]::text[]
  end
$$;

-- permissions table is referenced inside an immutable function above; mark stable instead
alter function app.default_role_permissions(text) stable;

create or replace function app.seed_org_defaults(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; v_role uuid;
begin
  insert into public.organization_settings (organization_id) values (p_org) on conflict do nothing;

  insert into public.countries (organization_id, code, name, flag, timezone, currency, site_identifier_fields, sort_order) values
    (p_org, 'LV', 'Latvija',  '🇱🇻', 'Europe/Riga',        'EUR', '["cirsmas_numurs","kadastra_numurs"]'::jsonb, 1),
    (p_org, 'SE', 'Zviedrija','🇸🇪', 'Europe/Stockholm',   'SEK', '["work_site_id","fastighet"]'::jsonb, 2),
    (p_org, 'IS', 'Islande',  '🇮🇸', 'Atlantic/Reykjavik', 'ISK', '["work_site_id","local_description"]'::jsonb, 3)
  on conflict (organization_id, code) do nothing;

  for r in select * from (values
      ('owner','Īpašnieks','Pilna piekļuve uzņēmumam',100),
      ('admin','Administrators','Administratīvā piekļuve',80),
      ('manager','Vadītājs','Piešķirtie objekti, komandas un uzdevumi',60),
      ('foreman','Brigadieris','Piešķirtā komanda un objekts',40),
      ('mechanic','Mehāniķis','Tehnika, apkope un remonti',30),
      ('employee','Darbinieks','Savs darbs, stundas un pieteikumi',10)) as t(key, name, description, rank)
  loop
    insert into public.roles (organization_id, key, name, description, is_system, rank)
    values (p_org, r.key, r.name, r.description, true, r.rank)
    on conflict (organization_id, key) do update set name = excluded.name
    returning id into v_role;
    insert into public.role_permissions (role_id, permission_key, organization_id)
    select v_role, k, p_org from unnest(app.default_role_permissions(r.key)) k
    on conflict do nothing;
  end loop;

  insert into public.lookup_values (organization_id, kind, key, label, sort_order) values
    (p_org,'work_type','harvesting','Ciršana (harvesters)',1),
    (p_org,'work_type','forwarding','Pievešana (forvarders)',2),
    (p_org,'work_type','thinning','Krājas kopšana',3),
    (p_org,'work_type','clearing','Jaunaudžu kopšana',4),
    (p_org,'work_type','mulching','Mulčēšana',5),
    (p_org,'work_type','planting','Stādīšana',6),
    (p_org,'work_type','transport','Transports',7),
    (p_org,'work_type','maintenance','Tehnikas apkope',8),
    (p_org,'work_type','other','Cits',9),
    (p_org,'fuel_type','diesel','Dīzeļdegviela',1),
    (p_org,'fuel_type','hvo','HVO',2),
    (p_org,'fuel_type','petrol','Benzīns',3),
    (p_org,'fuel_type','adblue','AdBlue',4),
    (p_org,'fuel_type','other','Cits',5),
    (p_org,'problem_category','engine','Dzinējs',1),
    (p_org,'problem_category','hydraulics','Hidraulika',2),
    (p_org,'problem_category','electrical','Elektrība',3),
    (p_org,'problem_category','tracks_tyres','Kāpurķēdes / riepas',4),
    (p_org,'problem_category','crane_head','Manipulators / galva',5),
    (p_org,'problem_category','cabin','Kabīne',6),
    (p_org,'problem_category','leak','Noplūde',7),
    (p_org,'problem_category','other','Cits',8),
    (p_org,'document_type','contract','Līgums',1),
    (p_org,'document_type','certificate','Sertifikāts',2),
    (p_org,'document_type','license','Licence / apliecība',3),
    (p_org,'document_type','insurance','Apdrošināšana',4),
    (p_org,'document_type','inspection','Tehniskā apskate',5),
    (p_org,'document_type','permit','Atļauja',6),
    (p_org,'document_type','manual','Instrukcija',7),
    (p_org,'document_type','other','Cits',8)
  on conflict do nothing;

  insert into public.machine_types (organization_id, category, name, default_service_interval_hours) values
    (p_org,'harvester','Harvesters',500),(p_org,'forwarder','Forvarders',500),(p_org,'tractor','Traktors',400),
    (p_org,'skidder','Skiders',400),(p_org,'mulcher','Mulčeris',300),(p_org,'truck','Kravas auto',null),
    (p_org,'trailer','Piekabe',null),(p_org,'van','Busiņš',null),(p_org,'car','Vieglais auto',null),(p_org,'other','Cits',null)
  on conflict do nothing;

  insert into public.integration_settings (organization_id, provider) values (p_org,'mapon'),(p_org,'mapbox'),(p_org,'email'),(p_org,'ocr')
  on conflict do nothing;
end $$;

-- Starter safety content (clearly marked as a template to review) -------------------------
create or replace function app.seed_safety_templates(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; v_rule uuid;
  v_note text := E'\n\n— Šis ir sākotnējais paraugs. Pārskatiet un pielāgojiet to atbilstoši uzņēmuma instrukcijām un katras valsts normatīvajiem aktiem. Sistēma neaizstāj likumā noteikto darba drošības dokumentāciju.';
begin
  if exists (select 1 from public.safety_rules where organization_id = p_org) then return; end if;
  for r in select * from (values
    ('general', 'Vispārīgie drošības noteikumi', 1, E'• Pirms darba sākuma iepazīsties ar objekta karti, bīstamajām zonām un evakuācijas ceļiem.\n• Strādā tikai ar tehniku un instrumentiem, kuru lietošanai esi apmācīts.\n• Par jebkuru bīstamu situāciju nekavējoties ziņo brigadierim un sistēmā.'),
    ('ppe', 'Individuālie aizsardzības līdzekļi (IAL)', 2, E'• Aizsargķivere ar sejsargu un dzirdes aizsargiem.\n• Augstas redzamības apģērbs.\n• Aizsargapavi ar purngalu un pretgriezuma aizsardzību, strādājot ar motorzāģi.\n• Aizsargcimdi.'),
    ('forestry', 'Mežizstrādes drošība', 3, E'• Ievēro drošu attālumu no gāžamā koka — vismaz divu koka garumu rādiusā.\n• Neuzturies tehnikas darba zonā, ja operators tevi neredz.\n• Esi īpaši uzmanīgs vējainā laikā un pie sakaltušiem kokiem.'),
    ('machinery', 'Tehnikas drošība', 4, E'• Pirms darba veic ikdienas tehnikas pārbaudi (noplūdes, hidraulika, bremzes, apgaismojums).\n• Tehniku apkopj un remontē tikai ar izslēgtu dzinēju un nolaistu manipulatoru.\n• Kabīnē nedrīkst atrasties nepiederošas personas.'),
    ('chainsaw', 'Darbs ar motorzāģi', 5, E'• Pirms iedarbināšanas pārbaudi ķēdes bremzi un ķēdes spriegojumu.\n• Iedarbini zāģi uz zemes vai droši nostiprinātu.\n• Nekad nezāģē ar sliedes galu (atsitiena risks).'),
    ('emergency', 'Rīcība ārkārtas situācijā', 6, E'• Ārkārtas gadījumā zvani 112.\n• Paziņo precīzu atrašanās vietu (koordinātas redzamas lietotnē).\n• Informē brigadieri un reģistrē incidentu sistēmā.'),
    ('fire', 'Ugunsdrošība', 7, E'• Tehnikā jābūt darba kārtībā esošam ugunsdzēšamajam aparātam.\n• Sausā periodā regulāri tīri tehniku no skaidām un eļļas.\n• Uzpildot degvielu, dzinējam jābūt izslēgtam.'),
    ('first_aid', 'Pirmā palīdzība', 8, E'• Pirmās palīdzības aptieciņai jāatrodas katrā tehnikā un transportlīdzeklī.\n• Zini, kur atrodas tuvākā medicīniskās palīdzības vieta.'),
    ('accident_reporting', 'Negadījumu ziņošana', 9, E'• Katru negadījumu un "gandrīz negadījumu" reģistrē sadaļā Incidenti tās pašas dienas laikā.\n• Pievieno fotogrāfijas un aprakstu, ko darīji uzreiz pēc notikuma.')
  ) as t(section, title, ord, body) loop
    insert into public.safety_rules (organization_id, section, title, sort_order, created_by)
    values (p_org, r.section, r.title, r.ord, p_user) returning id into v_rule;
    insert into public.safety_rule_versions (organization_id, rule_id, version, body, created_by)
    values (p_org, v_rule, 1, r.body || v_note, p_user);
  end loop;
end $$;

-- Create an organization with its first OWNER --------------------------------------------------
create or replace function public.bootstrap_organization(
  p_name text, p_slug text, p_owner_user uuid, p_owner_first_name text, p_owner_last_name text default '', p_is_demo boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_role uuid;
begin
  if not exists (select 1 from auth.users where id = p_owner_user) then
    raise exception 'OWNER_USER_NOT_FOUND';
  end if;
  insert into public.organizations (name, slug, is_demo) values (p_name, p_slug, p_is_demo) returning id into v_org;
  perform app.seed_org_defaults(v_org);
  insert into public.organization_members (organization_id, user_id, status, joined_at) values (v_org, p_owner_user, 'active', now());
  select id into v_role from public.roles where organization_id = v_org and key = 'owner';
  insert into public.user_roles (organization_id, user_id, role_id) values (v_org, p_owner_user, v_role);
  insert into public.employees (organization_id, user_id, first_name, last_name, email, job_title, country_id, status, is_demo, created_by)
  select v_org, p_owner_user, p_owner_first_name, coalesce(p_owner_last_name, ''), u.email, 'Īpašnieks',
         (select id from public.countries where organization_id = v_org and code = 'LV'), 'active', p_is_demo, p_owner_user
  from auth.users u where u.id = p_owner_user;
  update public.profiles set full_name = trim(p_owner_first_name || ' ' || coalesce(p_owner_last_name, '')) where id = p_owner_user;
  perform app.seed_safety_templates(v_org, p_owner_user);
  return v_org;
end $$;

-- Attach an (invited) auth user to an organization with a role --------------------------------------
create or replace function public.add_organization_member(
  p_org uuid, p_user uuid, p_role_key text, p_employee_id uuid default null,
  p_first_name text default null, p_last_name text default '', p_invited_by uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_role uuid; v_emp uuid := p_employee_id;
begin
  select id into v_role from public.roles where organization_id = p_org and key = p_role_key;
  if v_role is null then raise exception 'ROLE_NOT_FOUND'; end if;
  insert into public.organization_members (organization_id, user_id, status, invited_by, invited_at, joined_at)
  values (p_org, p_user, 'active', p_invited_by, now(), now())
  on conflict (organization_id, user_id) do update set status = 'active';
  insert into public.user_roles (organization_id, user_id, role_id, granted_by) values (p_org, p_user, v_role, p_invited_by)
  on conflict do nothing;
  if v_emp is not null then
    update public.employees set user_id = p_user where id = v_emp and organization_id = p_org and (user_id is null or user_id = p_user);
  elsif p_first_name is not null then
    insert into public.employees (organization_id, user_id, first_name, last_name, email, job_title, status, created_by)
    select p_org, p_user, p_first_name, coalesce(p_last_name, ''), u.email,
           (select name from public.roles where id = v_role), 'active', p_invited_by
    from auth.users u where u.id = p_user
    on conflict (organization_id, user_id) do nothing
    returning id into v_emp;
  end if;
  update public.profiles set full_name = coalesce(nullif(trim(coalesce(p_first_name,'') || ' ' || coalesce(p_last_name,'')), ''), full_name)
    where id = p_user;
  return v_emp;
end $$;

revoke execute on function public.bootstrap_organization(text, text, uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.add_organization_member(uuid, uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text, uuid, text, text, boolean) to service_role;
grant execute on function public.add_organization_member(uuid, uuid, text, uuid, text, text, uuid) to service_role;
revoke execute on function app.seed_org_defaults(uuid), app.seed_safety_templates(uuid, uuid) from authenticated;
