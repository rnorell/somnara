export interface ClaimedDevice {
  id: string;
  serial: string;
  name: string;
  claimedAt: string;
  ownerId: string;
  ownerEmail: string;
}

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
  volume: number;
  activeSoundId: number;
  playbackState: 'stopped' | 'playing' | 'unknown';
  clockValidity: 'valid' | 'invalid' | 'unknown';
  storedAlarmCount: number;
  firmwareVersion: string | null;
  hardwareVersion: string | null;
  ota: {
    state: 'idle' | 'checking' | 'transferring' | 'verifying' | 'restarting' | 'complete' | 'failed';
    progress: number;
    errorCode: string | null;
  };
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
