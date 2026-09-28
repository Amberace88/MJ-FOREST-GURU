-- ============================================================================
-- MJ FOREST GURU — shareable invitation links
-- * Admins create the account + profile first, then hand the person a one-time
--   link (copy / WhatsApp / e-mail). No Supabase e-mail is needed.
-- * Only the SHA-256 hash of the link token is stored.
-- * Owners (Māris, Jūlija) can be invited the same way.
-- ============================================================================

alter table public.invitations add column if not exists token_hash text;
alter table public.invitations add column if not exists opened_at timestamptz;
create unique index if not exists uq_invitations_token_hash on public.invitations(token_hash) where token_hash is not null;

alter table public.invitations drop constraint if exists invitations_role_key_check;
alter table public.invitations add constraint invitations_role_key_check
  check (role_key in ('owner','admin','manager','foreman','mechanic','employee'));
-- (the hash of 32 random bytes cannot be turned back into a working link)
