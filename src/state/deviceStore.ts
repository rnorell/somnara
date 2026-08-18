import { useState } from 'react';
import { DeviceStatus } from '../models/Device';

const initialState: DeviceStatus = {
  isConnected: false,
  isOn: false,
  mode: 'sunrise',
  brightness: 80,
  alarmTime: '07:00',
  volume: 50,
  activeSoundId: 0,
  playbackState: 'unknown',
  clockValidity: 'unknown',
  storedAlarmCount: 0,
  firmwareVersion: null,
  hardwareVersion: null,
  ota: { state: 'idle', progress: 0, errorCode: null },
};

export function useDeviceStore() {
  const [device, setDevice] = useState<DeviceStatus>(initialState);

  const connect = () => setDevice(d => ({ ...d, isConnected: true, isOn: true }));
  const disconnect = () => setDevice(d => ({ ...d, isConnected: false, isOn: false }));
  const togglePower = () => setDevice(d => ({ ...d, isOn: !d.isOn }));
  const reportClockInvalid = () => setDevice(d => ({ ...d, clockValidity: 'invalid' }));
  const reportClockSynchronized = () => setDevice(d => ({ ...d, clockValidity: 'valid' }));

  return { device, connect, disconnect, togglePower, reportClockInvalid, reportClockSynchronized, setDevice };
}
