-- Store account phone numbers in Supabase so they follow the Clerk account across devices.

alter table public.profiles
add column if not exists phone text;

create or replace function public.prevent_profile_mutation_except_phone()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'profiles records cannot be deleted';
  end if;

  if new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.display_name is distinct from old.display_name
    or new.service_centre is distinct from old.service_centre
    or new.created_at is distinct from old.created_at
  then
    raise exception 'only profile phone can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_no_update_delete on public.profiles;
create trigger profiles_phone_only_update
before update or delete on public.profiles
for each row execute function public.prevent_profile_mutation_except_phone();

drop policy if exists "users update own profile phone" on public.profiles;
create policy "users update own profile phone"
on public.profiles for update
using (id = public.jwt_sub())
with check (id = public.jwt_sub());

select pg_notify('pgrst', 'reload schema');
