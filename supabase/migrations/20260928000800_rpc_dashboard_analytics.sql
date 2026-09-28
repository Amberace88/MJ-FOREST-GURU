-- ============================================================================
-- MJ FOREST GURU — 0800 RPCs: dashboard, alerts, analytics, search
-- All read RPCs are SECURITY INVOKER => they only see what RLS lets the caller see.
-- Figures are computed from real rows; missing data yields NULL (UI: "Nav datu").
-- ============================================================================

create or replace function app.overlap_hours(s timestamptz, e timestamptz, a timestamptz, b timestamptz)
returns numeric language sql immutable as $$
  select greatest(0, extract(epoch from (least(e, b) - greatest(s, a))))::numeric / 3600.0
$$;

create or replace function app.org_timezone(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select default_timezone from public.organization_settings where organization_id = p_org), 'Europe/Riga')
$$;
grant execute on function app.overlap_hours(timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function app.org_timezone(uuid) to authenticated;

-- Net worked hours of visible work logs inside [p_from, p_to)
create or replace function public.work_hours_between(p_org uuid, p_from timestamptz, p_to timestamptz, p_country uuid default null)
returns table (employee_id uuid, project_id uuid, machine_id uuid, work_log_id uuid, gross_hours numeric, break_hours numeric, net_hours numeric)
language sql stable security invoker set search_path = '' as $$
  select wl.employee_id, wl.project_id, wl.machine_id, wl.id,
    app.overlap_hours(wl.started_at, coalesce(wl.ended_at, now()), p_from, p_to) as gross,
    coalesce((select sum(app.overlap_hours(b.started_at, coalesce(b.ended_at, now()), greatest(wl.started_at, p_from), least(coalesce(wl.ended_at, now()), p_to)))
              from public.work_breaks b where b.work_log_id = wl.id), 0) as brk,
    greatest(0, app.overlap_hours(wl.started_at, coalesce(wl.ended_at, now()), p_from, p_to)
      - coalesce((select sum(app.overlap_hours(b.started_at, coalesce(b.ended_at, now()), greatest(wl.started_at, p_from), least(coalesce(wl.ended_at, now()), p_to)))
                  from public.work_breaks b where b.work_log_id = wl.id), 0)) as net
  from public.work_logs wl
  left join public.projects p on p.id = wl.project_id
  left join public.employees e on e.id = wl.employee_id
  where wl.organization_id = p_org and wl.deleted_at is null
    and wl.started_at < p_to and coalesce(wl.ended_at, now()) > p_from
    and (p_country is null or coalesce(p.country_id, e.country_id) = p_country)
$$;

-- DASHBOARD KPIs ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(p_org uuid, p_country uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tz text := app.org_timezone(p_org);
  v_day_start timestamptz := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_day_end timestamptz := v_day_start + interval '1 day';
  r jsonb;
begin
  select jsonb_build_object(
    'timezone', v_tz,
    'day_start', v_day_start,
    'employees_total', (select count(*) from public.employees e
        where e.organization_id = p_org and e.deleted_at is null and e.archived_at is null and e.status = 'active'
          and (p_country is null or e.country_id = p_country)),
    'employees_working', (select count(distinct wl.employee_id) from public.work_logs wl
        left join public.projects p on p.id = wl.project_id
        left join public.employees e on e.id = wl.employee_id
        where wl.organization_id = p_org and wl.deleted_at is null and wl.ended_at is null
          and (p_country is null or coalesce(p.country_id, e.country_id) = p_country)),
    'employees_worked_today', (select count(distinct employee_id) from public.work_hours_between(p_org, v_day_start, v_day_end, p_country)),
    'machines_total', (select count(*) from public.machines m
        where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null
          and (p_country is null or m.country_id = p_country)),
    'machines_active', (select count(distinct x.mid) from (
          select wl.machine_id as mid from public.work_logs wl
            join public.machines m on m.id = wl.machine_id
            where wl.organization_id = p_org and wl.deleted_at is null and wl.ended_at is null
              and (p_country is null or m.country_id = p_country)
          union
          select gp.machine_id from public.machine_latest_positions gp
            join public.machines m on m.id = gp.machine_id
            where gp.organization_id = p_org and gp.recorded_at > now() - interval '30 minutes'
              and coalesce(gp.ignition, gp.speed_kmh > 0, false)
              and (p_country is null or m.country_id = p_country)
        ) x),
    'machines_down', (select count(*) from public.machines m
        where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null and m.status in ('broken','maintenance')
          and (p_country is null or m.country_id = p_country)),
    'projects_active', (select count(*) from public.projects p
        where p.organization_id = p_org and p.deleted_at is null and p.archived_at is null and p.status = 'active'
          and (p_country is null or p.country_id = p_country)),
    'hours_today', (select round(coalesce(sum(net_hours), 0), 1) from public.work_hours_between(p_org, v_day_start, v_day_end, p_country)),
    'fuel_litres_today', (select round(sum(f.litres), 1) from public.fuel_logs f
        where f.organization_id = p_org and f.deleted_at is null and f.occurred_at >= v_day_start and f.occurred_at < v_day_end
          and (p_country is null or f.country_id = p_country)),
    'fuel_cost_today', (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb) from (
        select f.currency, round(sum(f.total_amount), 2) as total from public.fuel_logs f
        where f.organization_id = p_org and f.deleted_at is null and f.occurred_at >= v_day_start and f.occurred_at < v_day_end
          and f.total_amount is not null and (p_country is null or f.country_id = p_country)
        group by f.currency) s),
    'expenses_today', (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb) from (
        select x.currency, round(sum(x.amount), 2) as total from public.expenses x
        where x.organization_id = p_org and x.deleted_at is null and x.status not in ('draft','rejected')
          and x.expense_date = (now() at time zone v_tz)::date
          and (p_country is null or x.country_id = p_country)
        group by x.currency) s),
    'expenses_pending', (select count(*) from public.expenses x
        where x.organization_id = p_org and x.deleted_at is null and x.status = 'submitted'
          and (p_country is null or x.country_id = p_country)),
    'repairs_open', (select count(*) from public.repair_requests rr
        join public.machines m on m.id = rr.machine_id
        where rr.organization_id = p_org and rr.deleted_at is null and rr.status not in ('completed','cancelled')
          and (p_country is null or m.country_id = p_country)),
    'repairs_critical', (select count(*) from public.repair_requests rr
        join public.machines m on m.id = rr.machine_id
        where rr.organization_id = p_org and rr.deleted_at is null and rr.status not in ('completed','cancelled') and rr.priority = 'critical'
          and (p_country is null or m.country_id = p_country)),
    'incidents_open', (select count(*) from public.incidents i
        left join public.projects p on p.id = i.project_id
        where i.organization_id = p_org and i.deleted_at is null and i.status not in ('resolved','closed')
          and (p_country is null or p.country_id = p_country)),
    'tasks_open', (select count(*) from public.tasks t
        left join public.projects p on p.id = t.project_id
        where t.organization_id = p_org and t.deleted_at is null and t.status in ('todo','in_progress','waiting')
          and (p_country is null or p.country_id = p_country)),
    'production_today', (select coalesce(jsonb_object_agg(unit, total), '{}'::jsonb) from (
        select pl.unit, round(sum(pl.quantity), 1) as total from public.production_logs pl
        join public.projects p on p.id = pl.project_id
        where pl.organization_id = p_org and pl.deleted_at is null and pl.production_date = (now() at time zone v_tz)::date
          and (p_country is null or p.country_id = p_country)
        group by pl.unit) s),
    'alerts', (select count(*) from public.get_alerts(p_org, p_country))
  ) into r;
  return r;
