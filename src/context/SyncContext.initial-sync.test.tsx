jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { chainable, EMPTY_ALARMS, EMPTY_PREFS, setSupabase, renderSync } from './syncTestHelpers';

it('pulls on load and settles on "synced"', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable(EMPTY_ALARMS))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  setSupabase({ from });

  const { getCtx } = await renderSync();
  expect(getCtx().status).toBe('synced');
  expect(getCtx().lastSyncedAt).not.toBeNull();
});
