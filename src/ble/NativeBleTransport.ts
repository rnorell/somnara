import { Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { requestBluetoothPermissions } from './requestBluetoothPermissions';
import { waitForBluetooth } from './waitForBluetooth';
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
  private cancelScan: (() => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    return requestBluetoothPermissions();
  }

  async scan(timeoutMs = 10_000): Promise<BleDeviceCandidate> {
    this.assertActive();
    await waitForBluetooth(this.manager);
    this.assertActive();

    return new Promise((resolve, reject) => {
      let settled = false;
      let stateSubscription: Subscription | undefined;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.cancelScan = null;
        this.manager.stopDeviceScan().catch(() => undefined);
        stateSubscription?.remove();
        action();
      };
      this.cancelScan?.();
      this.cancelScan = () => finish(() => reject(new BleTransportError('operation_cancelled', 'Bluetooth scan cancelled.')));
      const timeout = setTimeout(() => {
        finish(() => reject(new BleTransportError('scan_timeout', 'No Somnara was found. Keep it powered and nearby. On Android 11 or earlier, also turn on Location.')));
      }, timeoutMs);
      stateSubscription = this.manager.onStateChange(nextState => {
        if (nextState === State.PoweredOff || nextState === State.Unauthorized) {
          const denied = nextState === State.Unauthorized;
          finish(() => reject(new BleTransportError(denied ? 'permission_required' : 'bluetooth_off', denied ? 'Bluetooth permission is required.' : 'Bluetooth was turned off.')));
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
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false, timeout: 15_000 });
      if (this.destroyed) {
        await device.cancelConnection().catch(() => undefined);
        this.assertActive();
      }
      this.connectedDevice = device;
      this.connectedDevice = await device.discoverAllServicesAndCharacteristics();
    } catch (error) {
      throw new BleTransportError(
        'connection_failed',
        error instanceof Error ? error.message : 'Could not connect to Somnara.',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.cancelScan?.();
    this.notification?.remove();
    this.notification = null;
    const deviceId = this.connectedDevice?.id;
    this.connectedDevice = null;
    if (deviceId) await this.manager.cancelDeviceConnection(deviceId).catch(() => undefined);
  }

  async negotiateMtu(minimumMtu: number): Promise<number | null> {
    const device = this.requireConnectedDevice();
    if (Platform.OS !== 'android') return null;
    try {
      const updatedDevice = await device.requestMTU(minimumMtu);
      if (updatedDevice.mtu < minimumMtu) {
        throw new BleTransportError(
          'mtu_negotiation_failed',
          `Somnara requires an MTU of at least ${minimumMtu} bytes. Android supplied ${updatedDevice.mtu}.`,
        );
      }
      this.connectedDevice = updatedDevice;
      return updatedDevice.mtu;
    } catch (error) {
      if (error instanceof BleTransportError) throw error;
      throw new BleTransportError(
        'mtu_negotiation_failed',
        error instanceof Error ? `Could not prepare the BLE packet size: ${error.message}` : 'Could not prepare the BLE packet size.',
      );
    }
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
    this.destroyed = true;
    await this.disconnect();
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