end $$;

-- Daily series for charts ----------------------------------------------------------------------
create or replace function public.dashboard_series(p_org uuid, p_days integer default 14, p_country uuid default null)
returns table (day date, hours numeric, fuel_litres numeric, fuel_cost_eur numeric, expenses_eur numeric, production_m3 numeric, repairs_opened integer)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) as z),
  days as (
    select d::date as day,
           (d::timestamp at time zone (select z from tz)) as s,
           ((d + interval '1 day')::timestamp at time zone (select z from tz)) as e
    from generate_series(((now() at time zone (select z from tz))::date - (least(greatest(p_days, 1), 366) - 1)),
                         (now() at time zone (select z from tz))::date, interval '1 day') d
  )
  select days.day,
    (select round(coalesce(sum(net_hours), 0), 1) from public.work_hours_between(p_org, days.s, days.e, p_country)),
    (select round(coalesce(sum(f.litres), 0), 1) from public.fuel_logs f where f.organization_id = p_org and f.deleted_at is null
       and f.occurred_at >= days.s and f.occurred_at < days.e and (p_country is null or f.country_id = p_country)),
    (select round(coalesce(sum(f.total_amount), 0), 2) from public.fuel_logs f where f.organization_id = p_org and f.deleted_at is null
       and f.currency = 'EUR' and f.occurred_at >= days.s and f.occurred_at < days.e and (p_country is null or f.country_id = p_country)),
    (select round(coalesce(sum(x.amount), 0), 2) from public.expenses x where x.organization_id = p_org and x.deleted_at is null
       and x.currency = 'EUR' and x.status not in ('draft','rejected') and x.expense_date = days.day and (p_country is null or x.country_id = p_country)),
    (select round(coalesce(sum(pl.quantity), 0), 1) from public.production_logs pl join public.projects p on p.id = pl.project_id
       where pl.organization_id = p_org and pl.deleted_at is null and pl.unit = 'm3' and pl.production_date = days.day
         and (p_country is null or p.country_id = p_country)),
    (select count(*)::int from public.repair_requests rr join public.machines m on m.id = rr.machine_id
       where rr.organization_id = p_org and rr.deleted_at is null and rr.created_at >= days.s and rr.created_at < days.e
         and (p_country is null or m.country_id = p_country))
  from days order by days.day
