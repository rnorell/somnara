#!/usr/bin/env node
// Post-deployment authorization verification.
//
// Confirms RLS actually holds against a REAL deployed backend: an anon
// client and a second signed-in user both get zero rows for data they
// don't own, and the owner's own access still works. This is the step the
// release runbook calls for right after every deploy — run it deliberately
// by a human, not automatically on every push (see
// .github/workflows/post-deploy-verify.yml).
//
// Requires, as environment variables:
//   STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY
//   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD
//   TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
//
// The two test accounts must already exist and be email-confirmed in the
// target project — this script signs in, it does not create/confirm
// accounts (that would need a service-role key, which must never be used
// here). NEVER point this at a real production project's env vars unless
// TEST_USER_A/B are dedicated disposable accounts — it writes and deletes
// a real row as user A.

import { createClient } from '@supabase/supabase-js';

const required = [
  'STAGING_SUPABASE_URL',
  'STAGING_SUPABASE_ANON_KEY',
  'TEST_USER_A_EMAIL',
  'TEST_USER_A_PASSWORD',
  'TEST_USER_B_EMAIL',
  'TEST_USER_B_PASSWORD',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.log(`Skipping — missing env vars: ${missing.join(', ')}`);
  console.log('This is expected until a staging project + test accounts are configured.');
  process.exit(0);
}

const url = process.env.STAGING_SUPABASE_URL;
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;

function client() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const testAlarmId = `verify-deploy-${Date.now()}`;

  const clientA = client();
  const { data: signInA, error: signInAError } = await clientA.auth.signInWithPassword({
    email: process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_USER_A_PASSWORD,
  });
  if (signInAError || !signInA.user) {
    record('user A can sign in', false, signInAError?.message);
    process.exitCode = 1;
    return;
  }
  record('user A can sign in', true);
  const userAId = signInA.user.id;

  // User A creates a test alarm.
  const { error: insertError } = await clientA.from('alarms').insert({
    id: testAlarmId,
    user_id: userAId,
    hour: 6,
    minute: 0,
    days: [1],
    enabled: true,
    label: 'verify-deployment test row — safe to delete',
  });
  record('user A can insert their own alarm', !insertError, insertError?.message);

  // User A can read it back.
  const { data: ownRead, error: ownReadError } = await clientA
    .from('alarms').select('id').eq('id', testAlarmId);
  record('user A can read their own alarm back', !ownReadError && ownRead?.length === 1, ownReadError?.message);

  // Anonymous client: zero access.
  const anonClient = client();
  const { data: anonRead, error: anonError } = await anonClient
    .from('alarms').select('id').eq('id', testAlarmId);
  record('anonymous client gets zero rows for the test alarm', !anonError && anonRead?.length === 0, anonError?.message);

  // User B: signed in, but not the owner — zero access.
  const clientB = client();
  const { data: signInB, error: signInBError } = await clientB.auth.signInWithPassword({
    email: process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_USER_B_PASSWORD,
  });
  if (signInBError || !signInB.user) {
    record('user B can sign in', false, signInBError?.message);
  } else {
    record('user B can sign in', true);
    const { data: crossRead, error: crossError } = await clientB
      .from('alarms').select('id').eq('id', testAlarmId);
    record('user B gets zero rows for user A\'s alarm', !crossError && crossRead?.length === 0, crossError?.message);

    const { error: crossDeleteError } = await clientB.from('alarms').delete().eq('id', testAlarmId);
    const { data: stillThere } = await clientA.from('alarms').select('id').eq('id', testAlarmId);
    record(
      'user B deleting user A\'s alarm affects zero rows',
      !crossDeleteError && stillThere?.length === 1,
    );
  }

  // Cleanup — always attempt this even if earlier checks failed.
  const { error: cleanupError } = await clientA.from('alarms').delete().eq('id', testAlarmId);
  record('cleanup: test alarm removed', !cleanupError, cleanupError?.message);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log('FAILED:', failed.map((r) => r.name).join('; '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-deployment crashed:', err);
  process.exitCode = 1;
});
