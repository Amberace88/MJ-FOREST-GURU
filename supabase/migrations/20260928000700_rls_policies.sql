-- ============================================================================
-- MJ FOREST GURU — 0700 Row Level Security
-- Every table in `public` has RLS enabled. Anonymous role has NO policies.
-- Rules of thumb:
--   * membership (app.is_member) is always required
--   * org-wide visibility comes from a permission (view_all_*, view_finance ...)
--   * otherwise users see their own records and records in their managerial scope
--   * no DELETE policies on business records (soft delete / archive instead)
-- ============================================================================

-- Visibility of a referenced entity, evaluated WITH the caller's RLS (invoker).
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
    when 'organization' then return app.is_member(p_id);
    else return false;
  end case;
end $$;
grant execute on function app.entity_visible(text, uuid) to authenticated;

create or replace function app.shares_org(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members a
    join public.organization_members b on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = p_user
  )
$$;
grant execute on function app.shares_org(uuid) to authenticated;

-- Enable RLS everywhere ------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- Secrets / system tables: nothing for API roles
revoke all on public.integration_secrets from anon, authenticated;
revoke all on public.system_settings from anon, authenticated;
-- Views
revoke all on public.task_comments, public.project_comments, public.employee_documents,
              public.machine_documents, public.machine_latest_positions from anon;
-- Audit log: read-only via policy
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke update, delete, truncate on public.safety_acknowledgements, public.safety_rule_versions, public.repair_status_history from authenticated;

