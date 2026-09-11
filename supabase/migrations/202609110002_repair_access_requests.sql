-- Technician access-request workflow.
-- Owner registers the device. Technician requests access. Owner approves/declines in Activity.
-- After approval, the technician can add repair logs. The owner cannot add repair logs.

create table if not exists public.repair_access_requests (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  requester_id text not null references public.profiles(id),
  requester_name text not null,
  requester_phone text not null,
  shop_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists repair_access_requests_device_id_idx
  on public.repair_access_requests(device_id);

create index if not exists repair_access_requests_requester_id_idx
  on public.repair_access_requests(requester_id);

create unique index if not exists repair_access_requests_open_unique
  on public.repair_access_requests(device_id, requester_id)
  where status in ('pending', 'approved');

alter table public.repair_access_requests enable row level security;

drop policy if exists "requesters create repair access requests" on public.repair_access_requests;
drop policy if exists "requesters read own repair access requests" on public.repair_access_requests;
drop policy if exists "owners read device repair access requests" on public.repair_access_requests;
drop policy if exists "owners decide repair access requests" on public.repair_access_requests;

create policy "requesters create repair access requests"
on public.repair_access_requests
for insert
to authenticated
with check (
  requester_id = (auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.devices d
    where d.id = device_id
      and d.owner_id <> (auth.jwt() ->> 'sub')
  )
);

create policy "requesters read own repair access requests"
on public.repair_access_requests
for select
to authenticated
using (requester_id = (auth.jwt() ->> 'sub'));

create policy "owners read device repair access requests"
on public.repair_access_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and d.owner_id = (auth.jwt() ->> 'sub')
  )
);

create policy "owners decide repair access requests"
on public.repair_access_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and d.owner_id = (auth.jwt() ->> 'sub')
  )
)
with check (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and d.owner_id = (auth.jwt() ->> 'sub')
  )
);

drop function if exists public.decide_repair_access_request(uuid, text);

create or replace function public.decide_repair_access_request(
  request_id uuid,
  decision text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id text;
  allowed boolean;
begin
  caller_id := auth.jwt() ->> 'sub';

  if caller_id is null or decision not in ('approved', 'declined') then
    return false;
  end if;

  select exists (
    select 1
    from public.repair_access_requests rar
    join public.devices d on d.id = rar.device_id
    where rar.id = request_id
      and rar.status = 'pending'
      and d.owner_id = caller_id
  ) into allowed;

  if not allowed then
    return false;
  end if;

  update public.repair_access_requests
  set status = decision,
      decided_at = now()
  where id = request_id
    and status = 'pending';

  return found;
end;
$$;

revoke all on function public.decide_repair_access_request(uuid, text) from public;
grant execute on function public.decide_repair_access_request(uuid, text) to authenticated;
