import { Alarm } from '../models/Alarm';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatTime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function daysLabel(days: number[]) {
  const sorted = [...days].sort().join(',');
  if (days.length === 7) return 'Every day';
  if (sorted === '1,2,3,4,5') return 'Weekdays';
  if (sorted === '0,6') return 'Weekends';
  return days.map(d => DAY_LABELS[d]).join('  ');
}

/** Minutes from `now` until the alarm's next occurrence, or null if it never fires. */
export function minutesUntil(alarm: Alarm, now = new Date()): number | null {
  if (alarm.days.length === 0) return null;
  const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  let best: number | null = null;
  for (const d of alarm.days) {
    let diff = d * 1440 + alarm.hour * 60 + alarm.minute - nowMin;
    if (diff <= 0) diff += 7 * 1440;
    if (best === null || diff < best) best = diff;
  }
  return best;
}

export function nextAlarm(alarms: Alarm[], now = new Date()): { alarm: Alarm; minutes: number } | null {
  let result: { alarm: Alarm; minutes: number } | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const minutes = minutesUntil(alarm, now);
    if (minutes !== null && (!result || minutes < result.minutes)) result = { alarm, minutes };
  }
  return result;
}

export function formatCountdown(minutes: number) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function alarmSubtitle(alarm: Alarm) {
  return alarm.label || (alarm.sunriseDuration ? `Sunrise alarm · ${alarm.sunriseDuration} min` : 'Sunrise alarm');
}
