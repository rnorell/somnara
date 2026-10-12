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
  readonly syncsClockOnConnect = true;
  private readonly manager = new BleManager();
  private connectedDevice: Device | null = null;
  private notification: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private radioSubscription: Subscription | null = null;
  private sessionError: ((error: Error) => void) | null = null;
  private queuedLoss: Error | null = null;
  private sessionOpen = false;
  private closing = false;
  private destroyed = false;
  private cancelScan: (() => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    return requestBluetoothPermissions();
  }

  async scan(timeoutMs = 10_000): Promise<BleDeviceCandidate> {
    const found = await this.collectDevices(timeoutMs, true);
    return found[0];
  }

  async discover(timeoutMs = 10_000): Promise<BleDeviceCandidate[]> {
    return this.collectDevices(timeoutMs, false);
  }

  private collectDevices(timeoutMs: number, stopAfterFirst: boolean): Promise<BleDeviceCandidate[]> {
    this.assertActive();
    return waitForBluetooth(this.manager).then(() => {
      this.assertActive();
      return new Promise((resolve, reject) => {
        const found: BleDeviceCandidate[] = [];
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
          if (found.length === 0) {
            finish(() => reject(new BleTransportError('scan_timeout', 'No Somnara was found. Keep it powered and nearby. On Android 11 or earlier, also turn on Location.')));
            return;
          }
          finish(() => resolve(found));
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
          if (!device || found.some(item => item.id === device.id)) return;
          found.push({ id: device.id, name: device.name ?? device.localName ?? null });
          if (stopAfterFirst) finish(() => resolve(found));
        }).catch(error => {
          finish(() => reject(new BleTransportError('unknown', error instanceof Error ? error.message : 'Bluetooth scan failed.')));
        });
      });
    });
  }

  async connect(deviceId: string): Promise<void> {
    this.assertActive();
    await waitForBluetooth(this.manager);
    this.assertActive();
    this.sessionOpen = true;
    this.watchRadio();
    try {
      const device = await this.manager.connectToDevice(deviceId, { autoConnect: false, timeout: 15_000 });
      if (this.destroyed || !this.sessionOpen) {
        await device.cancelConnection().catch(() => undefined);
        const loss = this.takeQueuedLoss();
        if (loss) throw loss;
        this.assertActive();
        throw new BleTransportError('connection_failed', 'Somnara disconnected. Move closer and try again.');
      }
      this.connectedDevice = await device.discoverAllServicesAndCharacteristics();
      this.watchDisconnect(this.connectedDevice);
      const loss = this.takeQueuedLoss();
      if (loss) throw loss;
    } catch (error) {
      const loss = this.takeQueuedLoss();
      this.endSession();
      if (loss) throw loss;
      if (error instanceof BleTransportError) throw error;
      throw new BleTransportError(
        'connection_failed',
        error instanceof Error ? error.message : 'Could not connect to Somnara.',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.cancelScan?.();
    const deviceId = this.connectedDevice?.id;
    this.endSession();
    if (deviceId) await this.manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    this.closing = false;
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
    const loss = this.takeQueuedLoss();
    if (loss) {
      this.endSession();
      onError(loss);
      return () => undefined;
    }
    const device = this.requireConnectedDevice();
    this.sessionError = onError;
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
      this.sessionError = null;
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

  private watchRadio(): void {
    this.radioSubscription?.remove();
    this.radioSubscription = this.manager.onStateChange(state => {
      if (state === State.PoweredOff) this.reportLinkLoss(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'));
      else if (state === State.Unauthorized) this.reportLinkLoss(new BleTransportError('permission_required', 'Allow Bluetooth access in Settings, then try again.'));
    }, false);
  }

  private watchDisconnect(device: Device): void {
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = device.onDisconnected(error => {
      if (!error || this.closing) return;
      this.reportLinkLoss(new BleTransportError('connection_failed', 'Somnara disconnected. Move closer and try again.'));
    });
  }

  private reportLinkLoss(error: Error): void {
    if (this.closing || this.destroyed || !this.sessionOpen) return;
    const notify = this.sessionError;
    const deviceId = this.connectedDevice?.id;
    this.endSession();
    if (deviceId) void this.manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    if (notify) notify(error);
    else this.queuedLoss = error;
  }

  private takeQueuedLoss(): Error | null {
    const error = this.queuedLoss;
    this.queuedLoss = null;
    return error;
  }

  private endSession(): void {
    this.sessionOpen = false;
    this.sessionError = null;
    this.queuedLoss = null;
    this.notification?.remove();
    this.notification = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    this.radioSubscription?.remove();
    this.radioSubscription = null;
    this.connectedDevice = null;
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
