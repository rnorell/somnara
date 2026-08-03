import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && publishableKey);

const secureStorage = {
  async getItem(key: string) {
    const safeKey = key.replace(/[^A-Za-z0-9._-]/g, '_');
    const rawCount = await SecureStore.getItemAsync(`${safeKey}.count`);
    if (!rawCount) return null;
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 64) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${safeKey}.${index}`))
    );
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    const safeKey = key.replace(/[^A-Za-z0-9._-]/g, '_');
    const previousCount = Number(await SecureStore.getItemAsync(`${safeKey}.count`) ?? 0);
    const chunks = value.match(/[\s\S]{1,1800}/g) ?? [''];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${safeKey}.${index}`, chunk, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })));
    await SecureStore.setItemAsync(`${safeKey}.count`, String(chunks.length), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    for (let index = chunks.length; index < previousCount; index += 1) {
      await SecureStore.deleteItemAsync(`${safeKey}.${index}`);
    }
  },
  async removeItem(key: string) {
    const safeKey = key.replace(/[^A-Za-z0-9._-]/g, '_');
    const count = Number(await SecureStore.getItemAsync(`${safeKey}.count`) ?? 0);
    await Promise.all(Array.from({ length: Math.min(Math.max(count, 0), 64) }, (_, index) =>
      SecureStore.deleteItemAsync(`${safeKey}.${index}`)
    ));
    await SecureStore.deleteItemAsync(`${safeKey}.count`);
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
