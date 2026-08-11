-- RLS assertions for supabase/schema.sql, using pgTAP.
--
-- Run with the Supabase CLI against a local instance:
--   supabase start
--   supabase test db
--
-- (Directory convention and exact CLI invocation may differ slightly by CLI
-- version — check `supabase test db --help` / the pgTAP guide at
-- https://supabase.com/docs/guides/local-development/testing/pgtap-extended
-- against whatever version is installed if this doesn't run as-is.)
--
-- Impersonation uses the low-level mechanism Supabase's `auth.uid()` reads
-- from directly (`request.jwt.claim.sub` + `role`), rather than a specific
-- CLI helper function, since that's stable across CLI versions.

begin;
select plan(19);

-- ── Setup: two users, entirely independent data ──────────────────────────
-- auth.users has more columns in a real project (encrypted_password, etc.)
-- with defaults for most; adjust this insert if your local schema requires
-- more than id/email.
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.com');

-- profiles rows would normally come from the handle_new_user trigger; insert
-- directly here since the trigger fires as part of the real signup flow.
insert into public.profiles (id, email, name)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.com', 'User B');

insert into public.preferences (user_id, sunrise_duration, timezone)
values
  ('11111111-1111-1111-1111-111111111111', 15, 'UTC'),
  ('22222222-2222-2222-2222-222222222222', 30, 'UTC');

insert into public.alarms (id, user_id, hour, minute, days, enabled, label)
values
  ('alarm-a', '11111111-1111-1111-1111-111111111111', 7, 0, '{1,2,3}', true, 'A''s alarm'),
  ('alarm-b', '22222222-2222-2222-2222-222222222222', 8, 0, '{1,2,3}', true, 'B''s alarm');

insert into private.device_inventory (serial, activation_code_lookup, activation_code_hash)
values ('SOM-TEST-0001', extensions.digest('TESTCODE123', 'sha256'), extensions.crypt('TESTCODE123', extensions.gen_salt('bf')));

update private.device_inventory set status = 'claimed', claimed_by = '11111111-1111-1111-1111-111111111111'
  where serial = 'SOM-TEST-0001';
insert into public.paired_devices (user_id, serial, name)
values ('11111111-1111-1111-1111-111111111111', 'SOM-TEST-0001', 'A''s Somnara');

-- ── anon: zero access on every table ──────────────────────────────────────
set local role anon;
reset request.jwt.claim.sub;

select is_empty('select * from public.profiles', 'anon cannot read any profile');
select is_empty('select * from public.alarms', 'anon cannot read any alarm');
select is_empty('select * from public.preferences', 'anon cannot read any preferences');
select is_empty('select * from public.paired_devices', 'anon cannot read any paired device');
select throws_ok(
  $$ insert into public.alarms (id, user_id, hour, minute, days, enabled, label)
     values ('x', '11111111-1111-1111-1111-111111111111', 0, 0, '{1}', true, '') $$,
  'anon cannot insert an alarm'
);

-- ── user A: sees only their own rows ──────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'user A sees only their own profile row'
);
select results_eq(
  $$ select id from public.alarms order by id $$,
  $$ values ('alarm-a'::text) $$,
  'user A sees only their own alarm'
);
select results_eq(
  $$ select user_id from public.preferences order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'user A sees only their own preferences'
);
select results_eq(
  $$ select user_id from public.paired_devices order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'user A sees only their own paired device'
);

-- writes to A's own rows succeed
select lives_ok(
  $$ update public.preferences set sunrise_duration = 45 where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can update their own preferences'
);
select lives_ok(
  $$ insert into public.alarms (id, user_id, hour, minute, days, enabled, label)
     values ('alarm-a2', '11111111-1111-1111-1111-111111111111', 9, 0, '{1}', true, '') $$,
  'user A can insert their own alarm'
);
select lives_ok(
  $$ delete from public.alarms where id = 'alarm-a2' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can delete their own alarm'
);

-- writes to B's rows are silently no-ops (RLS filters the target out, not
-- an error) — assert the row is unchanged rather than expecting a throw.
update public.preferences set sunrise_duration = 15 where user_id = '22222222-2222-2222-2222-222222222222';
set local role postgres;
select is(
  (select sunrise_duration from public.preferences where user_id = '22222222-2222-2222-2222-222222222222'),
  30,
  'user A updating user B''s preferences affects zero rows'
);
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

delete from public.alarms where id = 'alarm-b';
set local role postgres;
select isnt_empty(
  $$ select 1 from public.alarms where id = 'alarm-b' $$,
  'user A deleting user B''s alarm affects zero rows — it still exists'
);
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- device_inventory / device_activation_attempts (private schema) are
-- unreachable directly regardless of role.
select throws_ok(
  $$ select * from private.device_inventory $$,
  'authenticated role has no direct access to the private schema'
);

-- paired_devices: no insert policy exists for authenticated users — only
-- claim_device() (security definer) can create a row.
select throws_ok(
  $$ insert into public.paired_devices (user_id, serial, name)
     values ('11111111-1111-1111-1111-111111111111', 'SOM-TEST-0002', 'x') $$,
  'authenticated users cannot insert paired_devices directly, even their own'
);

-- ── user B: cannot see or touch user A's data ─────────────────────────────
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$ select * from public.alarms where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user B cannot see user A''s alarms even when filtering by A''s id explicitly'
);
select is_empty(
  $$ select * from public.paired_devices where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'user B cannot see user A''s paired device'
);
select is_empty(
  $$ select * from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'user B cannot see user A''s profile'
);

select * from finish();
rollback;