-- ORGANIZATION --------------------------------------------------------------------------
create policy org_select on public.organizations for select to authenticated
  using (app.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (app.has_perm(id, 'manage_settings')) with check (app.has_perm(id, 'manage_settings'));

create policy org_settings_select on public.organization_settings for select to authenticated
  using (app.is_member(organization_id));
create policy org_settings_update on public.organization_settings for update to authenticated
  using (app.has_perm(organization_id, 'manage_settings')) with check (app.has_perm(organization_id, 'manage_settings'));

create policy countries_select on public.countries for select to authenticated
  using (app.is_member(organization_id));
create policy countries_insert on public.countries for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_settings'));
create policy countries_update on public.countries for update to authenticated
  using (app.has_perm(organization_id, 'manage_settings')) with check (app.has_perm(organization_id, 'manage_settings'));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_org(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or app.has_perm(organization_id, 'manage_users'));
create policy members_update on public.organization_members for update to authenticated
  using (app.has_perm(organization_id, 'manage_users') and user_id <> (select auth.uid()))
  with check (app.has_perm(organization_id, 'manage_users'));

create policy permissions_select on public.permissions for select to authenticated using (true);

create policy roles_select on public.roles for select to authenticated
  using (app.is_member(organization_id));
create policy roles_insert on public.roles for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_permissions') and not is_system);
create policy roles_update on public.roles for update to authenticated
  using (app.has_perm(organization_id, 'manage_permissions')) with check (app.has_perm(organization_id, 'manage_permissions'));
create policy roles_delete on public.roles for delete to authenticated
  using (app.has_perm(organization_id, 'manage_permissions') and not is_system);

create policy role_perms_select on public.role_permissions for select to authenticated
  using (app.is_member(organization_id));
create policy role_perms_insert on public.role_permissions for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_permissions'));
create policy role_perms_delete on public.role_permissions for delete to authenticated
  using (app.has_perm(organization_id, 'manage_permissions'));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or app.has_perm(organization_id, 'manage_users'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_users'));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (app.has_perm(organization_id, 'manage_users'));

-- Guard rails on privilege changes
create or replace function app.guard_role_grants() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role record; v_row record; v_owner_count integer;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  if (select auth.uid()) is null then return v_row; end if;
  select key, organization_id into v_role from public.roles where id = v_row.role_id;
  -- granting/revoking owner or admin requires manage_permissions (owner-level)
  if v_role.key in ('owner','admin') and not app.has_perm(v_role.organization_id, 'manage_permissions') then
    raise exception 'PERMISSION_DENIED:privileged_role' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and v_role.key = 'owner' then
    select count(*) into v_owner_count from public.user_roles ur where ur.role_id = old.role_id and ur.id <> old.id;
    if v_owner_count = 0 then raise exception 'LAST_OWNER' using errcode = '23514'; end if;
  end if;
  return v_row;
end $$;
create trigger trg_user_roles_guard before insert or delete on public.user_roles
  for each row execute function app.guard_role_grants();

create or replace function app.guard_owner_permissions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return old; end if;
  if exists (select 1 from public.roles r where r.id = old.role_id and r.key = 'owner')
     and old.permission_key in ('manage_permissions','manage_users','view_audit_log') then
    raise exception 'PERMISSION_DENIED:owner_core_permission' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger trg_role_permissions_guard before delete on public.role_permissions
  for each row execute function app.guard_owner_permissions();

create policy lookups_select on public.lookup_values for select to authenticated
  using (app.is_member(organization_id));
create policy lookups_write on public.lookup_values for all to authenticated
  using (app.has_perm(organization_id, 'manage_settings')) with check (app.has_perm(organization_id, 'manage_settings'));

-- PEOPLE ---------------------------------------------------------------------------------
create policy employees_select on public.employees for select to authenticated
  using (
    app.is_member(organization_id)
    and (deleted_at is null or app.has_perm(organization_id, 'edit_employees'))
    and (
      user_id = (select auth.uid())
      or app.has_perm(organization_id, 'view_all_employees')
      or app.in_my_scope_employee(id)
    )
  );
create policy employees_insert on public.employees for insert to authenticated
  with check (app.has_perm(organization_id, 'edit_employees'));
create policy employees_update on public.employees for update to authenticated
  using (app.has_perm(organization_id, 'edit_employees')) with check (app.has_perm(organization_id, 'edit_employees'));

create policy compensation_all on public.employee_compensation for all to authenticated
  using (app.has_perm(organization_id, 'view_salaries'))
  with check (app.has_perm(organization_id, 'view_salaries') and app.has_perm(organization_id, 'edit_employees'));

create policy teams_select on public.teams for select to authenticated
  using (app.is_member(organization_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_teams'));
create policy teams_update on public.teams for update to authenticated
  using (app.has_perm(organization_id, 'manage_teams')) with check (app.has_perm(organization_id, 'manage_teams'));

-- PROJECTS ---------------------------------------------------------------------------------
create policy projects_select on public.projects for select to authenticated
  using (
    app.is_member(organization_id)
    and (deleted_at is null or app.has_perm(organization_id, 'manage_projects'))
    and (app.has_perm(organization_id, 'view_all_projects') or id in (select app.my_project_ids(organization_id)))
  );
create policy projects_insert on public.projects for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects') and app.has_perm(organization_id, 'view_all_projects'));
create policy projects_update on public.projects for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects') and app.leads_project(id))
  with check (app.has_perm(organization_id, 'manage_projects'));

create policy work_sites_select on public.work_sites for select to authenticated
  using (app.can_access_project(project_id));
create policy work_sites_write on public.work_sites for all to authenticated
  using (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id))
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));

create policy project_workers_select on public.project_workers for select to authenticated
  using (app.can_access_project(project_id));
create policy project_workers_insert on public.project_workers for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));
create policy project_workers_update on public.project_workers for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id))
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));

create policy project_teams_select on public.project_teams for select to authenticated
  using (app.can_access_project(project_id));
create policy project_teams_write on public.project_teams for all to authenticated
  using (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id))
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));

create policy project_machines_select on public.project_machines for select to authenticated
  using (app.can_access_project(project_id));
create policy project_machines_insert on public.project_machines for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));
create policy project_machines_update on public.project_machines for update to authenticated
  using (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id))
  with check (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id));

-- MACHINES ---------------------------------------------------------------------------------
create policy machine_types_select on public.machine_types for select to authenticated
  using (app.is_member(organization_id));
create policy machine_types_write on public.machine_types for all to authenticated
  using (app.has_perm(organization_id, 'manage_machines')) with check (app.has_perm(organization_id, 'manage_machines'));

create policy machines_select on public.machines for select to authenticated
  using (
    (deleted_at is null or app.has_perm(organization_id, 'manage_machines'))
    and app.can_access_machine(id)
  );
