alter table public.devices
  drop constraint if exists device_type_phone_only;

alter table public.devices
  drop constraint if exists devices_device_type_check;

alter table public.devices
  add constraint devices_device_type_check
  check (device_type in ('phone', 'laptop'));

select pg_notify('pgrst', 'reload schema');
