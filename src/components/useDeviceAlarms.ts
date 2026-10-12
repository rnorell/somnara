import { useCallback, useEffect, useRef, useState } from 'react';
import { Alarm } from '../models/Alarm';
import { useSharedBleConnection } from '../context/BleContext';
import { useSyncContext } from '../context/SyncContext';
import { deviceAlarmWrite, mergeReadAlarms, nextDeviceSlot, replaceStoredAlarm } from '../ble/deviceAlarm';
import { AlarmListReport } from '../ble/UplinkFrame';

export function useDeviceAlarms() {
  const {
    state, commandPending, deviceStatus, deviceAlarmList, upsertDeviceAlarm, deleteDeviceAlarm, skipDeviceAlarm,
  } = useSharedBleConnection();
  const { alarms, setAlarms, preferences } = useSyncContext();
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;
  const [error, setError] = useState<string | null>(null);
  const ready = state === 'ready';
  const volume = deviceStatus.volume ?? 30;

  const remember = useCallback((next: Alarm[]) => {
    alarmsRef.current = next;
    setAlarms(next);
  }, [setAlarms]);

  const rememberRead = useCallback((local: readonly Alarm[], list: AlarmListReport | null) => {
    remember(list ? mergeReadAlarms(local, list) : [...local]);
  }, [remember]);

  const send = useCallback(async (alarm: Alarm) => {
    const current = alarmsRef.current;
    if (!ready) {
      remember(replaceStoredAlarm(current, alarm));
      return;
    }
    const slot = alarm.deviceSlot ?? nextDeviceSlot(current, alarm.id);
    if (slot == null) throw new RangeError('Somnara can store 10 alarms.');
    const stored = { ...alarm, deviceSlot: slot };
    const list = await upsertDeviceAlarm(deviceAlarmWrite(stored, slot, preferences.sunriseDuration, volume));
    rememberRead(replaceStoredAlarm(current, stored), list);
  }, [preferences.sunriseDuration, ready, remember, rememberRead, upsertDeviceAlarm, volume]);

  const save = useCallback(async (alarm: Alarm) => {
    setError(null);
    try {
      await send(alarm);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Somnara could not save that alarm.');
    }
  }, [send]);

  const toggle = useCallback((alarm: Alarm) => {
    void save({ ...alarm, enabled: !alarm.enabled });
  }, [save]);

  const remove = useCallback(async (alarm: Alarm) => {
    setError(null);
    const remaining = alarmsRef.current.filter(item => item.id !== alarm.id);
    try {
      if (ready && alarm.deviceSlot != null) {
        rememberRead(remaining, await deleteDeviceAlarm(alarm.deviceSlot));
        return;
      }
      remember(remaining);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Somnara could not delete that alarm.');
    }
  }, [deleteDeviceAlarm, ready, remember, rememberRead]);

  const skip = useCallback(async (alarm: Alarm) => {
    setError(null);
    try {
      if (!ready) {
        remember(alarmsRef.current.map(item => item.id === alarm.id ? { ...item, skipNext: !item.skipNext } : item));
        return;
      }
      let slot = alarm.deviceSlot ?? null;
      if (slot == null) {
        await send(alarm);
        slot = alarmsRef.current.find(item => item.id === alarm.id)?.deviceSlot ?? null;
      }
      if (slot == null) return;
      const nextSkip = !alarm.skipNext;
      const list = await skipDeviceAlarm(slot, nextSkip);
      rememberRead(alarmsRef.current.map(item => item.id === alarm.id ? { ...item, deviceSlot: slot, skipNext: nextSkip } : item), list);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Somnara could not skip that alarm.');
    }
  }, [ready, remember, rememberRead, send, skipDeviceAlarm]);

  useEffect(() => {
    if (!deviceAlarmList) return;
    remember(mergeReadAlarms(alarmsRef.current, deviceAlarmList));
  }, [deviceAlarmList, remember]);

  return { ready, busy: commandPending, error, save, toggle, remove, skip };
}
