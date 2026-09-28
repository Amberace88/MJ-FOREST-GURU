-- The platform developer (auth app_metadata.platform_role = 'developer') keeps full access
-- through organization membership + roles, but is not a person on the payroll:
-- unlink and soft-delete any employee card that was created for that account.
update public.employees e
   set user_id = null,
       deleted_at = coalesce(e.deleted_at, now()),
       job_title = 'Lapas izstrādātājs'
  from auth.users u
 where e.user_id = u.id
   and u.raw_app_meta_data ->> 'platform_role' = 'developer';