$$;

-- ALERTS (rule based, configurable, neutral wording) ----------------------------------------------
create or replace function public.get_alerts(p_org uuid, p_country uuid default null)
returns table (alert_key text, severity text, alert_type text, title text, detail text, entity_type text, entity_id uuid, link text, occurred_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
declare
  s record;
  cfg jsonb;
begin
  select * into s from public.organization_settings where organization_id = p_org;
  cfg := coalesce(s.alert_config, '{}'::jsonb);

  -- critical repairs
  if coalesce((cfg ->> 'repair_critical')::boolean, true) then
    return query
    select 'repair:' || rr.id, 'critical', 'repair_critical', 'Kritiska tehniska problēma',
           m.name || ' — ' || rr.title, 'repair', rr.id, '/repairs/' || rr.id, rr.created_at
    from public.repair_requests rr join public.machines m on m.id = rr.machine_id
    where rr.organization_id = p_org and rr.deleted_at is null and rr.priority = 'critical'
      and rr.status not in ('completed','cancelled') and (p_country is null or m.country_id = p_country);
  end if;

  -- open shifts: too long / missing check-out
  if coalesce((cfg ->> 'missing_checkout')::boolean, true) then
    return query
    select 'checkout:' || wl.id,
           case when now() - wl.started_at > make_interval(hours => coalesce(s.missing_checkout_after_hours, 13)::int) then 'warning' else 'info' end,
           case when now() - wl.started_at > make_interval(hours => coalesce(s.missing_checkout_after_hours, 13)::int) then 'missing_checkout' else 'long_shift' end,
           case when now() - wl.started_at > make_interval(hours => coalesce(s.missing_checkout_after_hours, 13)::int)
                then 'Darbinieks nav veicis check-out' else 'Ilga darba maiņa' end,
           e.full_name || ' — sākts ' || to_char(wl.started_at at time zone app.org_timezone(p_org), 'DD.MM HH24:MI'),
           'employee', e.id, '/employees/' || e.id || '?tab=hours', wl.started_at
    from public.work_logs wl join public.employees e on e.id = wl.employee_id
    left join public.projects p on p.id = wl.project_id
    where wl.organization_id = p_org and wl.deleted_at is null and wl.ended_at is null
      and now() - wl.started_at > make_interval(hours => coalesce(s.max_shift_hours, 12)::int)
      and (p_country is null or coalesce(p.country_id, e.country_id) = p_country);
  end if;

  -- service due / overdue (engine hours or date)
  if coalesce((cfg ->> 'service_due')::boolean, true) then
    return query
    select 'service:' || m.id,
           case when (m.next_service_hours is not null and m.engine_hours >= m.next_service_hours)
                  or (m.next_service_at is not null and m.next_service_at < current_date) then 'critical' else 'warning' end,
           'service_due',
           case when (m.next_service_hours is not null and m.engine_hours >= m.next_service_hours)
                  or (m.next_service_at is not null and m.next_service_at < current_date)
                then 'Tehnikai nokavēts serviss' else 'Tehnikai tuvojas serviss' end,
           m.name || coalesce(case when m.next_service_hours - m.engine_hours < 0
                                   then ' — nokavēts par ' || round(m.engine_hours - m.next_service_hours)::text || ' mst'
                                   else ' — atlikušas ' || round(m.next_service_hours - m.engine_hours)::text || ' mst' end, ''),
           'machine', m.id, '/machines/' || m.id, now()
    from public.machines m
    where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null
      and (p_country is null or m.country_id = p_country)
      and (
        (m.next_service_hours is not null and m.engine_hours is not null
          and m.next_service_hours - m.engine_hours <= coalesce(s.service_warning_hours, 50))
        or (m.next_service_at is not null and m.next_service_at <= current_date + 14)
      );
  end if;

  -- insurance / inspection
  if coalesce((cfg ->> 'machine_documents')::boolean, true) then
    return query
    select 'insurance:' || m.id, case when m.insurance_valid_until < current_date then 'critical' else 'warning' end,
           'document_expiring', case when m.insurance_valid_until < current_date then 'Beigusies tehnikas apdrošināšana' else 'Beidzas tehnikas apdrošināšana' end,
           m.name || ' — ' || to_char(m.insurance_valid_until, 'DD.MM.YYYY'), 'machine', m.id, '/machines/' || m.id, now()
    from public.machines m
    where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null
      and m.insurance_valid_until is not null and m.insurance_valid_until <= current_date + 30
      and (p_country is null or m.country_id = p_country)
    union all
    select 'inspection:' || m.id, case when m.inspection_valid_until < current_date then 'critical' else 'warning' end,
           'document_expiring', case when m.inspection_valid_until < current_date then 'Beigusies tehniskā apskate' else 'Beidzas tehniskā apskate' end,
           m.name || ' — ' || to_char(m.inspection_valid_until, 'DD.MM.YYYY'), 'machine', m.id, '/machines/' || m.id, now()
    from public.machines m
    where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null
      and m.inspection_valid_until is not null and m.inspection_valid_until <= current_date + 30
      and (p_country is null or m.country_id = p_country);
  end if;

  -- incidents
  if coalesce((cfg ->> 'incident')::boolean, true) then
    return query
    select 'incident:' || i.id, case when i.severity in ('high','critical') then 'critical' else 'warning' end,
           'incident', 'Drošības incidents', i.title, 'incident', i.id, '/incidents/' || i.id, i.occurred_at
    from public.incidents i left join public.projects p on p.id = i.project_id
    where i.organization_id = p_org and i.deleted_at is null and i.status in ('open','investigating','action_required')
      and (p_country is null or p.country_id = p_country);
  end if;

  -- documents expiring (30 days) / expired
  if coalesce((cfg ->> 'document_expiring')::boolean, true) then
    return query
    select 'doc:' || d.id, case when d.expiry_date < current_date then 'critical' else 'warning' end,
           'document_expiring', case when d.expiry_date < current_date then 'Dokuments beidzies' else 'Beidzas dokuments' end,
           d.name || ' — ' || to_char(d.expiry_date, 'DD.MM.YYYY'), 'document', d.id, '/documents?doc=' || d.id, now()
    from public.documents d
    where d.organization_id = p_org and d.status = 'active' and d.expiry_date is not null
      and d.expiry_date <= current_date + 30;
  end if;

  -- employee training / certificates
  if coalesce((cfg ->> 'training_expiring')::boolean, true) then
    return query
    select 'training:' || t.id, case when t.expires_at < current_date then 'critical' else 'warning' end,
           'training_expiring', case when t.expires_at < current_date then 'Beidzies darbinieka sertifikāts' else 'Beidzas darbinieka sertifikāts' end,
           e.full_name || ' — ' || t.title || ' (' || to_char(t.expires_at, 'DD.MM.YYYY') || ')',
           'employee', e.id, '/employees/' || e.id || '?tab=training', now()
    from public.employee_training t join public.employees e on e.id = t.employee_id
    where t.organization_id = p_org and t.expires_at is not null and t.expires_at <= current_date + 30
      and e.deleted_at is null and e.status <> 'inactive'
      and (p_country is null or e.country_id = p_country);
  end if;

  -- expenses awaiting approval (single aggregated alert)
  if coalesce((cfg ->> 'expense_pending')::boolean, true) then
    return query
    select 'expenses:pending', 'info', 'expense_pending', 'Izdevumi gaida apstiprinājumu',
           count(*)::text || ' ieraksti', 'expense', null::uuid, '/expenses?status=submitted', min(x.submitted_at)
    from public.expenses x
    where x.organization_id = p_org and x.deleted_at is null and x.status = 'submitted'
      and (p_country is null or x.country_id = p_country)
    having count(*) > 0;
  end if;

  -- project deadline approaching
  if coalesce((cfg ->> 'project_deadline')::boolean, true) then
    return query
    select 'deadline:' || p.id, case when p.expected_end_date < current_date then 'warning' else 'info' end,
           'project_deadline', case when p.expected_end_date < current_date then 'Objekta termiņš pārsniegts' else 'Tuvojas objekta termiņš' end,
           p.code || ' ' || p.name || ' — ' || to_char(p.expected_end_date, 'DD.MM.YYYY'), 'project', p.id, '/projects/' || p.id, now()
    from public.projects p
    where p.organization_id = p_org and p.deleted_at is null and p.status = 'active'
      and p.expected_end_date is not null and p.expected_end_date <= current_date + 7
      and (p_country is null or p.country_id = p_country);
  end if;

  -- fuel anomaly: litres/engine-hour far from the machine's own median (needs >= 6 data points)
  if coalesce((cfg ->> 'fuel_anomaly')::boolean, true) then
    return query
    with pts as (
      select f.id, f.machine_id, f.occurred_at, f.litres, f.engine_hours,
             f.engine_hours - lag(f.engine_hours) over (partition by f.machine_id order by f.occurred_at) as dh
      from public.fuel_logs f
      where f.organization_id = p_org and f.deleted_at is null and f.machine_id is not null and f.engine_hours is not null
        and f.occurred_at > now() - interval '120 days'
    ), rates as (
      select *, litres / nullif(dh, 0) as lph from pts where dh > 0.5
    ), med as (
      select machine_id, percentile_cont(0.5) within group (order by lph) as m, count(*) as n from rates group by machine_id
    )
    select 'fuel:' || r.id, 'warning', 'fuel_anomaly', 'Neparasts degvielas patēriņš — nepieciešama pārbaude',
           mc.name || ' — ' || round(r.lph::numeric, 1)::text || ' L/h (parasti ~' || round(med.m::numeric, 1)::text || ' L/h)',
           'machine', r.machine_id, '/machines/' || r.machine_id || '?tab=fuel', r.occurred_at
    from rates r join med on med.machine_id = r.machine_id join public.machines mc on mc.id = r.machine_id
    where med.n >= 6 and r.occurred_at > now() - interval '7 days'
      and (r.lph > med.m * 1.8 or r.lph < med.m * 0.4)
      and (p_country is null or mc.country_id = p_country);
  end if;

  -- telemetry missing for Mapon-linked machines
  if coalesce((cfg ->> 'telemetry_missing')::boolean, true) then
    return query
    select 'telemetry:' || md.id, 'info', 'telemetry_missing', 'Nav telemetrijas datu',
           coalesce(m.name, md.label) || ' — pēdējie dati ' || coalesce(to_char(md.last_update at time zone app.org_timezone(p_org), 'DD.MM HH24:MI'), 'nav'),
           'machine', m.id, '/machines/' || m.id, md.last_update
    from public.mapon_devices md join public.machines m on m.id = md.machine_id
    where md.organization_id = p_org and m.deleted_at is null and m.archived_at is null
      and (md.last_update is null or md.last_update < now() - interval '24 hours')
      and (p_country is null or m.country_id = p_country);
  end if;

  -- machine unexpectedly inactive: worked in last 14 days but not in the last 3, still on an active project
  if coalesce((cfg ->> 'machine_inactive')::boolean, true) then
    return query
    select 'inactive:' || m.id, 'info', 'machine_inactive', 'Tehnika neaktīva',
           m.name || ' — nav darba ierakstu 3 dienas', 'machine', m.id, '/machines/' || m.id, now()
    from public.machines m join public.projects p on p.id = m.current_project_id and p.status = 'active'
    where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null and m.status = 'active'
      and exists (select 1 from public.work_logs wl where wl.machine_id = m.id and wl.started_at > now() - interval '14 days')
      and not exists (select 1 from public.work_logs wl where wl.machine_id = m.id and wl.started_at > now() - interval '3 days')
      and (p_country is null or m.country_id = p_country);
  end if;
end $$;

-- ANALYTICS ---------------------------------------------------------------------------------
create or replace function public.analytics_hours_by_employee(p_org uuid, p_from date, p_to date, p_country uuid default null, p_project uuid default null)
returns table (employee_id uuid, full_name text, country_id uuid, total_hours numeric, overtime_hours numeric, break_hours numeric, days_worked integer, projects integer)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) z, coalesce((select overtime_after_hours from public.organization_settings where organization_id = p_org), 8) ot),
  per_day as (
    select h.employee_id, d::date as day, sum(h.net_hours) as net, sum(h.break_hours) as brk, count(distinct h.project_id) as prj,
           array_agg(distinct h.project_id) filter (where h.project_id is not null) as project_ids
    from generate_series(p_from, p_to, interval '1 day') d
    cross join lateral public.work_hours_between(p_org, (d::timestamp at time zone (select z from tz)),
        ((d + interval '1 day')::timestamp at time zone (select z from tz)), p_country) h
    where (p_project is null or h.project_id = p_project)
    group by h.employee_id, d::date
  )
  select e.id, e.full_name, e.country_id,
         round(sum(pd.net), 2), round(sum(greatest(pd.net - (select ot from tz), 0)), 2), round(sum(pd.brk), 2),
         count(*) filter (where pd.net > 0)::int,
         (select count(distinct x) from per_day p2, unnest(p2.project_ids) x where p2.employee_id = e.id)::int
  from per_day pd join public.employees e on e.id = pd.employee_id
  group by e.id, e.full_name, e.country_id
  order by 4 desc