create policy machines_insert on public.machines for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_machines'));
create policy machines_update on public.machines for update to authenticated
  using ((app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs')) and app.can_access_machine(id))
  with check (app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs'));

create policy machine_assign_select on public.machine_assignments for select to authenticated
  using (
    app.is_member(organization_id) and (
      employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'view_all_machines')
      or (app.has_perm(organization_id, 'view_team') and app.can_access_machine(machine_id))
    )
  );
create policy machine_assign_insert on public.machine_assignments for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_machines'));
create policy machine_assign_update on public.machine_assignments for update to authenticated
  using (app.has_perm(organization_id, 'manage_machines')) with check (app.has_perm(organization_id, 'manage_machines'));

-- WORK LOGS -----------------------------------------------------------------------------------
create policy work_logs_select on public.work_logs for select to authenticated
  using (
    app.is_member(organization_id)
    and (deleted_at is null or app.has_perm(organization_id, 'edit_employee_hours'))
    and (
      employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'view_employee_hours')
      or app.in_my_scope_employee(employee_id)
    )
  );
create policy work_logs_insert on public.work_logs for insert to authenticated
  with check (
    app.is_member(organization_id) and (
      (employee_id = app.my_employee_id(organization_id) and created_by = (select auth.uid()))
      or app.has_perm(organization_id, 'edit_employee_hours')
    )
  );
create policy work_logs_update on public.work_logs for update to authenticated
  using (
    app.is_member(organization_id) and (
      employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'edit_employee_hours')
      or (app.has_perm(organization_id, 'approve_hours') and app.in_my_scope_employee(employee_id))
    )
  )
  with check (app.is_member(organization_id));

create policy work_breaks_select on public.work_breaks for select to authenticated
  using (exists (select 1 from public.work_logs wl where wl.id = work_log_id));
create policy work_breaks_insert on public.work_breaks for insert to authenticated
  with check (exists (select 1 from public.work_logs wl where wl.id = work_log_id and wl.organization_id = work_breaks.organization_id
                      and (wl.employee_id = app.my_employee_id(wl.organization_id) or app.has_perm(wl.organization_id, 'edit_employee_hours'))));
create policy work_breaks_update on public.work_breaks for update to authenticated
  using (exists (select 1 from public.work_logs wl where wl.id = work_log_id
                 and (wl.employee_id = app.my_employee_id(wl.organization_id) or app.has_perm(wl.organization_id, 'edit_employee_hours'))));

-- PRODUCTION ------------------------------------------------------------------------------------
create policy production_select on public.production_logs for select to authenticated
  using (deleted_at is null and app.can_access_project(project_id));
create policy production_insert on public.production_logs for insert to authenticated
  with check (app.can_access_project(project_id) and created_by = (select auth.uid()));
create policy production_update on public.production_logs for update to authenticated
  using (created_by = (select auth.uid()) or (app.has_perm(organization_id, 'manage_projects') and app.leads_project(project_id)))
  with check (app.can_access_project(project_id));

-- TASKS ---------------------------------------------------------------------------------------------
create policy tasks_select on public.tasks for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      assignee_employee_id = app.my_employee_id(organization_id)
      or created_by = (select auth.uid())
      or (app.has_perm(organization_id, 'manage_tasks')
          and (app.has_perm(organization_id, 'view_all_projects') or project_id is null or app.leads_project(project_id)))
      or (team_id is not null and exists (select 1 from public.teams t where t.id = team_id
            and (t.manager_employee_id = app.my_employee_id(organization_id) or t.foreman_employee_id = app.my_employee_id(organization_id))))
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    app.is_member(organization_id) and created_by = (select auth.uid()) and (
      (app.has_perm(organization_id, 'manage_tasks')
        and (app.has_perm(organization_id, 'view_all_projects') or project_id is null or app.leads_project(project_id)))
      or assignee_employee_id = app.my_employee_id(organization_id)
    )
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    app.is_member(organization_id) and (
      assignee_employee_id = app.my_employee_id(organization_id)
      or (app.has_perm(organization_id, 'manage_tasks')
          and (app.has_perm(organization_id, 'view_all_projects') or project_id is null or app.leads_project(project_id)))
    )
  )
  with check (app.is_member(organization_id));

