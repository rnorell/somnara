import { useState } from 'react';
import { DeviceStatus } from '../models/Device';

const initialState: DeviceStatus = {
  isConnected: false,
  isOn: false,
  mode: 'sunrise',
  brightness: 80,
  alarmTime: '07:00',
};

export function useDeviceStore() {
  const [device, setDevice] = useState<DeviceStatus>(initialState);

  const connect = () => setDevice(d => ({ ...d, isConnected: true, isOn: true }));
  const disconnect = () => setDevice(d => ({ ...d, isConnected: false, isOn: false }));
  const togglePower = () => setDevice(d => ({ ...d, isOn: !d.isOn }));

  return { device, connect, disconnect, togglePower, setDevice };
}