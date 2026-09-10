-- Remove leftover insert policies that depended on Clerk publicMetadata.role.
-- The app now bootstraps a Supabase profile from the authenticated Clerk user id.

drop policy if exists "technicians insert repair events" on public.repair_events;
drop policy if exists "technicians insert parts for own repairs" on public.parts;
drop policy if exists "technicians insert warranties for own repairs" on public.warranty_records;

drop policy if exists "technicians insert pending repairs" on public.repair_events;
drop policy if exists "authenticated technicians insert pending repairs" on public.repair_events;

create policy "authenticated technicians insert pending repairs"
on public.repair_events for insert
with check (
  public.jwt_sub() is not null
  and technician_id = public.jwt_sub()
  and status = 'pending'
  and exists (
    select 1
    from public.profiles
    where profiles.id = public.jwt_sub()
  )
);

drop policy if exists "authenticated technicians insert parts for own pending repairs" on public.parts;

create policy "authenticated technicians insert parts for own pending repairs"
on public.parts for insert
with check (
  public.jwt_sub() is not null
  and exists (
    select 1
    from public.repair_events
    where repair_events.id = parts.repair_event_id
      and repair_events.technician_id = public.jwt_sub()
      and repair_events.status = 'pending'
  )
);

drop policy if exists "authenticated technicians insert warranties for own pending repairs" on public.warranty_records;

create policy "authenticated technicians insert warranties for own pending repairs"
on public.warranty_records for insert
with check (
  public.jwt_sub() is not null
  and exists (
    select 1
    from public.parts
    join public.repair_events on repair_events.id = parts.repair_event_id
    where parts.id = warranty_records.part_id
      and repair_events.technician_id = public.jwt_sub()
      and repair_events.status = 'pending'
  )
);
