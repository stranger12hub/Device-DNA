-- Owner activity approval replaces OTP approval.
-- Run this in Supabase SQL Editor, then redeploy the app.

drop function if exists public.approve_repair_event(uuid, text);

create or replace function public.approve_repair_event(repair_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id text;
  owns_device boolean;
begin
  caller_id := auth.jwt() ->> 'sub';

  if caller_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.repair_events re
    join public.devices d on d.id = re.device_id
    where re.id = repair_event_id
      and d.owner_id = caller_id
      and re.status = 'pending'
  ) into owns_device;

  if not owns_device then
    return false;
  end if;

  update public.repair_events
  set status = 'approved'
  where id = repair_event_id
    and status = 'pending';

  return found;
end;
$$;

revoke all on function public.approve_repair_event(uuid) from public;
grant execute on function public.approve_repair_event(uuid) to authenticated;

drop policy if exists "owners approve own pending repairs" on public.repair_events;
drop policy if exists "owners approve repairs with otp only" on public.repair_events;

alter table public.approval_requests enable row level security;
drop policy if exists "approval requests are service only" on public.approval_requests;
