begin;
alter table public.tickets add column if not exists casting_image text not null default '';
alter table public.tickets add constraint tickets_casting_image_format
  check (casting_image = '' or (length(casting_image) <= 400000 and casting_image like 'data:image/jpeg;base64,%'));
commit;