$$;

create or replace function public.analytics_machine_costs(p_org uuid, p_from date, p_to date, p_country uuid default null)
returns table (machine_id uuid, name text, category text, country_id uuid, fuel_litres numeric, fuel_cost numeric,
               maintenance_cost numeric, repair_cost numeric, total_cost numeric, work_hours numeric, engine_hours_used numeric,
               cost_per_hour numeric, repairs_count integer, downtime_hours numeric, currency text)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) z),
  rng as (select (p_from::timestamp at time zone (select z from tz)) s, ((p_to + 1)::timestamp at time zone (select z from tz)) e)
  select m.id, m.name, m.category, m.country_id,
    f.litres, f.cost, mr.cost, rp.cost,
    case when coalesce(f.cost,0) + coalesce(mr.cost,0) + coalesce(rp.cost,0) > 0 then coalesce(f.cost,0) + coalesce(mr.cost,0) + coalesce(rp.cost,0) end,
    wh.hours,
    eh.used,
    case when coalesce(eh.used, wh.hours) > 0 and (coalesce(f.cost,0) + coalesce(mr.cost,0) + coalesce(rp.cost,0)) > 0
         then round((coalesce(f.cost,0) + coalesce(mr.cost,0) + coalesce(rp.cost,0)) / coalesce(eh.used, wh.hours), 2) end,
    coalesce(rp.n, 0)::int, rp.downtime, 'EUR'
  from public.machines m
  left join lateral (select round(sum(x.litres),1) litres, round(sum(x.total_amount) filter (where x.currency = 'EUR'),2) cost
                     from public.fuel_logs x, rng where x.machine_id = m.id and x.deleted_at is null and x.occurred_at >= rng.s and x.occurred_at < rng.e) f on true
  left join lateral (select round(sum(x.cost) filter (where x.currency = 'EUR'),2) cost
                     from public.maintenance_records x where x.machine_id = m.id and x.deleted_at is null and x.performed_at between p_from and p_to) mr on true
  left join lateral (select count(*) n,
                       round(sum(coalesce(r.labour_cost,0) + coalesce(r.external_cost,0)
                         + coalesce((select sum(pp.quantity * coalesce(pp.unit_cost,0)) from public.repair_parts pp where pp.repair_id = r.id and pp.currency = 'EUR'),0))
                         filter (where r.currency = 'EUR'), 2) cost,
                       round(sum(r.downtime_hours), 1) downtime
                     from public.repair_requests r, rng where r.machine_id = m.id and r.deleted_at is null and r.created_at >= rng.s and r.created_at < rng.e) rp on true
  left join lateral (select round(sum(h.net_hours), 1) hours from rng, public.work_hours_between(p_org, rng.s, rng.e, null) h where h.machine_id = m.id) wh on true
  left join lateral (select case when count(x.engine_hours) >= 2 then max(x.engine_hours) - min(x.engine_hours) end used
                     from public.fuel_logs x, rng where x.machine_id = m.id and x.deleted_at is null and x.engine_hours is not null
                       and x.occurred_at >= rng.s and x.occurred_at < rng.e) eh on true
  where m.organization_id = p_org and m.deleted_at is null and (p_country is null or m.country_id = p_country)
  order by 9 desc nulls last
