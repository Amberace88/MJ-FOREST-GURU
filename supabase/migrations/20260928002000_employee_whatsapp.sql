-- ============================================================================
-- MJ FOREST GURU — 2000 Employee contact: WhatsApp number (international format)
-- The form now requires e-mail + phone in "+<country code><number>" format;
-- existing rows are left as they are (validated in the app when edited).
-- ============================================================================
alter table public.employees add column if not exists whatsapp text;
alter table public.employees drop constraint if exists employees_whatsapp_format;
alter table public.employees add constraint employees_whatsapp_format
  check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');
