-- ============================================================================
-- MJ FOREST GURU — 1100 Security hardening (function privileges)
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Lock it down:
--   * app.* helpers: only what RLS policies need is executable by `authenticated`
--   * internal/bootstrap functions: service_role only
-- ============================================================================

revoke execute on all functions in schema app from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public;

grant execute on function
  app.is_member(uuid), app.has_perm(uuid, text), app.has_role(uuid, text), app.my_org_ids(),
  app.my_employee_id(uuid), app.my_project_ids(uuid), app.my_led_project_ids(uuid),
  app.can_access_project(uuid), app.leads_project(uuid), app.in_my_scope_employee(uuid),
  app.can_view_employee(uuid), app.can_access_machine(uuid), app.entity_visible(text, uuid),
  app.shares_org(uuid), app.overlap_hours(timestamptz, timestamptz, timestamptz, timestamptz),
  app.org_timezone(uuid), app.request_header(text)
to authenticated;

grant execute on all functions in schema app to service_role;

-- public schema: nothing callable by anon
revoke execute on all functions in schema public from anon;

-- sanity: every public table must have RLS enabled (fails the migration otherwise)
do $$
declare t text;
begin
  select string_agg(c.relname, ', ') into t
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if t is not null then
    raise exception 'RLS_NOT_ENABLED on: %', t;
  end if;
end $$;