$$;

create or replace function public.analytics_project_summary(p_org uuid, p_from date, p_to date, p_country uuid default null)
returns table (project_id uuid, code text, name text, country_id uuid, status text, hours numeric, workers integer, machines integer,
               fuel_litres numeric, fuel_cost numeric, expenses numeric, production jsonb, repairs integer, downtime_hours numeric)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) z),
  rng as (select (p_from::timestamp at time zone (select z from tz)) s, ((p_to + 1)::timestamp at time zone (select z from tz)) e)
  select p.id, p.code, p.name, p.country_id, p.status,
    wh.hours, wh.workers, wh.machines,
    f.litres, f.cost, ex.total,
    pr.prod, coalesce(rp.n, 0)::int, rp.downtime
  from public.projects p
  left join lateral (select round(sum(h.net_hours),1) hours, count(distinct h.employee_id)::int workers, count(distinct h.machine_id)::int machines
                     from rng, public.work_hours_between(p_org, rng.s, rng.e, null) h where h.project_id = p.id) wh on true
  left join lateral (select round(sum(x.litres),1) litres, round(sum(x.total_amount) filter (where x.currency='EUR'),2) cost
                     from public.fuel_logs x, rng where x.project_id = p.id and x.deleted_at is null and x.occurred_at >= rng.s and x.occurred_at < rng.e) f on true
  left join lateral (select round(sum(x.amount) filter (where x.currency='EUR'),2) total
                     from public.expenses x where x.project_id = p.id and x.deleted_at is null and x.status not in ('draft','rejected')
                       and x.expense_date between p_from and p_to) ex on true
  left join lateral (select jsonb_object_agg(unit, q) prod from (select pl.unit, round(sum(pl.quantity),1) q from public.production_logs pl
                     where pl.project_id = p.id and pl.deleted_at is null and pl.production_date between p_from and p_to group by pl.unit) z) pr on true
  left join lateral (select count(*) n, round(sum(r.downtime_hours),1) downtime from public.repair_requests r, rng
                     where r.project_id = p.id and r.deleted_at is null and r.created_at >= rng.s and r.created_at < rng.e) rp on true
  where p.organization_id = p_org and p.deleted_at is null and (p_country is null or p.country_id = p_country)
  order by p.status = 'active' desc, wh.hours desc nulls last