-- COMMENTS / NOTIFICATIONS / FILES --------------------------------------------------------------
create policy comments_select on public.comments for select to authenticated
  using (app.is_member(organization_id) and deleted_at is null and app.entity_visible(entity_type, entity_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (app.is_member(organization_id) and author_id = (select auth.uid()) and app.entity_visible(entity_type, entity_id));
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy files_select on public.files for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      uploaded_by = (select auth.uid())
      or app.has_perm(organization_id, 'manage_documents')
      or (entity_type <> 'employee' and app.entity_visible(entity_type, entity_id))
      or (entity_type = 'employee' and entity_id = app.my_employee_id(organization_id))
      or (entity_type = 'employee' and app.has_perm(organization_id, 'edit_employees'))
    )
  );
create policy files_insert on public.files for insert to authenticated
  with check (app.is_member(organization_id) and uploaded_by = (select auth.uid()));
create policy files_update on public.files for update to authenticated
  using (uploaded_by = (select auth.uid()) or app.has_perm(organization_id, 'manage_documents'))
  with check (app.is_member(organization_id));

-- RECEIPTS / FUEL / EXPENSES -----------------------------------------------------------------------
create policy receipts_select on public.receipts for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      uploaded_by = (select auth.uid())
      or employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'view_finance')
      or app.has_perm(organization_id, 'approve_expense')
      or app.has_perm(organization_id, 'view_fuel')
    )
  );
create policy receipts_insert on public.receipts for insert to authenticated
  with check (app.is_member(organization_id) and uploaded_by = (select auth.uid()));
create policy receipts_update on public.receipts for update to authenticated
  using (uploaded_by = (select auth.uid()) or app.has_perm(organization_id, 'view_finance'))
  with check (app.is_member(organization_id));

create policy fuel_select on public.fuel_logs for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      employee_id = app.my_employee_id(organization_id)
      or created_by = (select auth.uid())
      or app.has_perm(organization_id, 'view_fuel')
      or (app.has_perm(organization_id, 'view_team') and project_id is not null and app.leads_project(project_id))
    )
  );
create policy fuel_insert on public.fuel_logs for insert to authenticated
  with check (
    app.is_member(organization_id) and created_by = (select auth.uid()) and (
      employee_id = app.my_employee_id(organization_id) or app.has_perm(organization_id, 'edit_fuel')
    )
  );
create policy fuel_update on public.fuel_logs for update to authenticated
  using (
    app.has_perm(organization_id, 'edit_fuel')
    or (created_by = (select auth.uid()) and created_at > now() - interval '24 hours' and deleted_at is null)
  )
  with check (app.is_member(organization_id));

create policy expenses_select on public.expenses for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      employee_id = app.my_employee_id(organization_id)
      or created_by = (select auth.uid())
      or app.has_perm(organization_id, 'view_finance')
      or (app.has_perm(organization_id, 'approve_expense') and project_id is not null and app.leads_project(project_id))
    )
  );
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    app.has_perm(organization_id, 'create_expense') and created_by = (select auth.uid()) and (
      employee_id = app.my_employee_id(organization_id) or app.has_perm(organization_id, 'view_finance')
    )
  );
create policy expenses_update on public.expenses for update to authenticated
  using (
    app.is_member(organization_id) and (
      created_by = (select auth.uid())
      or employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'view_finance')
      or (app.has_perm(organization_id, 'approve_expense') and project_id is not null and app.leads_project(project_id))
    )
  )
  with check (app.is_member(organization_id));

-- MAINTENANCE / REPAIRS ---------------------------------------------------------------------------------
create policy maintenance_select on public.maintenance_records for select to authenticated
  using (deleted_at is null and app.can_access_machine(machine_id));
