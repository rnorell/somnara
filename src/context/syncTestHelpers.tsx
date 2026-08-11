import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { SyncProvider, useSyncContext } from './SyncContext';

// Plain require (not `import * as`) so this points at the exact same
// module-registry object SyncContext.tsx's compiled `require('../lib/supabase')`
// reads — `import *` goes through Babel's ESM-interop wrapping, which copies
// the object instead of sharing the live reference, so mutating it silently
// has no effect on what the component sees.
const supabaseModule = require('../lib/supabase');

// Every query-builder method just returns the same thenable object, so any
// chain (.select().eq(), .delete().eq().in(), .update().eq(), .upsert())
// resolves to whichever result this call was configured with — matching
// every call shape SyncContext.tsx actually uses. Rejection is lazy (only
// constructed inside .then, once actually awaited) so a configured-but-not-
// yet-awaited failure never sits as an unhandled rejection.
export function chainable(result: unknown, shouldReject = false) {
  const obj: any = {};
  ['select', 'eq', 'in', 'single', 'delete', 'update', 'upsert'].forEach(method => {
    obj[method] = jest.fn(() => obj);
  });
  obj.then = (resolve: any, reject: any) =>
    (shouldReject ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
  return obj;
}

export const EMPTY_ALARMS = { data: [], error: null };
export const EMPTY_PREFS = { data: null, error: { code: 'PGRST116' } };
export const NETWORK_ERROR = new TypeError('Network request failed');

export function setSupabase(value: { from: jest.Mock } | null) {
  supabaseModule.supabase = value;
}

// Forces a real macrotask boundary inside act(), so every pending microtask
// chain in SyncContext's async functions (and the AsyncStorage mock's own
// async/await internals) actually settles before we assert.
export async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });
}

export async function flushFakeTimers() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
}

function Probe({ onReady }: { onReady: (ctx: ReturnType<typeof useSyncContext>) => void }) {
  const ctx = useSyncContext();
  onReady(ctx);
  return <Text testID="status">{ctx.status}</Text>;
}

export async function renderSync() {
  let latest: ReturnType<typeof useSyncContext>;
  await render(
    <SyncProvider userId="user-1">
      <Probe onReady={(ctx) => { latest = ctx; }} />
    </SyncProvider>,
  );
  await flush();
  return { getCtx: () => latest! };
}
