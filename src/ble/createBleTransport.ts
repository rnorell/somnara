import { BleTransport } from './types';

export function createBleTransport(): BleTransport {
  const useMock = __DEV__ && process.env.EXPO_PUBLIC_BLE_DRIVER === 'mock';
  if (useMock) {
    const { MockBleTransport } = require('./MockBleTransport') as typeof import('./MockBleTransport');
    return new MockBleTransport();
  }
  const { NativeBleTransport } = require('./NativeBleTransport') as typeof import('./NativeBleTransport');
  return new NativeBleTransport();
}
