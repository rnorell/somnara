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

it('writes the confirmed alarm profile to Supabase', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable(EMPTY_ALARMS))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  setSupabase({ from });
  const { getCtx } = await renderSync();

  jest.useFakeTimers();
  const readBuilder = chainable({ data: [], error: null });
  const writeBuilder = chainable({ error: null });
  from.mockImplementationOnce(() => readBuilder).mockImplementationOnce(() => writeBuilder);

  await act(async () => {
    getCtx().setAlarms([{
      id: 'profile', hour: 7, minute: 15, days: [1], enabled: true, label: '',
      deviceSlot: 3, sunriseDuration: 45, finalBrightness: 90, soundId: 12, volume: 60,
    }]);
  });
  await flushFakeTimers();

  expect(writeBuilder.upsert).toHaveBeenCalledWith([
    expect.objectContaining({
      device_slot: 3,
      sunrise_duration: 45,
      final_brightness: 90,
      sound_id: 12,
      volume: 60,
    }),
  ], { onConflict: 'user_id,id' });
  jest.useRealTimers();
});
