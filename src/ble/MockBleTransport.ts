import { BleDeviceCandidate, BleTransport, BleTransportError } from './types';

export class MockBleTransport implements BleTransport {
  readonly kind = 'mock' as const;
  readonly candidate: BleDeviceCandidate = { id: 'mock-somnara-001', name: 'Somnara Development Device' };
  private connected = false;
  private destroyed = false;
  readonly writtenFrames: Uint8Array[] = [];
  negotiatedMtu = 247;
  private onData: ((bytes: Uint8Array) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async scan(_timeoutMs?: number): Promise<BleDeviceCandidate> {
    this.assertActive();
    await Promise.resolve();
    return this.candidate;
  }

  async connect(deviceId: string): Promise<void> {
    this.assertActive();
    if (deviceId !== this.candidate.id) {
      throw new BleTransportError('connection_failed', 'The mock device was not found.');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async negotiateMtu(minimumMtu: number): Promise<number> {
    this.assertConnected();
    if (this.negotiatedMtu < minimumMtu) {
      throw new BleTransportError(
        'mtu_negotiation_failed',
        `Somnara requires an MTU of at least ${minimumMtu} bytes. The device supplied ${this.negotiatedMtu}.`,
      );
    }
    return this.negotiatedMtu;
  }

  subscribe(onData: (bytes: Uint8Array) => void, onError: (error: Error) => void): () => void {
    this.assertConnected();
    this.onData = onData;
    this.onError = onError;
    return () => {
      this.onData = null;
      this.onError = null;
    };
  }

  emitNotification(bytes: Uint8Array): void {
    this.assertConnected();
    this.onData?.(new Uint8Array(bytes));
  }

  emitError(error: Error): void {
    this.assertConnected();
    this.onError?.(error);
  }

  async writeRaw(bytes: Uint8Array): Promise<void> {
    this.assertConnected();
    this.writtenFrames.push(new Uint8Array(bytes));
  }

  async destroy(): Promise<void> {
    this.connected = false;
    this.destroyed = true;
  }

  private assertConnected(): void {
    this.assertActive();
    if (!this.connected) throw new BleTransportError('connection_failed', 'The mock device is not connected.');
  }

  private assertActive(): void {
    if (this.destroyed) throw new BleTransportError('operation_cancelled', 'The mock transport was closed.');
  }
}
