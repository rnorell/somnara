jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { act } from '@testing-library/react-native';
import { chainable, EMPTY_ALARMS, EMPTY_PREFS, NETWORK_ERROR, setSupabase, renderSync, flush } from './syncTestHelpers';

it('goes "offline" when the initial pull fails on a network error, and retry() recovers it', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable(NETWORK_ERROR, true))
    .mockImplementationOnce(() => chainable(NETWORK_ERROR, true));
  setSupabase({ from });

  const { getCtx } = await renderSync();
  expect(getCtx().status).toBe('offline');
  expect(getCtx().lastError).toBeTruthy();

  from
    .mockImplementationOnce(() => chainable(EMPTY_ALARMS))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  await act(async () => { getCtx().retry(); });
  await flush();
  expect(getCtx().status).toBe('synced');
});
