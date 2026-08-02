-- Somnara database schema
-- Paste this into the Supabase SQL editor at: https://supabase.com/dashboard → SQL Editor

-- Enable Row Level Security on all tables so each user only sees their own data.

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  name        text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read and write their own profile"
  on profiles for all using (auth.uid() = id);

-- ─── Paired devices ─────────────────────────────────────────────────────────
create table if not exists paired_devices (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  serial      text unique not null,
  name        text not null default 'My Somnara',
  firmware    text,
  paired_at   timestamptz default now()
);
alter table paired_devices enable row level security;
create policy "Users can manage their own devices"
  on paired_devices for all using (auth.uid() = user_id);

-- ─── Alarms ─────────────────────────────────────────────────────────────────
create table if not exists alarms (
  id          text primary key,           -- client-generated (Date.now())
  user_id     uuid not null references profiles(id) on delete cascade,
  hour        int not null check (hour between 0 and 23),
  minute      int not null check (minute between 0 and 59),
  days        int[] not null,             -- 0=Sun … 6=Sat
  enabled     boolean not null default true,
  label       text default '',
  updated_at  timestamptz default now()
);
alter table alarms enable row level security;
create policy "Users can manage their own alarms"
  on alarms for all using (auth.uid() = user_id);

-- ─── Preferences ─────────────────────────────────────────────────────────────
create table if not exists preferences (
  user_id           uuid primary key references profiles(id) on delete cascade,
  sunrise_duration  int not null default 30 check (sunrise_duration in (15, 30, 45)),
  timezone          text not null default 'UTC',
  updated_at        timestamptz default now()
);
alter table preferences enable row level security;
create policy "Users can manage their own preferences"
  on preferences for all using (auth.uid() = user_id);

-- ─── Auto-create profile on sign-up ─────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  insert into preferences (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
