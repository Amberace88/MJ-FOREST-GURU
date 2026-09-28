-- ============================================================================
-- MJ FOREST GURU — prepared accounts (e-mail added later)
-- An admin can reserve a user seat with a name + role before the person's e-mail
-- is known. Such a row is an invitation "draft": email IS NULL, no user, no token.
-- When the admin enters the e-mail, the real account + one-time link is created
-- and the draft is closed (revoked_at).
-- Seeds the two owners of the real organization: Māris and Jūlija.
-- ============================================================================

alter table public.invitations alter column email drop not null;
alter table public.invitations add column if not exists full_name text;

alter table public.invitations drop constraint if exists invitations_full_name_check;
alter table public.invitations add constraint invitations_full_name_check
  check (full_name is null or length(trim(full_name)) between 1 and 200);

-- a draft must at least carry a name and can never hold a link or an account
alter table public.invitations drop constraint if exists invitations_draft_check;
alter table public.invitations add constraint invitations_draft_check
  check (email is not null or (full_name is not null and user_id is null and token_hash is null));

insert into public.invitations (organization_id, email, full_name, role_key, invited_by, expires_at)
select o.id, null, n.full_name, 'owner', null, now() + interval '10 years'
  from public.organizations o
 cross join (values ('Māris'), ('Jūlija')) as n(full_name)
 where o.slug = 'mj-forest-guru'
   and not exists (
     select 1 from public.invitations i
      where i.organization_id = o.id and i.email is null and i.full_name = n.full_name
   );
