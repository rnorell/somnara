import { BleManager, State, Subscription } from 'react-native-ble-plx';
import { BleTransportError } from './types';

/** Unknown/Resetting are transient startup states, not evidence Bluetooth is off. */
export function waitForBluetooth(manager: Pick<BleManager, 'onStateChange'>, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let subscription: Subscription | undefined;
    let settled = false;
    const finish = (error?: BleTransportError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new BleTransportError('unknown', 'Bluetooth is still starting. Please try again.')), timeoutMs);
    try {
      subscription = manager.onStateChange(state => {
        if (state === State.PoweredOn) finish();
        else if (state === State.Unauthorized) finish(new BleTransportError('permission_required', 'Allow Bluetooth access in Settings, then try again.'));
        else if (state === State.PoweredOff) finish(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'));
        else if (state === State.Unsupported) finish(new BleTransportError('unknown', 'Bluetooth Low Energy is unavailable on this device.'));
      }, true);
      if (settled) subscription.remove();
    } catch (error) {
      finish(new BleTransportError('unknown', error instanceof Error ? error.message : 'Bluetooth is unavailable.'));
    }
  });
}
