import { useState } from 'react';
import { DeviceStatus } from '../models/Device';
import { DeviceStatusReport } from '../ble/UplinkFrame';

export const initialDeviceStatus: DeviceStatus = {
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
  ota: {
    state: 'idle',
    progress: 0,
    errorCode: null,
    selectedFileName: null,
    selectedFileUri: null,
    selectedFileSha256: null,
    sdkVersion: null,
    targetIdentity: null,
    startedAt: null,
    finishedAt: null,
    lastRecoverableError: null,
    finalFirmwareVersion: null,
  },
};

export function applyBleStatusReport(current: DeviceStatus, report: DeviceStatusReport): DeviceStatus {
  return {
    ...current,
    isConnected: true,
    isOn: report.power,
    brightness: report.brightnessPercent,
    volume: report.volumePercent,
    activeSoundId: report.soundId,
    playbackState: 'unknown',
    clockValidity: report.clockValid ? 'valid' : 'invalid',
    storedAlarmCount: report.alarmCount,
    firmwareVersion: `${report.firmwareMajor}.${report.firmwareMinor}.${report.firmwarePatch}+${report.firmwareBuild}`,
    hardwareVersion: String(report.hardwareRevision),
  };
}

export function useDeviceStore() {
  const [device, setDevice] = useState<DeviceStatus>(initialDeviceStatus);

  const connect = () => setDevice(d => ({ ...d, isConnected: true, isOn: true }));
  const disconnect = () => setDevice(d => ({ ...d, isConnected: false, isOn: false }));
  const togglePower = () => setDevice(d => ({ ...d, isOn: !d.isOn }));
  const reportClockInvalid = () => setDevice(d => ({ ...d, clockValidity: 'invalid' }));
  const reportClockSynchronized = () => setDevice(d => ({ ...d, clockValidity: 'valid' }));
  const applyBleStatus = (report: DeviceStatusReport) => setDevice(d => applyBleStatusReport(d, report));

  return { device, connect, disconnect, togglePower, reportClockInvalid, reportClockSynchronized, applyBleStatus, setDevice };
}
