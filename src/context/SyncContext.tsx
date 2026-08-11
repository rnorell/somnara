import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alarm } from '../models/Alarm';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { classifyError } from '../lib/errors';

export interface Preferences {
  sunriseDuration: 15 | 30 | 45;
  timezone: string;
}

export type SyncStatus = 'loading' | 'local' | 'syncing' | 'synced' | 'offline' | 'failed';
type SyncKey = 'alarms' | 'preferences' | 'deviceName';

const DEFAULT_ALARMS: Alarm[] = [
  { id: '1', hour: 6, minute: 30, days: [1, 2, 3, 4, 5], enabled: true, label: 'Sunrise alarm' },
];

const DEFAULT_PREFERENCES: Preferences = {
  sunriseDuration: 30,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const SYNC_DEBOUNCE_MS = 400;

interface SyncContextValue {
  alarms: Alarm[];
  setAlarms: (alarms: Alarm[]) => void;
  preferences: Preferences;
  setPreferences: (patch: Partial<Preferences>) => void;
  deviceName: string;
  setDeviceName: (name: string) => void;
  isLoading: boolean;
  status: SyncStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  retry: () => void;
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
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Pending pushes waiting on the debounce window, keyed so rapid edits to
  // the same field collapse to just the latest value rather than piling up.
  const pendingRef = useRef<Map<SyncKey, () => Promise<void>>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whatever should run if the user taps "Retry" — the last failed push
  // batch, or the initial load, whichever most recently failed.
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);

  async function flushPending() {
    const entries = Array.from(pendingRef.current.entries());
    if (entries.length === 0) return;
    setStatus('syncing');
    const results = await Promise.allSettled(entries.map(([, job]) => job()));

    const failed: [SyncKey, PromiseRejectedResult][] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') failed.push([entries[i][0], r]);
    });

    if (failed.length === 0) {
      pendingRef.current.clear();
      retryFnRef.current = null;
      setLastError(null);
      setLastSyncedAt(new Date().toISOString());
      setStatus('synced');
      return;
    }

    // Keep only the ones that failed queued for retry; succeeded ones are done.
    const remaining = new Map<SyncKey, () => Promise<void>>();
    failed.forEach(([key]) => {
      const job = pendingRef.current.get(key);
      if (job) remaining.set(key, job);
    });
    pendingRef.current = remaining;

    const reason = failed[0][1].reason;
    const classified = classifyError(reason);
    setLastError(reason instanceof Error ? reason.message : 'Sync failed');
    setStatus(classified.kind === 'network' ? 'offline' : 'failed');
    retryFnRef.current = flushPending;
  }

  function scheduleSync(key: SyncKey, job: () => Promise<void>) {
    if (!supabase) return; // nothing to sync to — status stays 'local'
    pendingRef.current.set(key, job);
    setStatus('local');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void flushPending(); }, SYNC_DEBOUNCE_MS);
  }

  // Load on mount — AsyncStorage first, then Supabase if available
  useEffect(() => {
    let active = true;

    async function load() {
      setStatus('loading');
      try {
        const [savedAlarms, savedPrefs, savedName] = await Promise.all([
          storage.loadAlarms(userIdRef.current),
          storage.loadPreferences(userIdRef.current),
          storage.loadDeviceName(userIdRef.current),
        ]);
        if (!active) return;
        if (savedAlarms) setAlarmsState(savedAlarms);
        if (savedPrefs) setPreferencesState(savedPrefs);
        if (savedName) setDeviceNameState(savedName);
      } catch {
        // AsyncStorage unavailable — continue with defaults
      }

      if (!supabase) {
        if (active) setStatus('local');
        return;
      }

      try {
        await pullFromSupabase();
        if (!active) return;
        retryFnRef.current = null;
        setLastError(null);
        setLastSyncedAt(new Date().toISOString());
        setStatus('synced');
      } catch (e) {
        if (!active) return;
        setLastError(e instanceof Error ? e.message : 'Could not load your data');
        setStatus(classifyError(e).kind === 'network' ? 'offline' : 'failed');
        retryFnRef.current = load;
      }
    }

    async function pullFromSupabase() {
      if (!supabase) return;
      const uid = userIdRef.current;
      const [alarmsRes, prefsRes] = await Promise.all([
        supabase.from('alarms').select('*').eq('user_id', uid),
        supabase.from('preferences').select('*').eq('user_id', uid).single(),
      ]);
      if (alarmsRes.error) throw alarmsRes.error;
      // PGRST116 = no rows — fine for a brand new account, keep defaults.
      if (prefsRes.error && prefsRes.error.code !== 'PGRST116') throw prefsRes.error;

      if (!active) return;
      if (alarmsRes.data && alarmsRes.data.length > 0) {
        const mapped: Alarm[] = alarmsRes.data.map((r: any) => ({
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
      if (prefsRes.data) {
        const prefs: Preferences = {
          sunriseDuration: prefsRes.data.sunrise_duration,
          timezone: prefsRes.data.timezone,
        };
        setPreferencesState(prefs);
        void storage.savePreferences(uid, prefs);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  const setAlarms = useCallback((next: Alarm[]) => {
    setAlarmsState(next);
    void storage.saveAlarms(userIdRef.current, next);
    scheduleSync('alarms', () => pushAlarmsToSupabase(userIdRef.current, next));
  }, []);

  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferencesState(prev => {
      const next = { ...prev, ...patch };
      void storage.savePreferences(userIdRef.current, next);
      scheduleSync('preferences', () => pushPrefsToSupabase(userIdRef.current, next));
      return next;
    });
  }, []);

  const setDeviceName = useCallback((name: string) => {
    setDeviceNameState(name);
    void storage.saveDeviceName(userIdRef.current, name);
    scheduleSync('deviceName', () => pushDeviceNameToSupabase(userIdRef.current, name));
  }, []);

  const retry = useCallback(() => {
    if (retryFnRef.current) void retryFnRef.current();
  }, []);

  return (
    <SyncContext.Provider value={{
      alarms, setAlarms,
      preferences, setPreferences,
      deviceName, setDeviceName,
      isLoading: status === 'loading',
      status, lastError, lastSyncedAt, retry,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

async function pushAlarmsToSupabase(userId: string, alarms: Alarm[]) {
  if (!supabase) return;
  const { data: existing, error: readError } = await supabase
    .from('alarms')
    .select('id')
    .eq('user_id', userId);
  if (readError) throw readError;

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
    const { error } = await supabase.from('alarms').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  const nextIds = new Set(alarms.map(a => a.id));
  const removedIds = (existing ?? []).map(row => row.id).filter(id => !nextIds.has(id));
  if (removedIds.length > 0) {
    const { error } = await supabase.from('alarms').delete().eq('user_id', userId).in('id', removedIds);
    if (error) throw error;
  }
}

async function pushPrefsToSupabase(userId: string, prefs: Preferences) {
  if (!supabase) return;
  const { error } = await supabase.from('preferences').upsert({
    user_id: userId,
    sunrise_duration: prefs.sunriseDuration,
    timezone: prefs.timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function pushDeviceNameToSupabase(userId: string, name: string) {
  if (!supabase) return;
  const { error } = await supabase.from('paired_devices').update({ name }).eq('user_id', userId);
  if (error) throw error;
}
