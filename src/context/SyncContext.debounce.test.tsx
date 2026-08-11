jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { act } from '@testing-library/react-native';
import { chainable, EMPTY_ALARMS, EMPTY_PREFS, setSupabase, renderSync, flushFakeTimers } from './syncTestHelpers';

it('debounces a local edit through local -> syncing -> synced', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable(EMPTY_ALARMS))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  setSupabase({ from });
  const { getCtx } = await renderSync();

  jest.useFakeTimers();
  from
    .mockImplementationOnce(() => chainable({ data: [], error: null })) // read existing alarm ids
    .mockImplementationOnce(() => chainable({ error: null }));          // upsert

  await act(async () => { getCtx().setAlarms([{ id: 'a1', hour: 7, minute: 0, days: [1], enabled: true, label: '' }]); });
  expect(getCtx().status).toBe('local');

  await flushFakeTimers();
  expect(getCtx().status).toBe('synced');
  jest.useRealTimers();
});