create policy maintenance_write on public.maintenance_records for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs'));
create policy maintenance_update on public.maintenance_records for update to authenticated
  using (app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs'))
  with check (app.is_member(organization_id));

create policy maintenance_tasks_select on public.maintenance_tasks for select to authenticated
  using (app.can_access_machine(machine_id));
create policy maintenance_tasks_write on public.maintenance_tasks for all to authenticated
  using (app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs'))
  with check (app.has_perm(organization_id, 'manage_machines') or app.has_perm(organization_id, 'manage_repairs'));

create policy repairs_select on public.repair_requests for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      created_by = (select auth.uid())
      or reported_by_employee_id = app.my_employee_id(organization_id)
      or assigned_mechanic_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'manage_repairs')
      or app.has_perm(organization_id, 'approve_repairs')
      or (app.has_perm(organization_id, 'view_team') and project_id is not null and app.leads_project(project_id))
    )
  );
create policy repairs_insert on public.repair_requests for insert to authenticated
  with check (app.is_member(organization_id) and created_by = (select auth.uid()) and app.can_access_machine(machine_id));
create policy repairs_update on public.repair_requests for update to authenticated
  using (
    app.is_member(organization_id) and (
      created_by = (select auth.uid())
      or assigned_mechanic_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'manage_repairs')
      or app.has_perm(organization_id, 'approve_repairs')
    )
  )
  with check (app.is_member(organization_id));

create policy repair_parts_select on public.repair_parts for select to authenticated
  using (exists (select 1 from public.repair_requests r where r.id = repair_id));
create policy repair_parts_insert on public.repair_parts for insert to authenticated
  with check (exists (select 1 from public.repair_requests r where r.id = repair_id and r.organization_id = repair_parts.organization_id
                      and (app.has_perm(r.organization_id, 'manage_repairs') or r.assigned_mechanic_id = app.my_employee_id(r.organization_id))));
create policy repair_parts_delete on public.repair_parts for delete to authenticated
  using (app.has_perm(organization_id, 'manage_repairs'));

create policy repair_history_select on public.repair_status_history for select to authenticated
  using (exists (select 1 from public.repair_requests r where r.id = repair_id));

-- SAFETY / TRAINING / INCIDENTS / DOCUMENTS ---------------------------------------------------------
create policy safety_rules_select on public.safety_rules for select to authenticated
  using (app.is_member(organization_id) and (is_active or app.has_perm(organization_id, 'manage_safety')));
create policy safety_rules_insert on public.safety_rules for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_safety'));
create policy safety_rules_update on public.safety_rules for update to authenticated
  using (app.has_perm(organization_id, 'manage_safety')) with check (app.has_perm(organization_id, 'manage_safety'));

create policy safety_versions_select on public.safety_rule_versions for select to authenticated
  using (app.is_member(organization_id));
create policy safety_versions_insert on public.safety_rule_versions for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_safety'));

create policy safety_ack_select on public.safety_acknowledgements for select to authenticated
  using (
    app.is_member(organization_id) and (
      user_id = (select auth.uid())
      or app.has_perm(organization_id, 'manage_safety')
      or app.in_my_scope_employee(employee_id)
    )
  );
create policy safety_ack_insert on public.safety_acknowledgements for insert to authenticated
  with check (user_id = (select auth.uid()) and employee_id = app.my_employee_id(organization_id));

create policy safety_training_select on public.safety_training for select to authenticated
  using (app.is_member(organization_id));
create policy safety_training_write on public.safety_training for all to authenticated
  using (app.has_perm(organization_id, 'manage_safety')) with check (app.has_perm(organization_id, 'manage_safety'));

create policy employee_training_select on public.employee_training for select to authenticated
  using (
    app.is_member(organization_id) and (
      employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'manage_safety')
      or app.has_perm(organization_id, 'view_all_employees')
      or app.in_my_scope_employee(employee_id)
    )
  );
create policy employee_training_write on public.employee_training for all to authenticated
  using (app.has_perm(organization_id, 'manage_safety') or app.has_perm(organization_id, 'edit_employees'))
  with check (app.has_perm(organization_id, 'manage_safety') or app.has_perm(organization_id, 'edit_employees'));

create policy incidents_select on public.incidents for select to authenticated
  using (
    app.is_member(organization_id) and deleted_at is null and (
      reported_by = (select auth.uid())
      or employee_id = app.my_employee_id(organization_id)
      or app.has_perm(organization_id, 'manage_incidents')
      or app.has_perm(organization_id, 'manage_safety')
      or (app.has_perm(organization_id, 'view_team') and project_id is not null and app.leads_project(project_id))
    )
  );
