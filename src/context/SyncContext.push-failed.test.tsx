jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { act } from '@testing-library/react-native';
import { chainable, EMPTY_ALARMS, EMPTY_PREFS, setSupabase, renderSync, flushFakeTimers } from './syncTestHelpers';

it('goes "failed" (not "offline") on a non-network push error, and keeps it queued for retry', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable(EMPTY_ALARMS))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  setSupabase({ from });
  const { getCtx } = await renderSync();

  jest.useFakeTimers();
  from.mockImplementationOnce(() => chainable(new Error('permission denied for table alarms'), true));
  await act(async () => { getCtx().setAlarms([{ id: 'a1', hour: 7, minute: 0, days: [1], enabled: true, label: '' }]); });
  await flushFakeTimers();
  expect(getCtx().status).toBe('failed');
  expect(getCtx().lastError).toMatch(/permission denied/);
  jest.useRealTimers();
});
