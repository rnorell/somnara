export type DeviceMode =
  | 'sunrise'
  | 'sunset'
  | 'reading'
  | 'nightLight'
  | 'relax'
  | 'meditation'
  | 'windDown'
  | 'sleep';

export interface DeviceStatus {
  isConnected: boolean;
  isOn: boolean;
  mode: DeviceMode;
  brightness: number;
  alarmTime: string | null;
}

export const ModeLabels: Record<DeviceMode, string> = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  reading: 'Reading',
  nightLight: 'Night Light',
  relax: 'Relax',
  meditation: 'Meditation',
  windDown: 'Wind Down',
  sleep: 'Sleep',
};
