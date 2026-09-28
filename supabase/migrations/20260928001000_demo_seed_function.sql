-- ============================================================================
-- MJ FOREST GURU — 1000 DEMO data generator
-- * Runs ONLY for organizations flagged is_demo = true (hard guard)
-- * Executable ONLY by service_role (scripts/seed-demo.ts)
-- * Every generated row carries is_demo = true where the column exists
-- Production organizations never receive generated data.
-- ============================================================================

create or replace function public.seed_demo_data(p_org uuid, p_users jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_is_demo boolean;
  v_tz text;
  c_lv uuid; c_se uuid; c_is uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  e record; m record; p record;
  v_emp uuid; v_mach uuid; v_proj uuid; v_log uuid; v_rep uuid; v_rule record;
  v_day date; v_start timestamptz; v_end timestamptz; v_hours numeric; v_eh numeric;
  v_today_start timestamptz; v_now_local timestamp;
  v_i integer; v_n integer;
  emp_ids uuid[] := '{}'; mach_ids uuid[] := '{}';
  v_role_emp jsonb := '{}'::jsonb;
  v_price numeric; v_cur text; v_lat double precision; v_lng double precision;
  v_counts jsonb;
begin
  select is_demo into v_is_demo from public.organizations where id = p_org;
  if v_is_demo is distinct from true then
    raise exception 'DEMO_SEED_REFUSED: organization is not flagged is_demo';
  end if;
  if exists (select 1 from public.machines where organization_id = p_org and is_demo) then
    raise exception 'DEMO_SEED_ALREADY_APPLIED';
  end if;

  perform setseed(0.4242);
  v_tz := app.org_timezone(p_org);
  v_now_local := now() at time zone v_tz;
  v_today_start := date_trunc('day', v_now_local) at time zone v_tz;

  select id into c_lv from public.countries where organization_id = p_org and code = 'LV';
  select id into c_se from public.countries where organization_id = p_org and code = 'SE';
  select id into c_is from public.countries where organization_id = p_org and code = 'IS';

  insert into public.teams (organization_id, country_id, name) values (p_org, c_lv, 'Komanda 01') returning id into t1;
  insert into public.teams (organization_id, country_id, name) values (p_org, c_se, 'Komanda 02') returning id into t2;
  insert into public.teams (organization_id, country_id, name) values (p_org, c_se, 'Komanda 03') returning id into t3;
  insert into public.teams (organization_id, country_id, name) values (p_org, c_is, 'Komanda 04') returning id into t4;

  -- EMPLOYEES (5 LV / 8 SE / 4 IS) ----------------------------------------------------------
  create temp table _emp (id uuid, code text, country uuid, team uuid, title text, role_key text, first text, last text) on commit drop;
  insert into _emp (code, country, team, title, role_key, first, last) values
    ('lv1', c_lv, t1, 'Brigadieris',   'foreman',  'Andris',  'Kalniņš'),
    ('lv2', c_lv, t1, 'Harvestera operators', null, 'Mārtiņš', 'Ozols'),
    ('lv3', c_lv, t1, 'Forvardera operators', null, 'Edgars',  'Liepiņš'),
    ('lv4', c_lv, t1, 'Autovadītājs',  null,       'Raivis',  'Jansons'),
    ('lv5', c_lv, t1, 'Mežstrādnieks', null,       'Kristaps','Vītols'),
    ('se1', c_se, t3, 'Operators',     'employee', 'Jānis',   'Bērziņš'),
    ('se2', c_se, t3, 'Brigadieris',   null,       'Artūrs',  'Krūmiņš'),
    ('se3', c_se, t2, 'Objekta vadītājs','manager','Gints',   'Siliņš'),
    ('se4', c_se, t2, 'Harvestera operators', null, 'Rolands', 'Zariņš'),
    ('se5', c_se, t2, 'Forvardera operators', null, 'Dainis',  'Pētersons'),
    ('se6', c_se, t3, 'Forvardera operators', null, 'Erik',    'Lindqvist'),
    ('se7', c_se, t2, 'Mehāniķis',     'mechanic', 'Valdis',  'Grīnbergs'),
    ('se8', c_se, t3, 'Autovadītājs',  null,       'Oskars',  'Sproģis'),
    ('is1', c_is, t4, 'Brigadieris',   null,       'Guðmundur','Jónsson'),
    ('is2', c_is, t4, 'Harvestera operators', null, 'Toms',    'Balodis'),
    ('is3', c_is, t4, 'Traktorists',   null,       'Aigars',  'Eglītis'),
    ('is4', c_is, t4, 'Mežstrādnieks', null,       'Sigrún',  'Ólafsdóttir');

  for e in select * from _emp loop
    insert into public.employees (organization_id, user_id, first_name, last_name, email, phone, job_title, country_id, team_id, status, employment_start, is_demo)
    values (p_org,
            case when e.role_key is not null then nullif(p_users ->> e.role_key, '')::uuid end,
            e.first, e.last,
            lower(translate(e.first, 'āčēģīķļņšūžðóúíáéþæö', 'aceghiklnsuzdouiaetao')) || '.' ||
            lower(translate(e.last, 'āčēģīķļņšūžðóúíáéþæö', 'aceghiklnsuzdouiaetao')) || '@demo.mjforestguru.com',
            '+371 2' || lpad((floor(random() * 9999999))::text, 7, '0'),
            e.title, e.country, e.team,
            case when e.code = 'lv5' then 'on_leave' else 'active' end,
            (current_date - (200 + floor(random() * 1500))::int), true)
    returning id into v_emp;
    update _emp set id = v_emp where code = e.code;
    if e.role_key is not null then v_role_emp := v_role_emp || jsonb_build_object(e.role_key, v_emp); end if;
  end loop;
  -- DEMO compensation (only visible with view_salaries)
  insert into public.employee_compensation (employee_id, organization_id, hourly_rate, currency)
  select id, p_org, case when country = c_se then 185 + floor(random()*40) when country = c_is then 4200 + floor(random()*600) else 9 + round((random()*4)::numeric, 2) end,
         case when country = c_se then 'SEK' when country = c_is then 'ISK' else 'EUR' end from _emp;

  update public.teams set foreman_employee_id = (select id from _emp where code = 'lv1') where id = t1;
  update public.teams set manager_employee_id = (select id from _emp where code = 'se3'), foreman_employee_id = (select id from _emp where code = 'se4') where id = t2;
  update public.teams set manager_employee_id = (select id from _emp where code = 'se3'), foreman_employee_id = (select id from _emp where code = 'se2') where id = t3;
  update public.teams set foreman_employee_id = (select id from _emp where code = 'is1') where id = t4;

  -- PROJECTS (2 LV / 3 SE / 2 IS) -------------------------------------------------------------
  create temp table _proj (id uuid, code text, country uuid, team uuid, lat double precision, lng double precision, status text) on commit drop;
  insert into public.projects (organization_id, country_id, code, name, client_name, status, location_name, latitude, longitude, site_identifiers, area_ha, start_date, expected_end_date, is_demo, notes) values
    (p_org, c_lv, 'LV-018', 'Vecpiebalga — kailcirte', 'DEMO Klients SIA', 'active', 'Vecpiebalgas pag.', 57.0612, 25.8174, '{"cirsmas_numurs":"DEMO-4211-018","kadastra_numurs":"DEMO 4290 004 0112"}', 14.6, current_date - 21, current_date + 12, true, 'DEMO objekts'),
    (p_org, c_lv, 'LV-021', 'Jaunjelgava — krājas kopšana', 'DEMO Mežu īpašnieks', 'active', 'Jaunjelgavas pag.', 56.6128, 25.0791, '{"cirsmas_numurs":"DEMO-3120-021"}', 22.3, current_date - 9, current_date + 30, true, 'DEMO objekts'),
    (p_org, c_se, 'SE-042', 'Värmland — slutavverkning', 'DEMO Skog AB', 'active', 'Torsby', 60.1349, 13.0041, '{"work_site_id":"DEMO-WS-042","fastighet":"DEMO Torsby 3:14"}', 31.0, current_date - 34, current_date + 5, true, 'DEMO objekts'),
    (p_org, c_se, 'SE-045', 'Dalarna — gallring', 'DEMO Skog AB', 'active', 'Mora', 61.0049, 14.5374, '{"work_site_id":"DEMO-WS-045","fastighet":"DEMO Mora 7:2"}', 18.4, current_date - 12, current_date + 40, true, 'DEMO objekts'),
    (p_org, c_se, 'SE-039', 'Hälsingland — slutavverkning', 'DEMO Norrskog', 'completed', 'Bollnäs', 61.3480, 16.3941, '{"work_site_id":"DEMO-WS-039"}', 12.0, current_date - 80, current_date - 40, true, 'DEMO objekts (pabeigts)'),
    (p_org, c_is, 'IS-007', 'Hallormsstaður — grisjun', 'DEMO Skógræktin', 'active', 'Hallormsstaður', 65.0957, -14.7446, '{"work_site_id":"DEMO-IS-007","local_description":"Austurland"}', 9.5, current_date - 18, current_date + 25, true, 'DEMO objekts'),
    (p_org, c_is, 'IS-009', 'Skorradalur — stādīšana', 'DEMO Skógræktin', 'planned', 'Skorradalur', 64.5105, -21.4880, '{"work_site_id":"DEMO-IS-009"}', 6.0, current_date + 10, current_date + 60, true, 'DEMO objekts');
  update public.projects set actual_end_date = current_date - 38 where organization_id = p_org and code = 'SE-039';
  insert into _proj (id, code, country, lat, lng, status)
    select id, code, country_id, latitude, longitude, status from public.projects where organization_id = p_org and is_demo;
  update _proj set team = case code when 'LV-018' then t1 when 'LV-021' then t1 when 'SE-042' then t3 when 'SE-045' then t2 when 'SE-039' then t2 else t4 end;

  insert into public.project_teams (organization_id, project_id, team_id) select p_org, id, team from _proj where status in ('active','planned');
  insert into public.work_sites (organization_id, project_id, name, site_identifiers, latitude, longitude)
    select p_org, id, code || ' — nogabals A', '{}'::jsonb, lat + 0.004, lng - 0.006 from _proj
    union all select p_org, id, code || ' — nogabals B', '{}'::jsonb, lat - 0.003, lng + 0.005 from _proj where code in ('LV-018','SE-042');

  -- MACHINES (3 LV / 5 SE / 3 IS) -------------------------------------------------------------------
  create temp table _mach (id uuid, code text, name text, cat text, country uuid, proj text, eh numeric, lph numeric, interval_h int) on commit drop;
  insert into _mach (code, name, cat, country, proj, eh, lph, interval_h) values
    ('m1', 'Ponsse Scorpion King', 'harvester', c_lv, 'LV-018', 11840, 14.5, 500),
    ('m2', 'Ponsse Buffalo',       'forwarder', c_lv, 'LV-018',  9320, 11.0, 500),
    ('m3', 'Volvo FH16 kokvedējs', 'truck',     c_lv, 'LV-021', null,  null, null),
    ('m4', 'John Deere 1270G',     'harvester', c_se, 'SE-042', 7412, 15.5, 500),
    ('m5', 'John Deere 1510G',     'forwarder', c_se, 'SE-042', 6120, 11.5, 500),
    ('m6', 'John Deere 8R',        'tractor',   c_se, 'SE-042', 4281,  9.0, 400),
    ('m7', 'Komatsu 875',          'forwarder', c_se, 'SE-045', 8830, 12.0, 500),
    ('m8', 'Volvo FMX kokvedējs',  'truck',     c_se, 'SE-045', null,  null, null),
    ('m9', 'Komatsu 931XC',        'harvester', c_is, 'IS-007', 5310, 14.0, 500),
    ('m10','Valtra T254',          'tractor',   c_is, 'IS-007', 3175,  8.0, 400),
    ('m11','Toyota Hilux',         'car',       c_is, 'IS-007', null,  null, null);

  for m in select * from _mach loop
    insert into public.machines (organization_id, name, category, manufacturer, model, year, vin, registration_number, internal_code, country_id,
      status, engine_hours, mileage_km, fuel_type, service_interval_hours, last_service_hours, last_service_at, next_service_hours,
      insurance_valid_until, inspection_valid_until, current_project_id, is_demo, notes)
    values (p_org, m.name, m.cat, split_part(m.name, ' ', 1), substr(m.name, length(split_part(m.name, ' ', 1)) + 2),
      2016 + floor(random() * 8)::int,
      'DEMO' || upper(substr(md5(m.code), 1, 13)),
      case when m.cat in ('truck','car','van','tractor') then 'DEMO-' || upper(substr(md5(m.code || 'r'), 1, 5)) end,
      upper(m.code),
      m.country, 'active',
      m.eh - 30 * coalesce(m.lph, 0) / nullif(m.lph, 0) * 7,   -- will grow with generated work
      case when m.cat in ('truck','car','van') then 180000 + floor(random() * 250000) end,
      case when m.cat = 'car' then 'petrol' else 'diesel' end,
      m.interval_h,
      case when m.interval_h is not null then m.eh - 380 end,
      current_date - (40 + floor(random() * 60))::int,
      case when m.interval_h is not null then m.eh - 380 + m.interval_h end,
      current_date + (case when m.code = 'm2' then 19 else 90 + floor(random() * 200)::int end),
      current_date + (case when m.code = 'm8' then 11 else 60 + floor(random() * 250)::int end),
      (select id from _proj where code = m.proj), true, 'DEMO tehnika')
    returning id into v_mach;
    update _mach set id = v_mach where code = m.code;
  end loop;
  -- service states: John Deere 8R service soon, Komatsu 875 overdue
  update public.machines set next_service_hours = 4281 + 22 where id = (select id from _mach where code = 'm6');
  update public.machines set next_service_hours = 8830 - 14 where id = (select id from _mach where code = 'm7');

  insert into public.project_machines (organization_id, project_id, machine_id)
    select p_org, pr.id, ma.id from _mach ma join _proj pr on pr.code = ma.proj;

  -- project workers (by team) + leads
  insert into public.project_workers (organization_id, project_id, employee_id, project_role)
    select p_org, pr.id, em.id,
      case when em.code in ('se3') then 'manager' when em.title = 'Brigadieris' then 'foreman' when em.code = 'se7' then 'mechanic' else 'worker' end
    from _proj pr join _emp em on em.team = pr.team or (pr.code in ('SE-042','SE-045') and em.code in ('se3','se7'))
    where pr.status in ('active','planned')
    on conflict do nothing;

  -- WORK LOGS (last 30 days) ---------------------------------------------------------------------------
  -- operator -> machine mapping
  create temp table _op (emp text, mach text, proj text, work_type text) on commit drop;
  insert into _op values
    ('lv1', null, 'LV-018', 'harvesting'), ('lv2', 'm1', 'LV-018', 'harvesting'), ('lv3', 'm2', 'LV-018', 'forwarding'),
    ('lv4', 'm3', 'LV-021', 'transport'),  ('lv5', null, 'LV-021', 'thinning'),
    ('se1', 'm6', 'SE-042', 'forwarding'), ('se2', null, 'SE-042', 'harvesting'), ('se3', null, 'SE-045', 'other'),
    ('se4', 'm4', 'SE-042', 'harvesting'), ('se5', 'm5', 'SE-042', 'forwarding'), ('se6', 'm7', 'SE-045', 'forwarding'),
    ('se7', null, 'SE-045', 'maintenance'),('se8', 'm8', 'SE-045', 'transport'),
    ('is1', null, 'IS-007', 'thinning'),   ('is2', 'm9', 'IS-007', 'harvesting'), ('is3', 'm10','IS-007', 'thinning'),
    ('is4', null, 'IS-007', 'clearing');

  for e in select o.*, em.id as eid, ma.id as mid, pr.id as pid, em.code as ecode from _op o
           join _emp em on em.code = o.emp left join _mach ma on ma.code = o.mach join _proj pr on pr.code = o.proj loop
    for v_i in reverse 30..1 loop
      v_day := (v_now_local::date) - v_i;
      continue when extract(isodow from v_day) = 7;                          -- no Sundays
      continue when extract(isodow from v_day) = 6 and random() < 0.6;       -- some Saturdays
      continue when e.ecode = 'lv5' and v_i < 12;                            -- on leave recently
      continue when random() < 0.06;                                          -- occasional absence
      v_start := (v_day + time '06:40' + make_interval(mins => floor(random() * 50)::int))::timestamp at time zone v_tz;
      v_hours := 8 + round((random() * 2.5)::numeric, 2);
      v_end := v_start + make_interval(secs => (v_hours * 3600)::int);
      insert into public.work_logs (organization_id, employee_id, project_id, machine_id, work_type, started_at, ended_at, status, source, is_demo,
                                    start_lat, start_lng)
      select p_org, e.eid, e.pid, e.mid, e.work_type, v_start, v_end,
             case when v_i > 3 then 'approved' else 'completed' end, 'app', true, pr.lat + (random() - 0.5) * 0.01, pr.lng + (random() - 0.5) * 0.01
      from _proj pr where pr.id = e.pid
      returning id into v_log;
      insert into public.work_breaks (organization_id, work_log_id, started_at, ended_at)
      values (p_org, v_log, v_start + interval '5 hours', v_start + interval '5 hours 30 minutes');
    end loop;
    -- today: open shift for most (only if the local day has started)
    if v_now_local::time > time '07:20' and e.ecode not in ('lv5', 'se3', 'is4') then
      v_start := least((v_now_local::date + time '06:45' + make_interval(mins => floor(random() * 30)::int))::timestamp at time zone v_tz,
                       now() - interval '20 minutes');
      insert into public.work_logs (organization_id, employee_id, project_id, machine_id, work_type, started_at, status, source, is_demo, start_lat, start_lng)
      select p_org, e.eid, e.pid, e.mid, e.work_type, v_start, 'active', 'app', true, pr.lat + (random() - 0.5) * 0.01, pr.lng + (random() - 0.5) * 0.01
      from _proj pr where pr.id = e.pid;
    end if;
  end loop;
  -- one forgotten check-out from yesterday (drives "missing check-out" alert)
  delete from public.work_logs where organization_id = p_org and employee_id = (select id from _emp where code = 'is4') and ended_at is null;
  insert into public.work_logs (organization_id, employee_id, project_id, work_type, started_at, status, source, is_demo)
  values (p_org, (select id from _emp where code = 'is4'), (select id from _proj where code = 'IS-007'), 'clearing',
          ((v_now_local::date - 1) + time '07:05')::timestamp at time zone v_tz, 'active', 'app', true);

  -- engine hours follow worked hours (machines accumulate ~ net hours)
  update public.machines mm set engine_hours = sub.eh
  from (select ma.id, ma.eh as eh from _mach ma where ma.eh is not null) sub where mm.id = sub.id;

  -- FUEL (every ~2 days per fuel-using machine) ---------------------------------------------------------
  for m in select ma.*, c.code as ccode from _mach ma join public.countries c on c.id = ma.country loop
    v_eh := coalesce(m.eh, 0) - 30 * 0.8 * 8;
    v_price := case m.ccode when 'SE' then 19.40 when 'IS' then 318 else 1.52 end;
    v_cur := case m.ccode when 'SE' then 'SEK' when 'IS' then 'ISK' else 'EUR' end;
    for v_i in reverse 28..0 by 2 loop
      v_day := (v_now_local::date) - v_i;
      continue when extract(isodow from v_day) = 7;
      v_hours := 14 + random() * 6;                                   -- engine hours since last fill
      v_eh := v_eh + v_hours;
      continue when v_i = 0 and v_now_local::time < time '12:00';
      insert into public.fuel_logs (organization_id, occurred_at, employee_id, machine_id, project_id, fuel_type, litres, price_per_litre, currency,
                                    location_text, engine_hours, mileage_km, source, is_demo, notes)
      values (p_org, ((v_day + time '11:30' + make_interval(mins => floor(random() * 120)::int))::timestamp at time zone v_tz),
              (select eid from (select em.id as eid from _op o join _emp em on em.code = o.emp where o.mach = m.code limit 1) z),
              m.id, (select id from _proj where code = m.proj),
              case when m.cat = 'car' then 'petrol' else 'diesel' end,
              round((case when m.lph is not null then v_hours * m.lph * (0.9 + random() * 0.2)
                          when m.cat = 'truck' then 280 + random() * 150 else 45 + random() * 20 end)::numeric
                    * case when m.code = 'm7' and v_i = 2 then 2.3 else 1 end, 1),   -- one anomaly (Komatsu 875)
              round((v_price * (0.97 + random() * 0.06))::numeric, 3), v_cur,
              case m.ccode when 'SE' then 'Circle K Torsby' when 'IS' then 'N1 Egilsstaðir' else 'Virši Madona' end,
              case when m.lph is not null then round(v_eh::numeric, 1) end,
              null, 'employee', true, 'DEMO');
    end loop;
    if m.eh is not null then
      update public.machines set engine_hours = round(v_eh::numeric, 1) where id = m.id;
    end if;
  end loop;
  -- keep service states meaningful after engine-hour growth
  update public.machines set next_service_hours = engine_hours + 22 where id = (select id from _mach where code = 'm6');
  update public.machines set next_service_hours = engine_hours - 14 where id = (select id from _mach where code = 'm7');
  update public.machines set next_service_hours = engine_hours + 35 where id = (select id from _mach where code = 'm1');

  -- EXPENSES -------------------------------------------------------------------------------------------------
  insert into public.expenses (organization_id, expense_date, amount, currency, employee_id, project_id, machine_id, category, description, status, is_demo, submitted_at)
  select p_org, (v_now_local::date) - (gs % 26), round(x.amount::numeric, 2), x.cur, em.id, pr.id,
         case when x.cat in ('repair','parts') then (select id from _mach where proj = pr.code limit 1) end,
         x.cat, x.descr,
         case when gs % 26 <= 1 then 'submitted' when gs % 7 = 0 then 'rejected' when gs % 5 = 0 then 'paid' else 'approved' end,
         true, now() - make_interval(days => gs % 26)
  from generate_series(1, 32) gs
  cross join lateral (select * from (values
      ('accommodation', 'Naktsmītne komandai', 'LV-018'), ('food', 'Pusdienas brigādei', 'SE-042'), ('parts', 'Hidraulikas šļūtene', 'SE-045'),
      ('tools', 'Motorzāģa ķēdes', 'LV-021'), ('transport', 'Prāmis / ceļa nodeva', 'IS-007'), ('materials', 'Marķēšanas krāsa', 'SE-042'),
      ('repair', 'Riepas remonts', 'LV-018'), ('other', 'Darba apģērbs', 'SE-045')) v(cat, descr, pcode)
      offset (gs % 8) limit 1) t
  join _proj pr on pr.code = t.pcode
  join lateral (select em2.id from _emp em2 where em2.country = pr.country order by md5(em2.code || gs::text) limit 1) em on true
  cross join lateral (select t.cat,
      t.descr || ' (DEMO)' as descr,
      case when pr.country = c_se then 'SEK' when pr.country = c_is then 'ISK' else 'EUR' end as cur,
      case when pr.country = c_se then (400 + random() * 5200) when pr.country = c_is then (6000 + random() * 90000) else (25 + random() * 480) end as amount) x;

  -- MAINTENANCE --------------------------------------------------------------------------------------------------
  insert into public.maintenance_records (organization_id, machine_id, performed_at, engine_hours, maintenance_type, description, cost, currency, external_service, is_demo)
  select p_org, ma.id, current_date - (40 + floor(random() * 60))::int, ma.eh - 380, 'service', 'Plānotā apkope (eļļa, filtri) — DEMO',
         round((case when c.code = 'SE' then 9000 + random() * 6000 when c.code = 'IS' then 140000 + random() * 80000 else 850 + random() * 600 end)::numeric, 2),
         case c.code when 'SE' then 'SEK' when 'IS' then 'ISK' else 'EUR' end,
         case when random() < 0.4 then 'DEMO Serviss' end, true
  from _mach ma join public.countries c on c.id = ma.country where ma.eh is not null;
  -- maintenance trigger overwrote next service; restore demo states
  update public.machines set next_service_hours = engine_hours + 22 where id = (select id from _mach where code = 'm6');
  update public.machines set next_service_hours = engine_hours - 14 where id = (select id from _mach where code = 'm7');
  update public.machines set next_service_hours = engine_hours + 35 where id = (select id from _mach where code = 'm1');

  -- REPAIRS ---------------------------------------------------------------------------------------------------
  insert into public.repair_requests (organization_id, machine_id, project_id, reported_by_employee_id, category, title, description, priority, status,
      assigned_mechanic_id, labour_hours, labour_cost, external_cost, currency, downtime_hours, resolution, completed_at, created_at, is_demo)
  values
    (p_org, (select id from _mach where code='m7'), (select id from _proj where code='SE-045'), (select id from _emp where code='se6'),
     'hydraulics', 'Hidraulikas noplūde manipulatorā', 'Pie manipulatora pamatnes tek hidrauliskā eļļa, spiediens krīt. (DEMO)', 'critical', 'in_progress',
     (select id from _emp where code='se7'), 3.5, null, null, 'SEK', null, null, null, now() - interval '5 hours', true),
    (p_org, (select id from _mach where code='m4'), (select id from _proj where code='SE-042'), (select id from _emp where code='se4'),
     'crane_head', 'Galvas zāģa ķēdes spriegotājs', 'Ķēde bieži noslīd. (DEMO)', 'medium', 'waiting_parts',
     (select id from _emp where code='se7'), 1.0, null, null, 'SEK', null, null, null, now() - interval '2 days', true),
    (p_org, (select id from _mach where code='m1'), (select id from _proj where code='LV-018'), (select id from _emp where code='lv2'),
     'electrical', 'Nedarbojas darba lukturis', 'Aizmugurējais LED lukturis nedeg. (DEMO)', 'low', 'new',
     null, null, null, null, 'EUR', null, null, null, now() - interval '1 day', true),
    (p_org, (select id from _mach where code='m5'), (select id from _proj where code='SE-042'), (select id from _emp where code='se5'),
     'tracks_tyres', 'Kāpurķēdes nomaiņa', 'Nodilusi kreisā kāpurķēde. (DEMO)', 'high', 'completed',
     (select id from _emp where code='se7'), 6.0, 5400, null, 'SEK', 7.5, 'Kāpurķēde nomainīta. (DEMO)', now() - interval '9 days', now() - interval '10 days', true),
    (p_org, (select id from _mach where code='m9'), (select id from _proj where code='IS-007'), (select id from _emp where code='is2'),
     'engine', 'Dzinēja kļūdas kods', 'Parādās kļūda, jauda samazināta. (DEMO)', 'high', 'external_service',
     null, null, null, 185000, 'ISK', null, null, null, now() - interval '3 days', true),
    (p_org, (select id from _mach where code='m2'), (select id from _proj where code='LV-018'), (select id from _emp where code='lv3'),
     'leak', 'Dzesēšanas šķidruma noplūde', 'Nomainīts savienojums. (DEMO)', 'medium', 'completed',
     null, 2.0, 90, null, 'EUR', 3.0, 'Savienojums nomainīts. (DEMO)', now() - interval '16 days', now() - interval '17 days', true);
  insert into public.repair_parts (organization_id, repair_id, name, part_number, quantity, unit_cost, currency, supplier)
  select p_org, r.id, x.name, x.pn, x.q, x.c, r.currency, 'DEMO piegādātājs'
  from public.repair_requests r
  join (values ('Kāpurķēdes nomaiņa','Kāpurķēde 700mm','DEMO-TR-700',1,38500::numeric),
               ('Kāpurķēdes nomaiņa','Skrūvju komplekts','DEMO-BK-12',1,640::numeric),
               ('Dzesēšanas šķidruma noplūde','Savienojums','DEMO-CL-3',2,18.5::numeric),
               ('Hidraulikas noplūde manipulatorā','Hidraulikas šļūtene','DEMO-HS-22',1,2150::numeric)) x(title,name,pn,q,c)
    on x.title = r.title
  where r.organization_id = p_org;

  -- TASKS ------------------------------------------------------------------------------------------------------
  insert into public.tasks (organization_id, title, description, assignee_employee_id, team_id, project_id, machine_id, priority, deadline, status, position, is_demo)
  select p_org, x.title, x.descr || ' (DEMO)', (select id from _emp where code = x.emp), (select team from _emp where code = x.emp),
         (select id from _proj where code = x.proj), (select id from _mach where code = x.mach), x.prio,
         now() + make_interval(days => x.dd), x.st, x.pos, true
  from (values
    ('Nomarķēt robežas nogabalā B', 'Pārbaudīt un nomarķēt robežstigas', 'se2', 'SE-042', null, 'high', 1, 'in_progress', 1),
    ('Nogādāt kokmateriālus uz krautuvi', 'Visi sortimenti līdz piektdienai', 'se5', 'SE-042', 'm5', 'medium', 3, 'todo', 1),
    ('Ikdienas tehnikas pārbaude', 'Pārbaudīt noplūdes un apgaismojumu', 'se1', 'SE-042', 'm6', 'medium', 0, 'todo', 2),
    ('Pasūtīt hidraulikas šļūtenes', 'Rezerves šļūtenes Komatsu 875', 'se7', 'SE-045', 'm7', 'critical', 1, 'waiting', 1),
    ('Nomainīt ķēdes spriegotāju', 'Gaidām detaļu', 'se7', 'SE-042', 'm4', 'medium', 4, 'waiting', 2),
    ('Uzmērīt krautuvi', 'Nosūtīt apjomus klientam', 'lv1', 'LV-018', null, 'high', 2, 'todo', 3),
    ('Sagatavot pievešanas ceļu', 'Nolīdzināt ceļu pēc lietus', 'lv3', 'LV-018', 'm2', 'medium', 5, 'in_progress', 2),
    ('Transportēt stādus', 'Stādu partija no audzētavas', 'is3', 'IS-009', 'm10', 'low', 12, 'todo', 4),
    ('Iepazīstināt jauno darbinieku ar drošību', 'Drošības instruktāža', 'is1', 'IS-007', null, 'high', -1, 'todo', 5),
    ('Degvielas tvertnes pārbaude', 'Pārbaudīt noplūdes', 'lv4', 'LV-021', 'm3', 'medium', -3, 'done', 1),
    ('Nosūtīt atskaiti klientam', 'Nedēļas apjomu atskaite', 'se3', 'SE-045', null, 'medium', -2, 'done', 2),
    ('Nomainīt filtrus', 'Plānotā apkope', 'se7', 'SE-042', 'm6', 'medium', -5, 'done', 3)
  ) x(title, descr, emp, proj, mach, prio, dd, st, pos);

  -- PRODUCTION -------------------------------------------------------------------------------------------------
  insert into public.production_logs (organization_id, project_id, production_date, employee_id, machine_id, quantity, unit, work_type, is_demo)
  select p_org, pr.id, d::date, em.id, ma.id,
         round((case when pr.code like 'IS%' then 6 + random() * 5 else 55 + random() * 60 end)::numeric, 1),
         case when pr.code like 'IS%' then 'loads' else 'm3' end, 'harvesting', true
  from generate_series(v_now_local::date - 29, v_now_local::date - 1, interval '1 day') d
  join _op o on o.work_type = 'harvesting' and o.mach is not null
  join _emp em on em.code = o.emp join _mach ma on ma.code = o.mach join _proj pr on pr.code = o.proj
  where extract(isodow from d) < 6 and pr.status = 'active';

  -- INCIDENTS ---------------------------------------------------------------------------------------------------
  insert into public.incidents (organization_id, occurred_at, location_text, project_id, employee_id, machine_id, severity, incident_type, title, description,
                                immediate_action, status, is_demo)
  values
    (p_org, now() - interval '26 hours', 'SE-042, nogabals A', (select id from _proj where code='SE-042'), (select id from _emp where code='se5'),
     (select id from _mach where code='m5'), 'high', 'near_miss', 'Gandrīz negadījums — koks uzkrita uz ceļa',
     'Vēja dēļ nogāzts koks uzkrita uz pievešanas ceļa brīdī, kad tuvojās forvarders. (DEMO)', 'Darbs apturēts, ceļš attīrīts.', 'investigating', true),
    (p_org, now() - interval '12 days', 'LV-018 krautuve', (select id from _proj where code='LV-018'), (select id from _emp where code='lv3'),
     null, 'low', 'injury', 'Neliels roku savainojums', 'Skramba, strādājot bez cimdiem. (DEMO)', 'Sniegta pirmā palīdzība.', 'closed', true),
    (p_org, now() - interval '4 days', 'IS-007', (select id from _proj where code='IS-007'), null, (select id from _mach where code='m9'),
     'medium', 'environmental', 'Neliela eļļas noplūde', 'Konstatēti eļļas traipi pie tehnikas stāvvietas. (DEMO)', 'Izmantots absorbents.', 'action_required', true);

  -- TRAINING / DOCUMENTS ----------------------------------------------------------------------------------------------
  insert into public.safety_training (organization_id, title, description, validity_months, is_required) values
    (p_org, 'Motorzāģa operatora apliecība', 'DEMO', 60, true),
    (p_org, 'Pirmās palīdzības apmācība', 'DEMO', 36, true),
    (p_org, 'Harvestera operatora sertifikāts', 'DEMO', null, false);
  insert into public.employee_training (organization_id, employee_id, training_id, title, completed_at, expires_at, certificate_number, is_demo)
  select p_org, em.id, st.id, st.title,
         current_date - (300 + floor(random() * 700))::int,
         case when em.code = 'se1' and st.title like 'Pirm%' then current_date + 24
              when em.code = 'lv2' and st.title like 'Motorz%' then current_date - 6
              when st.validity_months is null then null
              else current_date + (120 + floor(random() * 700))::int end,
         'DEMO-' || upper(substr(md5(em.code || st.title), 1, 8)), true
  from _emp em cross join public.safety_training st
  where st.organization_id = p_org and (st.title not like 'Harvestera%' or em.title like 'Harvestera%');

  insert into public.documents (organization_id, entity_type, entity_id, name, document_type, issued_at, expiry_date, visibility, is_demo)
  select p_org, 'machine', ma.id, ma.name || ' — OCTA/KASKO polise (DEMO)', 'insurance', current_date - 300,
         (select insurance_valid_until from public.machines where id = ma.id), 'entity', true
  from _mach ma;
  insert into public.documents (organization_id, entity_type, entity_id, name, document_type, issued_at, expiry_date, visibility, is_demo)
  select p_org, 'employee', em.id, em.first || ' ' || em.last || ' — darba līgums (DEMO)', 'contract', current_date - 400, null, 'management', true
  from _emp em;
  insert into public.documents (organization_id, entity_type, entity_id, name, document_type, issued_at, expiry_date, visibility, is_demo)
  values (p_org, 'organization', null, 'Mežizstrādes atļauja SE-045 (DEMO)', 'permit', current_date - 60, current_date + 9, 'organization', true);

  -- SAFETY ACKNOWLEDGEMENTS (some employees) -----------------------------------------------------------------------------
  for v_rule in select sr.id, v.id as vid, v.version from public.safety_rules sr
                join public.safety_rule_versions v on v.rule_id = sr.id and v.version = sr.current_version
                where sr.organization_id = p_org loop
    insert into public.safety_acknowledgements (organization_id, rule_id, rule_version_id, version, employee_id, user_id)
    select p_org, v_rule.id, v_rule.vid, v_rule.version, em.id, em.user_id
    from public.employees em where em.organization_id = p_org and em.is_demo and em.user_id is not null and random() < 0.5
    on conflict do nothing;
  end loop;

  -- GPS (DEMO positions, source = manual; NOT Mapon data) ----------------------------------------------------------------
  insert into public.gps_positions (organization_id, machine_id, recorded_at, latitude, longitude, speed_kmh, engine_hours, ignition, source)
  select p_org, ma.id,
         case when exists (select 1 from public.work_logs wl where wl.machine_id = ma.id and wl.ended_at is null)
              then now() - make_interval(mins => (1 + floor(random() * 6))::int)
              else now() - make_interval(hours => (14 + floor(random() * 30))::int) end - make_interval(mins => k * 20),
         pr.lat + (random() - 0.5) * 0.02, pr.lng + (random() - 0.5) * 0.03,
         case when ma.cat in ('truck','car') then round((random() * 60)::numeric, 1) else round((random() * 6)::numeric, 1) end,
         (select engine_hours from public.machines where id = ma.id),
         exists (select 1 from public.work_logs wl where wl.machine_id = ma.id and wl.ended_at is null),
         'manual'
  from _mach ma join _proj pr on pr.code = ma.proj cross join generate_series(0, 11) k
  on conflict (machine_id, recorded_at, source) where machine_id is not null do nothing;

  select jsonb_build_object(
    'employees', (select count(*) from public.employees where organization_id = p_org and is_demo),
    'machines', (select count(*) from public.machines where organization_id = p_org and is_demo),
    'projects', (select count(*) from public.projects where organization_id = p_org and is_demo),
    'work_logs', (select count(*) from public.work_logs where organization_id = p_org and is_demo),
    'fuel_logs', (select count(*) from public.fuel_logs where organization_id = p_org and is_demo),
    'expenses', (select count(*) from public.expenses where organization_id = p_org and is_demo),
    'role_employees', v_role_emp
  ) into v_counts;
  return v_counts;
end $$;

revoke execute on function public.seed_demo_data(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.seed_demo_data(uuid, jsonb) to service_role;