$$;

create or replace function public.analytics_country_comparison(p_org uuid, p_from date, p_to date)
returns table (country_id uuid, code text, name text, hours numeric, fuel_litres numeric, fuel_cost_eur numeric, expenses_eur numeric,
               repairs integer, production_m3 numeric, employees integer, machines integer)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) z),
  rng as (select (p_from::timestamp at time zone (select z from tz)) s, ((p_to + 1)::timestamp at time zone (select z from tz)) e)
  select c.id, c.code, c.name,
    (select round(coalesce(sum(h.net_hours),0),1) from rng, public.work_hours_between(p_org, rng.s, rng.e, c.id) h),
    (select round(coalesce(sum(f.litres),0),1) from public.fuel_logs f, rng where f.organization_id = p_org and f.deleted_at is null and f.country_id = c.id and f.occurred_at >= rng.s and f.occurred_at < rng.e),
    (select round(coalesce(sum(f.total_amount),0),2) from public.fuel_logs f, rng where f.organization_id = p_org and f.deleted_at is null and f.currency='EUR' and f.country_id = c.id and f.occurred_at >= rng.s and f.occurred_at < rng.e),
    (select round(coalesce(sum(x.amount),0),2) from public.expenses x where x.organization_id = p_org and x.deleted_at is null and x.currency='EUR' and x.status not in ('draft','rejected') and x.country_id = c.id and x.expense_date between p_from and p_to),
    (select count(*)::int from public.repair_requests r join public.machines m on m.id = r.machine_id, rng where r.organization_id = p_org and r.deleted_at is null and m.country_id = c.id and r.created_at >= rng.s and r.created_at < rng.e),
    (select round(coalesce(sum(pl.quantity),0),1) from public.production_logs pl join public.projects p on p.id = pl.project_id where pl.organization_id = p_org and pl.deleted_at is null and pl.unit='m3' and p.country_id = c.id and pl.production_date between p_from and p_to),
    (select count(*)::int from public.employees e where e.organization_id = p_org and e.deleted_at is null and e.status = 'active' and e.country_id = c.id),
    (select count(*)::int from public.machines m where m.organization_id = p_org and m.deleted_at is null and m.archived_at is null and m.country_id = c.id)
  from public.countries c where c.organization_id = p_org and c.is_active order by c.sort_order
