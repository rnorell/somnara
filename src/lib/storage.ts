import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../models/Alarm';
import { Preferences } from '../context/SyncContext';

function key(userId: string, item: 'alarms' | 'preferences' | 'device_name') {
  const safeUserId = userId.replace(/[^A-Za-z0-9-]/g, '');
  if (!safeUserId) throw new Error('A valid user id is required for local storage');
  return `@somnara/${safeUserId}/${item}`;
}

function isAlarm(value: unknown): value is Alarm {
  if (!value || typeof value !== 'object') return false;
  const alarm = value as Alarm;
  return typeof alarm.id === 'string' && alarm.id.length > 0 && alarm.id.length <= 80
    && Number.isInteger(alarm.hour) && alarm.hour >= 0 && alarm.hour <= 23
    && Number.isInteger(alarm.minute) && alarm.minute >= 0 && alarm.minute <= 59
    && Array.isArray(alarm.days) && alarm.days.length > 0 && alarm.days.length <= 7
    && alarm.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    && typeof alarm.enabled === 'boolean'
    && typeof alarm.label === 'string' && alarm.label.length <= 100;
}

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false;
  const prefs = value as Preferences;
  return [15, 30, 45].includes(prefs.sunriseDuration)
    && typeof prefs.timezone === 'string'
    && prefs.timezone.length > 0
    && prefs.timezone.length <= 100;
}

export const storage = {
  async loadAlarms(userId: string): Promise<Alarm[] | null> {
    const raw = await AsyncStorage.getItem(key(userId, 'alarms'));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isAlarm) ? parsed : null;
  },
  async saveAlarms(userId: string, alarms: Alarm[]): Promise<void> {
    await AsyncStorage.setItem(key(userId, 'alarms'), JSON.stringify(alarms));
  },

  async loadPreferences(userId: string): Promise<Preferences | null> {
    const raw = await AsyncStorage.getItem(key(userId, 'preferences'));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPreferences(parsed) ? parsed : null;
  },
  async savePreferences(userId: string, prefs: Preferences): Promise<void> {
    await AsyncStorage.setItem(key(userId, 'preferences'), JSON.stringify(prefs));
  },

  async loadDeviceName(userId: string): Promise<string | null> {
    const name = await AsyncStorage.getItem(key(userId, 'device_name'));
    return name && name.length <= 60 ? name : null;
  },
  async saveDeviceName(userId: string, name: string): Promise<void> {
    await AsyncStorage.setItem(key(userId, 'device_name'), name.slice(0, 60));
  },
};
