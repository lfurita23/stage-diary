-- Run in the project's Supabase SQL editor before using transfer attachments.
-- These fields use the tickets table's existing account-based RLS policies.
begin;
alter table public.tickets
  add column if not exists phone_suffix text not null default '',
  add column if not exists transfer_image text not null default '';
alter table public.tickets add constraint tickets_phone_suffix_format
  check (phone_suffix = '' or phone_suffix ~ '^[0-9]{4}$');
alter table public.tickets add constraint tickets_transfer_image_format
  check (transfer_image = '' or (length(transfer_image) <= 400000 and transfer_image like 'data:image/jpeg;base64,%'));
commit;
