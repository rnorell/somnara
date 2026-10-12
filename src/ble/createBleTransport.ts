import { BleManager, State } from 'react-native-ble-plx';
import { BleTransport, BleTransportError } from './types';
import { waitForBluetooth } from './waitForBluetooth';

async function preparePhoneRadio(): Promise<void> {
  const manager = new BleManager();
  try {
    await waitForBluetooth(manager);
  } finally {
    await manager.destroy();
  }
}

function watchPhoneRadio(onLost: (error: Error) => void): () => void {
  const manager = new BleManager();
  const subscription = manager.onStateChange(state => {
    if (state === State.PoweredOff) onLost(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'));
    else if (state === State.Unauthorized) onLost(new BleTransportError('permission_required', 'Allow Bluetooth access in Settings, then try again.'));
  }, true);
  return () => {
    subscription.remove();
    void manager.destroy();
  };
}

export function createBleTransport(): BleTransport {
  const useMock = __DEV__ && process.env.EXPO_PUBLIC_BLE_DRIVER === 'mock';
  if (useMock) {
    const { MockBleTransport } = require('./MockBleTransport') as typeof import('./MockBleTransport');
    return new MockBleTransport({ simulateDevice: true, prepareRadio: preparePhoneRadio, watchRadio: watchPhoneRadio });
  }
  const { NativeBleTransport } = require('./NativeBleTransport') as typeof import('./NativeBleTransport');
  return new NativeBleTransport();
}
