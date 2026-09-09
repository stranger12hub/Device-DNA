-- supabase/migrations/202609090001_clerk_rls_scores.sql
-- Clerk + Supabase third-party auth, immutable repair history, public approved timelines.

alter table public.devices
  add column if not exists owner_id text,
  add column if not exists device_type text not null default 'phone',
  add column if not exists specs jsonb not null default '{}'::jsonb,
  add column if not exists purchase_date date;

alter table public.devices
  drop constraint if exists devices_device_type_check;

alter table public.devices
  add constraint devices_device_type_check
  check (device_type in ('phone', 'laptop'));

create table if not exists public.profiles (
  id text primary key,
  role text not null check (role in ('owner', 'technician')),
  display_name text,
  service_centre text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop column if exists subscription_tier;

alter table public.profiles
  add column if not exists service_centre text;

alter table public.repair_events
  add column if not exists technician_id text,
  add column if not exists cost numeric,
  add column if not exists parent_repair_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_events_technician_id_fkey'
      and conrelid = 'public.repair_events'::regclass
  ) then
    alter table public.repair_events
      add constraint repair_events_technician_id_fkey
      foreign key (technician_id) references public.profiles(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_events_parent_repair_id_fkey'
      and conrelid = 'public.repair_events'::regclass
  ) then
    alter table public.repair_events
      add constraint repair_events_parent_repair_id_fkey
      foreign key (parent_repair_id) references public.repair_events(id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'component_name') then
    create type public.component_name as enum (
      'battery',
      'display',
      'charging_assembly',
      'motherboard',
      'camera',
      'speaker',
      'back_panel',
      'keyboard',
      'storage',
      'memory',
      'cooling_system',
      'charging_port'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'part_type') then
    create type public.part_type as enum (
      'oem',
      'compatible',
      'refurbished',
      'customer_provided'
    );
  end if;
end $$;

alter table public.parts
  add column if not exists component_name public.component_name,
  add column if not exists part_number text,
  add column if not exists part_type public.part_type not null default 'compatible',
  add column if not exists supplier text,
  add column if not exists cost numeric,
  add column if not exists evidence_url text;

update public.parts
set component_name = coalesce(component_name, 'display'::public.component_name)
where component_name is null;

alter table public.parts
  alter column component_name set not null,
  drop column if exists part_name,
  drop column if exists is_genuine,
  drop column if exists created_at;

drop policy if exists "public approved repair read" on public.repair_events;
drop policy if exists "technicians insert repairs" on public.repair_events;
drop policy if exists "owners approve pending repairs" on public.repair_events;
drop policy if exists "select approved owner or technician repairs" on public.repair_events;
drop policy if exists "technicians insert pending repairs" on public.repair_events;
drop policy if exists "owners approve own pending repairs" on public.repair_events;

drop trigger if exists prevent_repair_event_mutation_trigger on public.repair_events;
drop trigger if exists repair_events_status_only_update on public.repair_events;
drop index if exists repair_events_device_id_status_idx;

alter table public.repair_events
  drop constraint if exists repair_events_status_check;

alter table public.repair_events
  drop column if exists status,
  drop column if exists logged_by;

