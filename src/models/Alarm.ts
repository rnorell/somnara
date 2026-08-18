export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  label: string;
  /** Device slot 0-9 after the alarm is committed to the product. */
  deviceSlot?: number;
  sunriseDuration?: 15 | 30 | 45;
  finalBrightness?: number;
  soundId?: number;
  volume?: number;
  skipNext?: boolean;
}