create policy incidents_insert on public.incidents for insert to authenticated
  with check (app.is_member(organization_id) and reported_by = (select auth.uid()));
create policy incidents_update on public.incidents for update to authenticated
  using (app.has_perm(organization_id, 'manage_incidents') or app.has_perm(organization_id, 'manage_safety'))
  with check (app.is_member(organization_id));

create policy documents_select on public.documents for select to authenticated
  using (
    app.is_member(organization_id) and (
      app.has_perm(organization_id, 'manage_documents')
      or (status = 'active' and visibility = 'organization')
      or (status = 'active' and visibility = 'entity' and app.entity_visible(entity_type, entity_id))
    )
  );
create policy documents_insert on public.documents for insert to authenticated
  with check (app.has_perm(organization_id, 'manage_documents'));
create policy documents_update on public.documents for update to authenticated
  using (app.has_perm(organization_id, 'manage_documents')) with check (app.has_perm(organization_id, 'manage_documents'));

-- GPS / INTEGRATIONS / AUDIT ---------------------------------------------------------------------------
create policy gps_devices_select on public.gps_devices for select to authenticated
  using (app.has_perm(organization_id, 'view_gps'));
create policy gps_devices_write on public.gps_devices for all to authenticated
  using (app.has_perm(organization_id, 'manage_integrations') or app.has_perm(organization_id, 'manage_machines'))
  with check (app.has_perm(organization_id, 'manage_integrations') or app.has_perm(organization_id, 'manage_machines'));

create policy gps_positions_select on public.gps_positions for select to authenticated
  using (
    app.is_member(organization_id) and (
      app.has_perm(organization_id, 'view_gps_history')
      or (app.has_perm(organization_id, 'view_live_gps') and recorded_at > now() - interval '24 hours')
      or (employee_id is not null and employee_id = app.my_employee_id(organization_id))
    )
  );
create policy gps_positions_insert on public.gps_positions for insert to authenticated
  with check (
    source = 'employee' and employee_id = app.my_employee_id(organization_id)
    or (source = 'manual' and app.has_perm(organization_id, 'manage_machines'))
  );

create policy mapon_devices_select on public.mapon_devices for select to authenticated
  using (app.has_perm(organization_id, 'view_gps'));
create policy mapon_devices_update on public.mapon_devices for update to authenticated
  using (app.has_perm(organization_id, 'manage_integrations')) with check (app.has_perm(organization_id, 'manage_integrations'));

create policy mapon_events_select on public.mapon_events for select to authenticated
  using (app.has_perm(organization_id, 'view_gps_history'));

create policy integration_settings_select on public.integration_settings for select to authenticated
  using (app.has_perm(organization_id, 'manage_integrations') or app.has_perm(organization_id, 'view_gps'));
create policy integration_settings_write on public.integration_settings for all to authenticated
  using (app.has_perm(organization_id, 'manage_integrations')) with check (app.has_perm(organization_id, 'manage_integrations'));

create policy invitations_all on public.invitations for all to authenticated
  using (app.has_perm(organization_id, 'manage_users')) with check (app.has_perm(organization_id, 'manage_users'));

create policy audit_select on public.audit_logs for select to authenticated
  using (organization_id is not null and app.has_perm(organization_id, 'view_audit_log'));

-- ============================================================================
-- STORAGE: private buckets, access mirrors public.files RLS
-- Object path convention:  {organization_id}/{entity_type}/{entity_id}/{uuid}.{ext}
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts',  'receipts',  false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('documents', 'documents', false, 52428800, array['image/jpeg','image/png','image/webp','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']),
  ('media',     'media',     false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false;

create policy storage_select_private on storage.objects for select to authenticated
  using (
    bucket_id in ('receipts','documents','media')
    and exists (select 1 from public.files f where f.bucket = storage.objects.bucket_id and f.path = storage.objects.name)
  );
create policy storage_insert_private on storage.objects for insert to authenticated
  with check (
    bucket_id in ('receipts','documents','media')
    and (storage.foldername(name))[1] in (select o::text from app.my_org_ids() o)
  );
-- No UPDATE/DELETE policies: objects are immutable from clients (soft delete via public.files)
