-- Somnara security-first Supabase schema (canonical fresh-environment schema)
-- Deploy through a reviewed migration. Never embed a service-role key in the app.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  name text check (name is null or char_length(name) <= 100),
  created_at timestamptz not null default now()
);

create table if not exists private.device_inventory (
  serial text primary key check (serial ~ '^SOM-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  activation_code_lookup bytea not null unique,
  activation_code_hash text not null,
  model text not null default 'Somnara Pro' check (char_length(model) <= 60),
  firmware text check (firmware is null or char_length(firmware) <= 40),
  status text not null default 'provisioned' check (status in ('provisioned', 'claimed', 'reset_required')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.device_activation_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists device_activation_attempts_user_time_idx
  on private.device_activation_attempts(user_id, attempted_at desc);

create table if not exists public.paired_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  serial text not null unique references private.device_inventory(serial),
  name text not null default 'My Somnara' check (char_length(name) between 1 and 60),
  paired_at timestamptz not null default now()
);

create table if not exists public.alarms (
  id text not null check (char_length(id) between 1 and 80),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hour int not null check (hour between 0 and 23),
  minute int not null check (minute between 0 and 59),
  days int[] not null check (
    cardinality(days) between 1 and 7
    and days <@ array[0, 1, 2, 3, 4, 5, 6]
  ),
  enabled boolean not null default true,
  label text not null default '' check (char_length(label) <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sunrise_duration int not null default 30 check (sunrise_duration in (15, 30, 45)),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 100),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.paired_devices enable row level security;
alter table public.alarms enable row level security;
alter table public.preferences enable row level security;

drop policy if exists "Users can read and write their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can manage their own devices" on public.paired_devices;
drop policy if exists "Users can read their own devices" on public.paired_devices;
drop policy if exists "Users can rename their own devices" on public.paired_devices;
create policy "Users can read their own devices" on public.paired_devices
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can rename their own devices" on public.paired_devices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own alarms" on public.alarms;
drop policy if exists "Users can select their own alarms" on public.alarms;
drop policy if exists "Users can insert their own alarms" on public.alarms;
drop policy if exists "Users can update their own alarms" on public.alarms;
drop policy if exists "Users can delete their own alarms" on public.alarms;
create policy "Users can select their own alarms" on public.alarms
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own alarms" on public.alarms
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own alarms" on public.alarms
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own alarms" on public.alarms
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own preferences" on public.preferences;
drop policy if exists "Users can select their own preferences" on public.preferences;
drop policy if exists "Users can insert their own preferences" on public.preferences;
drop policy if exists "Users can update their own preferences" on public.preferences;
create policy "Users can select their own preferences" on public.preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own preferences" on public.preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own preferences" on public.preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.paired_devices, public.alarms, public.preferences from anon;
revoke update on public.profiles from authenticated;
grant update(name) on public.profiles to authenticated;
revoke insert, delete, update on public.paired_devices from authenticated;
grant select on public.paired_devices to authenticated;
grant update(name) on public.paired_devices to authenticated;

create or replace function public.claim_device(p_activation_code text, p_name text default 'My Somnara')
returns public.paired_devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_activation_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_inventory private.device_inventory%rowtype;
  v_device public.paired_devices%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if char_length(v_code) < 10 or char_length(v_code) > 64 then return null; end if;
  if (select count(*) from private.device_activation_attempts
      where user_id = v_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    return null;
  end if;

  insert into private.device_activation_attempts(user_id) values (v_uid);
  select * into v_inventory
    from private.device_inventory
    where status = 'provisioned'
      and activation_code_lookup = extensions.digest(v_code, 'sha256')
      and activation_code_hash = extensions.crypt(v_code, activation_code_hash)
    for update;
  if not found then return null; end if;
  if exists (select 1 from public.paired_devices where user_id = v_uid) then
    return null;
  end if;

  insert into public.paired_devices(user_id, serial, name)
  values (v_uid, v_inventory.serial, left(coalesce(nullif(trim(p_name), ''), 'My Somnara'), 60))
  returning * into v_device;

  update private.device_inventory
    set status = 'claimed', claimed_by = v_uid, claimed_at = now()
    where serial = v_inventory.serial;
  return v_device;
end;
$$;

create or replace function public.unlink_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_serial text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  delete from public.paired_devices
    where id = p_device_id and user_id = v_uid
    returning serial into v_serial;
  if v_serial is null then raise exception 'Device not found'; end if;
  update private.device_inventory
    set status = 'reset_required', claimed_by = null, claimed_at = null
    where serial = v_serial;
end;
$$;

revoke all on function public.claim_device(text, text) from public, anon;
revoke all on function public.unlink_device(uuid) from public, anon;
grant execute on function public.claim_device(text, text) to authenticated;
grant execute on function public.unlink_device(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, name)
  values (
    new.id,
    left(coalesce(new.email, ''), 320),
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)), 100)
  );
  insert into public.preferences(user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Provision devices only from trusted manufacturing/admin tooling. Store only a
-- strong random activation-code lookup digest plus a slow verification hash:
-- extensions.digest(code, 'sha256') and extensions.crypt(code, extensions.gen_salt('bf')).
