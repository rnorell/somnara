import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../models/Alarm';
import { Preferences } from '../context/SyncContext';

const KEY = {
  ALARMS: '@somnara/alarms',
  PREFERENCES: '@somnara/preferences',
  DEVICE_NAME: '@somnara/device_name',
} as const;

export const storage = {
  async loadAlarms(): Promise<Alarm[] | null> {
    const raw = await AsyncStorage.getItem(KEY.ALARMS);
    return raw ? JSON.parse(raw) : null;
  },
  async saveAlarms(alarms: Alarm[]): Promise<void> {
    await AsyncStorage.setItem(KEY.ALARMS, JSON.stringify(alarms));
  },

  async loadPreferences(): Promise<Preferences | null> {
    const raw = await AsyncStorage.getItem(KEY.PREFERENCES);
    return raw ? JSON.parse(raw) : null;
  },
  async savePreferences(prefs: Preferences): Promise<void> {
    await AsyncStorage.setItem(KEY.PREFERENCES, JSON.stringify(prefs));
  },

  async loadDeviceName(): Promise<string | null> {
    return AsyncStorage.getItem(KEY.DEVICE_NAME);
  },
  async saveDeviceName(name: string): Promise<void> {
    await AsyncStorage.setItem(KEY.DEVICE_NAME, name);
  },
};
