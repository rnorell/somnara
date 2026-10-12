import { Alarm } from '../models/Alarm';
import { AlarmListReport } from './UplinkFrame';

export const MAX_DEVICE_ALARMS = 10;
export const DEFAULT_ALARM_BRIGHTNESS = 80;

export interface DeviceAlarmWrite {
  readonly alarmIndex: number;
  readonly enabled: boolean;
  readonly skipNext: boolean;
  readonly hour: number;
  readonly minute: number;
  readonly weekdayMask: number;
  readonly sunriseMinutes: 15 | 30 | 45;
  readonly brightnessPercent: number;
  readonly soundId: number;
  readonly volumePercent: number;
}

/** App days are 0 Sunday through 6 Saturday. The protocol mask is bit 0 Monday through bit 6 Sunday. */
export function weekdayMaskFromDays(days: readonly number[]): number {
  let mask = 0;
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new RangeError('Day must be an integer from 0 to 6.');
    mask |= 1 << (day === 0 ? 6 : day - 1);
  }
  if (mask === 0) throw new RangeError('Weekday mask must include at least one day.');
  return mask;
}

export function daysFromWeekdayMask(mask: number): number[] {
  const days: number[] = [];
  for (let bit = 0; bit < 7; bit += 1) {
    if ((mask & (1 << bit)) !== 0) days.push(bit === 6 ? 0 : bit + 1);
  }
  return days.sort((left, right) => left - right);
}

export function nextDeviceSlot(alarms: readonly Alarm[], ignoreId?: string): number | null {
  const used = new Set(alarms.filter(alarm => alarm.id !== ignoreId && alarm.deviceSlot != null).map(alarm => alarm.deviceSlot));
  for (let slot = 0; slot < MAX_DEVICE_ALARMS; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

export function deviceAlarmWrite(
  alarm: Alarm,
  slot: number,
  sunriseFallback: 15 | 30 | 45,
  volumeFallback: number,
): DeviceAlarmWrite {
  return {
    alarmIndex: slot,
    enabled: alarm.enabled,
    skipNext: alarm.skipNext === true,
    hour: alarm.hour,
    minute: alarm.minute,
    weekdayMask: weekdayMaskFromDays(alarm.days),
    sunriseMinutes: alarm.sunriseDuration ?? sunriseFallback,
    brightnessPercent: alarm.finalBrightness ?? DEFAULT_ALARM_BRIGHTNESS,
    soundId: alarm.soundId ?? 0,
    volumePercent: alarm.volume ?? volumeFallback,
  };
}

export function replaceStoredAlarm(alarms: readonly Alarm[], alarm: Alarm): Alarm[] {
  if (!alarms.some(item => item.id === alarm.id) && alarms.length >= MAX_DEVICE_ALARMS) {
    throw new RangeError('Somnara can store 10 alarms.');
  }
  return alarms.some(item => item.id === alarm.id)
    ? alarms.map(item => item.id === alarm.id ? alarm : item)
    : [...alarms, alarm];
}

export function mergeReadAlarms(local: readonly Alarm[], report: AlarmListReport): Alarm[] {
  const bySlot = new Map(local.filter(alarm => alarm.deviceSlot != null).map(alarm => [alarm.deviceSlot, alarm]));
  const fromDevice = report.slots.filter(slot => slot.occupied).map(slot => {
    const existing = bySlot.get(slot.index);
    return {
      id: existing?.id ?? `device-${slot.index}`,
      label: existing?.label ?? '',
      deviceSlot: slot.index,
      hour: slot.hour ?? 0,
      minute: slot.minute ?? 0,
      days: daysFromWeekdayMask(slot.weekdayMask ?? 0),
      enabled: slot.enabled,
      skipNext: slot.skipNext,
      sunriseDuration: slot.sunriseMinutes,
      finalBrightness: slot.brightnessPercent,
      soundId: slot.soundId,
      volume: slot.volumePercent,
    } satisfies Alarm;
  });
  return [...fromDevice, ...local.filter(alarm => alarm.deviceSlot == null)];
}
