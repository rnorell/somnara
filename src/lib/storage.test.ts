jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import { Alarm } from '../models/Alarm';
import { Preferences } from '../context/SyncContext';

const USER = 'user-1';

const VALID_ALARM: Alarm = {
  id: 'a1', hour: 7, minute: 30, days: [1, 2, 3], enabled: true, label: 'Wake up',
};

const VALID_PREFS: Preferences = { sunriseDuration: 30, timezone: 'UTC' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('storage', () => {
  it('round-trips valid alarms', async () => {
    await storage.saveAlarms(USER, [VALID_ALARM]);
    await expect(storage.loadAlarms(USER)).resolves.toEqual([VALID_ALARM]);
  });

  it('returns null for alarms when nothing is saved', async () => {
    await expect(storage.loadAlarms(USER)).resolves.toBeNull();
  });

  it('rejects malformed alarm data instead of returning it', async () => {
    await AsyncStorage.setItem('@somnara/user-1/alarms', JSON.stringify([{ id: 'bad', hour: 25 }]));
    await expect(storage.loadAlarms(USER)).resolves.toBeNull();
  });

  it('round-trips valid preferences', async () => {
    await storage.savePreferences(USER, VALID_PREFS);
    await expect(storage.loadPreferences(USER)).resolves.toEqual(VALID_PREFS);
  });

  it('rejects preferences with an invalid sunriseDuration', async () => {
    await AsyncStorage.setItem(
      '@somnara/user-1/preferences',
      JSON.stringify({ sunriseDuration: 99, timezone: 'UTC' }),
    );
    await expect(storage.loadPreferences(USER)).resolves.toBeNull();
  });

  it('round-trips device name, truncated to 60 chars on save', async () => {
    const longName = 'x'.repeat(100);
    await storage.saveDeviceName(USER, longName);
    await expect(storage.loadDeviceName(USER)).resolves.toBe('x'.repeat(60));
  });

  it('clear removes alarms, preferences, and device name for that user', async () => {
    await storage.saveAlarms(USER, [VALID_ALARM]);
    await storage.savePreferences(USER, VALID_PREFS);
    await storage.saveDeviceName(USER, 'My Somnara');
    await storage.clear(USER);
    await expect(storage.loadAlarms(USER)).resolves.toBeNull();
    await expect(storage.loadPreferences(USER)).resolves.toBeNull();
    await expect(storage.loadDeviceName(USER)).resolves.toBeNull();
  });

  it('namespaces keys per user id so different users never collide', async () => {
    await storage.saveAlarms('user-a', [VALID_ALARM]);
    await expect(storage.loadAlarms('user-b')).resolves.toBeNull();
  });

  it('throws for an empty/unsafe user id rather than writing to a shared key', async () => {
    await expect(storage.saveAlarms('', [VALID_ALARM])).rejects.toThrow();
  });
});
