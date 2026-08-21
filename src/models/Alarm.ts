export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  label: string;
  /** Device slot 0-9 after the alarm is committed to the product. */
  deviceSlot?: number | null;
  sunriseDuration?: 15 | 30 | 45 | null;
  finalBrightness?: number | null;
  soundId?: number | null;
  volume?: number | null;
  skipNext?: boolean;
}
