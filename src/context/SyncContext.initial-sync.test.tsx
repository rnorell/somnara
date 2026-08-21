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

it('loads the confirmed alarm profile from Supabase', async () => {
  const from = jest.fn()
    .mockImplementationOnce(() => chainable({
      data: [{
        id: 'profile', hour: 6, minute: 45, days: [1, 2, 3], enabled: true, label: 'Morning',
        device_slot: 1, sunrise_duration: 30, final_brightness: 75, sound_id: 8, volume: 50,
      }],
      error: null,
    }))
    .mockImplementationOnce(() => chainable(EMPTY_PREFS));
  setSupabase({ from });

  const { getCtx } = await renderSync();
  expect(getCtx().alarms[0]).toEqual(expect.objectContaining({
    deviceSlot: 1,
    sunriseDuration: 30,
    finalBrightness: 75,
    soundId: 8,
    volume: 50,
  }));
});