create table if not exists public.device_scores (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  health_score int check (health_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  ai_summary text,
  previous_score int,
  generated_at timestamptz not null default now()
);

alter table public.device_scores
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists previous_score int,
  alter column health_score set not null,
  alter column ai_summary drop not null;

create table if not exists public.device_access (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id text not null,
  access_role text not null check (access_role in ('owner', 'family')),
  created_at timestamptz not null default now(),
  unique (device_id, user_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  uploaded_by text,
  doc_type text not null check (doc_type in ('invoice', 'warranty_cert', 'evidence')),
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists devices_owner_id_idx
  on public.devices(owner_id);

drop index if exists repair_events_device_id_status_idx;

create index if not exists repair_events_device_id_created_at_idx
  on public.repair_events(device_id, created_at desc);

create index if not exists repair_events_technician_id_idx
  on public.repair_events(technician_id);

create index if not exists device_scores_device_id_generated_at_idx
  on public.device_scores(device_id, generated_at desc);

create index if not exists device_access_device_id_user_id_idx
  on public.device_access(device_id, user_id);

create index if not exists documents_device_id_idx
  on public.documents(device_id);

insert into storage.buckets (id, name, public)
values ('device-documents', 'device-documents', false)
on conflict (id) do update set public = false;

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

alter table public.documents
  alter column uploaded_by set default public.jwt_sub();

create or replace function public.has_device_access(target_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devices
    where devices.id = target_device_id
      and devices.owner_id = public.jwt_sub()
  )
  or exists (
    select 1
    from public.device_access
    where device_access.device_id = target_device_id
      and device_access.user_id = public.jwt_sub()
  )
$$;

create or replace function public.prevent_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception '% records are immutable', tg_table_name;
end;
$$;

drop trigger if exists prevent_devices_delete_trigger on public.devices;
drop trigger if exists devices_no_update_delete on public.devices;
create trigger devices_no_update_delete
before update or delete on public.devices
for each row execute function public.prevent_update_delete();

drop trigger if exists prevent_repair_event_mutation_trigger on public.repair_events;
drop trigger if exists repair_events_status_only_update on public.repair_events;
drop trigger if exists repair_events_no_update_delete on public.repair_events;
create trigger repair_events_no_update_delete
before update or delete on public.repair_events
for each row execute function public.prevent_update_delete();

drop trigger if exists parts_no_update_delete on public.parts;
create trigger parts_no_update_delete
before update or delete on public.parts
for each row execute function public.prevent_update_delete();

drop trigger if exists warranty_records_no_update_delete on public.warranty_records;
create trigger warranty_records_no_update_delete
before update or delete on public.warranty_records
for each row execute function public.prevent_update_delete();

drop trigger if exists profiles_no_update_delete on public.profiles;
create trigger profiles_no_update_delete
before update or delete on public.profiles
for each row execute function public.prevent_update_delete();

drop trigger if exists device_scores_no_update_delete on public.device_scores;
create trigger device_scores_no_update_delete
before update or delete on public.device_scores
for each row execute function public.prevent_update_delete();

drop trigger if exists device_access_no_update_delete on public.device_access;
create trigger device_access_no_update_delete
before update or delete on public.device_access
for each row execute function public.prevent_update_delete();

drop trigger if exists documents_no_update_delete on public.documents;
create trigger documents_no_update_delete
before update or delete on public.documents
for each row execute function public.prevent_update_delete();

alter table public.devices enable row level security;
alter table public.profiles enable row level security;
alter table public.repair_events enable row level security;
alter table public.parts enable row level security;
alter table public.warranty_records enable row level security;
alter table public.device_scores enable row level security;
alter table public.device_access enable row level security;
alter table public.documents enable row level security;

drop policy if exists "public can read devices" on public.devices;
drop policy if exists "owners can insert devices" on public.devices;
drop policy if exists "public select devices" on public.devices;
drop policy if exists "owners insert devices" on public.devices;
drop policy if exists "public approved repair read" on public.repair_events;
drop policy if exists "technicians insert repairs" on public.repair_events;
drop policy if exists "owners approve pending repairs" on public.repair_events;
drop policy if exists "select approved owner or technician repairs" on public.repair_events;
drop policy if exists "technicians insert pending repairs" on public.repair_events;
drop policy if exists "owners approve own pending repairs" on public.repair_events;
drop policy if exists "public select repair events" on public.repair_events;
drop policy if exists "technicians insert repair events" on public.repair_events;
drop policy if exists "read parts for visible repairs" on public.parts;
drop policy if exists "technicians insert parts" on public.parts;
drop policy if exists "select parts for visible repairs" on public.parts;
drop policy if exists "technicians insert parts for own repairs" on public.parts;
drop policy if exists "read warranties for visible parts" on public.warranty_records;
drop policy if exists "technicians insert warranties" on public.warranty_records;
drop policy if exists "select warranties for visible repairs" on public.warranty_records;
drop policy if exists "technicians insert warranties for own repairs" on public.warranty_records;
drop policy if exists "public read profiles" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile name" on public.profiles;
drop policy if exists "public select profiles" on public.profiles;
drop policy if exists "public read device scores" on public.device_scores;
drop policy if exists "public select device scores" on public.device_scores;
drop policy if exists "members select documents" on public.documents;
drop policy if exists "members insert documents" on public.documents;
drop policy if exists "members select device access" on public.device_access;
drop policy if exists "members insert device access" on public.device_access;
drop policy if exists "members select device document objects" on storage.objects;
drop policy if exists "members insert device document objects" on storage.objects;

create policy "public select devices"
on public.devices for select
using (true);

create policy "owners insert devices"
on public.devices for insert
with check (
  public.jwt_role() = 'owner'
  and owner_id = public.jwt_sub()
);

create policy "public select profiles"
on public.profiles for select
using (true);

create policy "public select repair events"
on public.repair_events for select
using (true);

create policy "technicians insert repair events"
on public.repair_events for insert
with check (
  public.jwt_role() = 'technician'
  and technician_id = public.jwt_sub()
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

create policy "technicians insert parts for own repairs"
on public.parts for insert
with check (
  public.jwt_role() = 'technician'
  and exists (
    select 1
    from public.repair_events
    where repair_events.id = parts.repair_event_id
      and repair_events.technician_id = public.jwt_sub()
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

create policy "technicians insert warranties for own repairs"
on public.warranty_records for insert
with check (
  public.jwt_role() = 'technician'
  and exists (
    select 1
    from public.parts
    join public.repair_events on repair_events.id = parts.repair_event_id
    where parts.id = warranty_records.part_id
      and repair_events.technician_id = public.jwt_sub()
  )
);

create policy "public select device scores"
on public.device_scores for select
using (true);

create policy "members select documents"
on public.documents for select
using (public.has_device_access(device_id));

create policy "members insert documents"
on public.documents for insert
with check (
  public.has_device_access(device_id)
  and uploaded_by = public.jwt_sub()
);

create policy "members select device access"
on public.device_access for select
using (public.has_device_access(device_id));

create policy "members insert device access"
on public.device_access for insert
with check (
  access_role = 'family'
  and public.has_device_access(device_id)
);

create policy "members select device document objects"
on storage.objects for select
using (
  bucket_id = 'device-documents'
  and public.has_device_access((storage.foldername(name))[1]::uuid)
);

create policy "members insert device document objects"
on storage.objects for insert
with check (
  bucket_id = 'device-documents'
  and public.has_device_access((storage.foldername(name))[1]::uuid)
);