$$;

create or replace function public.analytics_expenses_by_category(p_org uuid, p_from date, p_to date, p_country uuid default null, p_project uuid default null)
returns table (category text, currency text, total numeric, count integer)
language sql stable security invoker set search_path = '' as $$
  select x.category, x.currency, round(sum(x.amount),2), count(*)::int
  from public.expenses x
  where x.organization_id = p_org and x.deleted_at is null and x.status not in ('draft','rejected')
    and x.expense_date between p_from and p_to
    and (p_country is null or x.country_id = p_country) and (p_project is null or x.project_id = p_project)
  group by x.category, x.currency order by 3 desc
$$;

create or replace function public.analytics_fuel_summary(p_org uuid, p_from date, p_to date, p_country uuid default null)
returns table (litres numeric, cost_eur numeric, avg_price_eur numeric, entries integer, litres_per_hour numeric, cost_per_hour_eur numeric)
language sql stable security invoker set search_path = '' as $$
  with tz as (select app.org_timezone(p_org) z),
  rng as (select (p_from::timestamp at time zone (select z from tz)) s, ((p_to + 1)::timestamp at time zone (select z from tz)) e),
  f as (select x.* from public.fuel_logs x, rng where x.organization_id = p_org and x.deleted_at is null
        and x.occurred_at >= rng.s and x.occurred_at < rng.e and (p_country is null or x.country_id = p_country)),
  h as (select sum(net_hours) hrs from rng, public.work_hours_between(p_org, rng.s, rng.e, p_country) where machine_id is not null)
  select round(sum(f.litres),1), round(sum(f.total_amount) filter (where f.currency='EUR'),2),
         round(sum(f.total_amount) filter (where f.currency='EUR') / nullif(sum(f.litres) filter (where f.currency='EUR' and f.total_amount is not null),0), 3),
         count(*)::int,
         case when (select hrs from h) > 0 then round(sum(f.litres) / (select hrs from h), 2) end,
         case when (select hrs from h) > 0 and sum(f.total_amount) filter (where f.currency='EUR') is not null
              then round(sum(f.total_amount) filter (where f.currency='EUR') / (select hrs from h), 2) end
  from f
