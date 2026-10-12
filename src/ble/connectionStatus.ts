import { BleConnectionState, BleTransportErrorCode } from './types';

export function connectionStatusLabel(
  state: BleConnectionState,
  failureCode: BleTransportErrorCode | null,
  hasDeviceChoices: boolean,
): string {
  if (state === 'permission_required' || failureCode === 'permission_required') return 'Permission needed';
  if (state === 'bluetooth_off' || failureCode === 'bluetooth_off') return 'Bluetooth is off';
  if (failureCode === 'scan_timeout') return 'No device found';
  switch (state) {
    case 'ready': return 'Connected';
    case 'scanning': return 'Looking for Somnara…';
    case 'connecting': return 'Connecting…';
    case 'connected_unverified': return 'Waiting for device status…';
    case 'failed': return "Couldn't connect";
    default: return hasDeviceChoices ? 'Choose a device' : 'Disconnected';
  }
}
