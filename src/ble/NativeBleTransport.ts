import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { base64ToBytes, bytesToBase64 } from './base64';
import {
  BleDeviceCandidate,
  BleTransport,
  BleTransportError,
  SOMNARA_NOTIFY_UUID,
  SOMNARA_SERVICE_UUID,
  SOMNARA_WRITE_UUID,
} from './types';

export class NativeBleTransport implements BleTransport {
  readonly kind = 'native' as const;
  private readonly manager = new BleManager();
  private connectedDevice: Device | null = null;
  private notification: Subscription | null = null;
  private destroyed = false;

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    const apiLevel = typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);

    if (apiLevel < 23) return true;

    const permissions = apiLevel >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  }

  async scan(timeoutMs = 10_000): Promise<BleDeviceCandidate> {
    this.assertActive();
    const state = await this.manager.state();
    if (state === State.Unauthorized) {
      throw new BleTransportError('permission_required', 'Bluetooth permission is required.');
    }
    if (state !== State.PoweredOn) {
      throw new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.manager.stopDeviceScan().catch(() => undefined);
        stateSubscription.remove();
        action();
      };
      const timeout = setTimeout(() => {
        finish(() => reject(new BleTransportError('scan_timeout', 'No Somnara was found.')));
      }, timeoutMs);
      const stateSubscription = this.manager.onStateChange(nextState => {
        if (nextState === State.PoweredOff) {
          finish(() => reject(new BleTransportError('bluetooth_off', 'Bluetooth was turned off.')));
        }
      }, false);

      this.manager.startDeviceScan([SOMNARA_SERVICE_UUID], null, (error, device) => {
        if (error) {
          finish(() => reject(new BleTransportError('unknown', error.message)));
          return;
        }
        if (!device) return;
        finish(() => resolve({ id: device.id, name: device.name ?? device.localName ?? null }));
      }).catch(error => {
        finish(() => reject(new BleTransportError('unknown', error instanceof Error ? error.message : 'Bluetooth scan failed.')));
      });
    });
  }

  async connect(deviceId: string): Promise<void> {
    this.assertActive();
    try {
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false });
      this.connectedDevice = await device.discoverAllServicesAndCharacteristics();
    } catch (error) {
      throw new BleTransportError(
        'connection_failed',
        error instanceof Error ? error.message : 'Could not connect to Somnara.',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.notification?.remove();
    this.notification = null;
    const deviceId = this.connectedDevice?.id;
    this.connectedDevice = null;
    if (deviceId) await this.manager.cancelDeviceConnection(deviceId).catch(() => undefined);
  }

  subscribe(onData: (bytes: Uint8Array) => void, onError: (error: Error) => void): () => void {
    const device = this.requireConnectedDevice();
    this.notification?.remove();
    this.notification = device.monitorCharacteristicForService(
      SOMNARA_SERVICE_UUID,
      SOMNARA_NOTIFY_UUID,
      (error, characteristic) => {
        if (error) {
          onError(error);
          return;
        }
        if (characteristic?.value) onData(base64ToBytes(characteristic.value));
      },
    );
    return () => {
      this.notification?.remove();
      this.notification = null;
    };
  }

  async writeRaw(bytes: Uint8Array): Promise<void> {
    const device = this.requireConnectedDevice();
    await device.writeCharacteristicWithoutResponseForService(
      SOMNARA_SERVICE_UUID,
      SOMNARA_WRITE_UUID,
      bytesToBase64(bytes),
    );
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    await this.disconnect();
    this.destroyed = true;
    await this.manager.destroy();
  }

  private requireConnectedDevice(): Device {
    this.assertActive();
    if (!this.connectedDevice) {
      throw new BleTransportError('connection_failed', 'Somnara is not connected.');
    }
    return this.connectedDevice;
  }

  private assertActive(): void {
    if (this.destroyed) throw new BleTransportError('operation_cancelled', 'Bluetooth was closed.');
  }
}
