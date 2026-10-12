import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alarm } from '../models/Alarm';
import { Preferences } from '../context/SyncContext';

function key(userId: string, item: 'alarms' | 'preferences' | 'device_name') {
  const safeUserId = userId.replace(/[^A-Za-z0-9-]/g, '');
  if (!safeUserId) throw new Error('A valid user id is required for local storage');
  return `@somnara/${safeUserId}/${item}`;
}

function optionalInteger(value: unknown, min: number, max: number): boolean {
  return value === undefined || value === null
    || (Number.isInteger(value) && (value as number) >= min && (value as number) <= max);
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
    && typeof alarm.label === 'string' && alarm.label.length <= 100
    && optionalInteger(alarm.deviceSlot, 0, 9)
    && (alarm.sunriseDuration === undefined || alarm.sunriseDuration === null || [15, 30, 45].includes(alarm.sunriseDuration))
    && optionalInteger(alarm.finalBrightness, 0, 100)
    && optionalInteger(alarm.soundId, 0, 25)
    && optionalInteger(alarm.volume, 0, 100)
    && (alarm.skipNext === undefined || typeof alarm.skipNext === 'boolean');
}

export interface SavedBleDevice {
  id: string;
  name: string;
}

const BLE_DEVICE_KEY = '@somnara/local/ble-device';

function isSavedBleDevice(value: unknown): value is SavedBleDevice {
  if (!value || typeof value !== 'object') return false;
  const device = value as SavedBleDevice;
  return typeof device.id === 'string' && device.id.length > 0 && device.id.length <= 80
    && typeof device.name === 'string' && device.name.length > 0 && device.name.length <= 60;
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

  async clear(userId: string): Promise<void> {
    await AsyncStorage.multiRemove([
      key(userId, 'alarms'),
      key(userId, 'preferences'),
      key(userId, 'device_name'),
    ]);
  },

  async loadBleDevice(): Promise<SavedBleDevice | null> {
    const raw = await AsyncStorage.getItem(BLE_DEVICE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedBleDevice(parsed) ? parsed : null;
  },
  async saveBleDevice(device: SavedBleDevice): Promise<void> {
    const saved: SavedBleDevice = { id: device.id.slice(0, 80), name: device.name.slice(0, 60) };
    if (!isSavedBleDevice(saved)) throw new Error('A Bluetooth device id and name are required');
    await AsyncStorage.setItem(BLE_DEVICE_KEY, JSON.stringify(saved));
  },
  async clearBleDevice(): Promise<void> {
    await AsyncStorage.removeItem(BLE_DEVICE_KEY);
  },
};
