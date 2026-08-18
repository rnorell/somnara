export const MAX_DEVICE_ALARMS = 10;
export const MAX_SOUND_ID = 25;

export type SoundId = number;
export type PercentValue = number;

export interface DeviceAlarmProfile {
  slot: number;
  sunriseDuration: 15 | 30 | 45;
  finalBrightness: PercentValue;
  soundId: SoundId;
  volume: PercentValue;
}

export interface ConnectionSyncStep {
  id: 'secure' | 'clock' | 'status' | 'alarms' | 'reconcile';
  required: true;
}

export const CONNECTION_SYNC_SEQUENCE: readonly ConnectionSyncStep[] = [
  { id: 'secure', required: true },
  { id: 'clock', required: true },
  { id: 'status', required: true },
  { id: 'alarms', required: true },
  { id: 'reconcile', required: true },
];

export function assertPercent(value: number): PercentValue {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError('Percentage must be an integer from 0 to 100.');
  }
  return value;
}

export function assertSoundId(value: number): SoundId {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SOUND_ID) {
    throw new RangeError('Sound ID must be an integer from 0 to 25.');
  }
  return value;
}

export function brightnessToInverseRaw(percent: number): number {
  return Math.round(255 - assertPercent(percent) * 255 / 100);
}

export function validateDeviceAlarmProfile(profile: DeviceAlarmProfile): DeviceAlarmProfile {
  if (!Number.isInteger(profile.slot) || profile.slot < 0 || profile.slot >= MAX_DEVICE_ALARMS) {
    throw new RangeError('Alarm slot must be an integer from 0 to 9.');
  }
  assertPercent(profile.finalBrightness);
  assertPercent(profile.volume);
  assertSoundId(profile.soundId);
  return profile;
}