$$;

-- GLOBAL SEARCH (permission aware via RLS) ------------------------------------------------------------
create or replace function public.global_search(p_org uuid, p_query text)
returns table (entity_type text, entity_id uuid, title text, subtitle text, link text)
language sql stable security invoker set search_path = '' as $$
  with q as (select '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%' as pat)
  (select 'employee', e.id, e.full_name, coalesce(e.job_title, ''), '/employees/' || e.id
   from public.employees e, q where e.organization_id = p_org and e.deleted_at is null
     and (e.full_name ilike q.pat or e.email ilike q.pat or e.phone ilike q.pat) limit 6)
  union all
  (select 'machine', m.id, m.name, concat_ws(' · ', m.manufacturer, m.model, m.registration_number), '/machines/' || m.id
   from public.machines m, q where m.organization_id = p_org and m.deleted_at is null
     and (m.name ilike q.pat or m.registration_number ilike q.pat or m.vin ilike q.pat or m.model ilike q.pat or m.internal_code ilike q.pat) limit 6)
  union all
  (select 'project', p.id, p.code || ' · ' || p.name, coalesce(p.client_name, ''), '/projects/' || p.id
   from public.projects p, q where p.organization_id = p_org and p.deleted_at is null
     and (p.code ilike q.pat or p.name ilike q.pat or p.client_name ilike q.pat or p.site_identifiers::text ilike q.pat) limit 6)
  union all
  (select 'repair', r.id, r.title, r.status, '/repairs/' || r.id
   from public.repair_requests r, q where r.organization_id = p_org and r.deleted_at is null and (r.title ilike q.pat or r.description ilike q.pat) limit 5)
  union all
  (select 'expense', x.id, x.amount::text || ' ' || x.currency, coalesce(x.description, x.category), '/expenses/' || x.id
   from public.expenses x, q where x.organization_id = p_org and x.deleted_at is null and (x.description ilike q.pat or x.category ilike q.pat) limit 5)
  union all
  (select 'task', t.id, t.title, t.status, '/tasks?task=' || t.id
   from public.tasks t, q where t.organization_id = p_org and t.deleted_at is null and (t.title ilike q.pat or t.description ilike q.pat) limit 5)
  union all
  (select 'document', d.id, d.name, d.document_type, '/documents?doc=' || d.id
   from public.documents d, q where d.organization_id = p_org and d.name ilike q.pat limit 5)
  union all
  (select 'receipt', rc.id, coalesce(rc.merchant, 'Čeks'), coalesce(rc.amount::text || ' ' || rc.currency, ''), '/receipts?receipt=' || rc.id
   from public.receipts rc, q where rc.organization_id = p_org and rc.deleted_at is null and rc.merchant ilike q.pat limit 5)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'work_hours_between(uuid,timestamptz,timestamptz,uuid)', 'dashboard_stats(uuid,uuid)', 'dashboard_series(uuid,integer,uuid)',
    'get_alerts(uuid,uuid)', 'analytics_hours_by_employee(uuid,date,date,uuid,uuid)', 'analytics_machine_costs(uuid,date,date,uuid)',
    'analytics_project_summary(uuid,date,date,uuid)', 'analytics_country_comparison(uuid,date,date)',
    'analytics_expenses_by_category(uuid,date,date,uuid,uuid)', 'analytics_fuel_summary(uuid,date,date,uuid)', 'global_search(uuid,text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
