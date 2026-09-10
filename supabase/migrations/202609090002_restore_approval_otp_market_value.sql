-- Restore owner approval with OTP confirmation and add market-value score fields.

create extension if not exists pgcrypto;

alter table public.repair_events
  add column if not exists status text not null default 'pending';

alter table public.repair_events
  drop constraint if exists repair_events_status_check;

alter table public.repair_events
  add constraint repair_events_status_check
  check (status in ('pending', 'approved'));

update public.repair_events
set status = 'approved'
where status is null;

alter table public.device_scores
  add column if not exists market_value_estimate numeric,
  add column if not exists market_value_summary text;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  repair_event_id uuid not null references public.repair_events(id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists approval_requests_repair_event_id_idx
  on public.approval_requests(repair_event_id, expires_at desc);

create index if not exists repair_events_status_idx
  on public.repair_events(status);

create or replace function public.jwt_sub()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'sub'
$$;

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'publicMetadata' ->> 'role',
    auth.jwt() -> 'public_metadata' ->> 'role'
  )
$$;

create or replace function public.prevent_repair_event_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and current_setting('app.approving_repair_event', true) = 'true'
    and old.status = 'pending'
    and new.status = 'approved'
    and old.id = new.id
    and old.device_id is not distinct from new.device_id
    and old.technician_id is not distinct from new.technician_id
    and old.symptom is not distinct from new.symptom
    and old.diagnosis is not distinct from new.diagnosis
    and old.action_taken is not distinct from new.action_taken
    and old.cost is not distinct from new.cost
    and old.parent_repair_id is not distinct from new.parent_repair_id
    and old.created_at is not distinct from new.created_at
  then
    return new;
  end if;

  raise exception 'repair_events records are immutable';
end;
$$;

drop trigger if exists repair_events_no_update_delete on public.repair_events;
drop trigger if exists prevent_repair_event_mutation_trigger on public.repair_events;
drop trigger if exists repair_events_status_only_update on public.repair_events;

create trigger repair_events_no_update_delete
before update or delete on public.repair_events
for each row execute function public.prevent_repair_event_mutation();

create or replace function public.approve_repair_event(
  repair_event_id uuid,
  otp_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_request_id uuid;
begin
  if otp_code is null or length(trim(otp_code)) <> 6 then
    return false;
  end if;

  select approval_requests.id
  into matched_request_id
  from public.approval_requests
  join public.repair_events on repair_events.id = approval_requests.repair_event_id
  join public.devices on devices.id = repair_events.device_id
  where approval_requests.repair_event_id = approve_repair_event.repair_event_id
    and approval_requests.verified = false
    and approval_requests.expires_at > now()
    and approval_requests.otp_hash =
      encode(digest(approval_requests.repair_event_id::text || ':' || trim(otp_code), 'sha256'), 'hex')
    and repair_events.status = 'pending'
    and devices.owner_id = public.jwt_sub()
  order by approval_requests.created_at desc
  limit 1;

  if matched_request_id is null then
    return false;
  end if;

  perform set_config('app.approving_repair_event', 'true', true);

  update public.repair_events
  set status = 'approved'
  where id = approve_repair_event.repair_event_id
    and status = 'pending';

  update public.approval_requests
  set verified = true
  where id = matched_request_id;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.approve_repair_event(uuid, text) from public;
grant execute on function public.approve_repair_event(uuid, text) to authenticated;

alter table public.repair_events enable row level security;
alter table public.parts enable row level security;
alter table public.warranty_records enable row level security;
alter table public.device_scores enable row level security;
alter table public.approval_requests enable row level security;

drop policy if exists "public select repair events" on public.repair_events;
drop policy if exists "technicians insert repair events" on public.repair_events;
drop policy if exists "public approved repair read" on public.repair_events;
drop policy if exists "select approved owner or technician repairs" on public.repair_events;
drop policy if exists "technicians insert pending repairs" on public.repair_events;
drop policy if exists "owners approve own pending repairs" on public.repair_events;

drop policy if exists "select parts for visible repairs" on public.parts;
drop policy if exists "technicians insert parts for own repairs" on public.parts;
drop policy if exists "technicians insert parts for own pending repairs" on public.parts;

drop policy if exists "select warranties for visible repairs" on public.warranty_records;
drop policy if exists "technicians insert warranties for own repairs" on public.warranty_records;
drop policy if exists "technicians insert warranties for own pending repairs" on public.warranty_records;

drop policy if exists "public select device scores" on public.device_scores;
drop policy if exists "service role insert device scores" on public.device_scores;

create policy "select approved owner or technician repairs"
on public.repair_events for select
using (
  status = 'approved'
  or technician_id = public.jwt_sub()
  or exists (
    select 1
    from public.devices
    where devices.id = repair_events.device_id
      and devices.owner_id = public.jwt_sub()
  )
);

create policy "technicians insert pending repairs"
on public.repair_events for insert
with check (
  public.jwt_role() = 'technician'
  and technician_id = public.jwt_sub()
  and status = 'pending'
);

create policy "select parts for visible repairs"
on public.parts for select
using (
  exists (
    select 1
    from public.repair_events
    where repair_events.id = parts.repair_event_id
  )
);

create policy "technicians insert parts for own pending repairs"
on public.parts for insert
with check (
  public.jwt_role() = 'technician'
  and exists (
    select 1
    from public.repair_events
    where repair_events.id = parts.repair_event_id
      and repair_events.technician_id = public.jwt_sub()
      and repair_events.status = 'pending'
  )
);

create policy "select warranties for visible repairs"
on public.warranty_records for select
using (
  exists (
    select 1
    from public.parts
    join public.repair_events on repair_events.id = parts.repair_event_id
    where parts.id = warranty_records.part_id
  )
);

create policy "technicians insert warranties for own pending repairs"
on public.warranty_records for insert
with check (
  public.jwt_role() = 'technician'
  and exists (
    select 1
    from public.parts
    join public.repair_events on repair_events.id = parts.repair_event_id
    where parts.id = warranty_records.part_id
      and repair_events.technician_id = public.jwt_sub()
      and repair_events.status = 'pending'
  )
);

create policy "public select device scores"
on public.device_scores for select
using (true);

create policy "service role insert device scores"
on public.device_scores for insert
with check (auth.role() = 'service_role');

-- approval_requests intentionally has RLS enabled and zero policies.
