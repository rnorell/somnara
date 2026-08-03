import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alarm } from '../models/Alarm';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';

export interface Preferences {
  sunriseDuration: 15 | 30 | 45;
  timezone: string;
}

const DEFAULT_ALARMS: Alarm[] = [
  { id: '1', hour: 6, minute: 30, days: [1, 2, 3, 4, 5], enabled: true, label: 'Sunrise alarm' },
];

const DEFAULT_PREFERENCES: Preferences = {
  sunriseDuration: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

interface SyncContextValue {
  alarms: Alarm[];
  setAlarms: (alarms: Alarm[]) => void;
  preferences: Preferences;
  setPreferences: (patch: Partial<Preferences>) => void;
  deviceName: string;
  setDeviceName: (name: string) => void;
  isLoading: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider');
  return ctx;
}

interface Props {
  userId: string;
  children: React.ReactNode;
}

export function SyncProvider({ userId, children }: Props) {
  const [alarms, setAlarmsState] = useState<Alarm[]>(DEFAULT_ALARMS);
  const [preferences, setPreferencesState] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [deviceName, setDeviceNameState] = useState('My Somnara');
  const [isLoading, setIsLoading] = useState(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Load on mount — AsyncStorage first, then Supabase if available
  useEffect(() => {
    async function load() {
      try {
        const [savedAlarms, savedPrefs, savedName] = await Promise.all([
          storage.loadAlarms(userIdRef.current),
          storage.loadPreferences(userIdRef.current),
          storage.loadDeviceName(userIdRef.current),
        ]);
        if (savedAlarms) setAlarmsState(savedAlarms);
        if (savedPrefs) setPreferencesState(savedPrefs);
        if (savedName) setDeviceNameState(savedName);
      } catch (e) {
        // AsyncStorage unavailable — continue with defaults
      }

      // Pull from Supabase if configured (authoritative, may overwrite local)
      if (supabase) {
        await pullFromSupabase();
      }

      setIsLoading(false);
    }
    load();
  }, []);

  async function pullFromSupabase() {
    if (!supabase) return;
    const uid = userIdRef.current;
    const [{ data: alarmsData }, { data: prefsData }] = await Promise.all([
      supabase.from('alarms').select('*').eq('user_id', uid),
      supabase.from('preferences').select('*').eq('user_id', uid).single(),
    ]);
    if (alarmsData && alarmsData.length > 0) {
      const mapped: Alarm[] = alarmsData.map((r: any) => ({
        id: r.id,
        hour: r.hour,
        minute: r.minute,
        days: r.days,
        enabled: r.enabled,
        label: r.label ?? '',
      }));
      setAlarmsState(mapped);
      void storage.saveAlarms(uid, mapped);
    }
    if (prefsData) {
      const prefs: Preferences = {
        sunriseDuration: prefsData.sunrise_duration,
        timezone: prefsData.timezone,
      };
      setPreferencesState(prefs);
      void storage.savePreferences(uid, prefs);
    }
  }

  const setAlarms = useCallback((next: Alarm[]) => {
    setAlarmsState(next);
    void storage.saveAlarms(userIdRef.current, next);
    if (supabase) pushAlarmsToSupabase(userIdRef.current, next);
  }, []);

  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferencesState(prev => {
      const next = { ...prev, ...patch };
      void storage.savePreferences(userIdRef.current, next);
      if (supabase) pushPrefsToSupabase(userIdRef.current, next);
      return next;
    });
  }, []);

  const setDeviceName = useCallback((name: string) => {
    setDeviceNameState(name);
    void storage.saveDeviceName(userIdRef.current, name);
    if (supabase) {
      supabase.from('paired_devices')
        .update({ name })
        .eq('user_id', userIdRef.current)
        .then(() => {});
    }
  }, []);

  return (
    <SyncContext.Provider value={{
      alarms, setAlarms,
      preferences, setPreferences,
      deviceName, setDeviceName,
      isLoading,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

async function pushAlarmsToSupabase(userId: string, alarms: Alarm[]) {
  if (!supabase) return;
  const { data: existing } = await supabase
    .from('alarms')
    .select('id')
    .eq('user_id', userId);
  const rows = alarms.map(a => ({
    id: a.id,
    user_id: userId,
    hour: a.hour,
    minute: a.minute,
    days: a.days,
    enabled: a.enabled,
    label: a.label,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    await supabase.from('alarms').upsert(rows, { onConflict: 'user_id,id' });
  }
  const nextIds = new Set(alarms.map(a => a.id));
  const removedIds = (existing ?? []).map(row => row.id).filter(id => !nextIds.has(id));
  if (removedIds.length > 0) {
    await supabase.from('alarms').delete().eq('user_id', userId).in('id', removedIds);
  }
}

async function pushPrefsToSupabase(userId: string, prefs: Preferences) {
  if (!supabase) return;
  await supabase.from('preferences').upsert({
    user_id: userId,
    sunrise_duration: prefs.sunriseDuration,
    timezone: prefs.timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}
