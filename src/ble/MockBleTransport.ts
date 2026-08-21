import { BleDeviceCandidate, BleTransport, BleTransportError } from './types';

export class MockBleTransport implements BleTransport {
  readonly kind = 'mock' as const;
  readonly candidate: BleDeviceCandidate = { id: 'mock-somnara-001', name: 'Somnara Development Device' };
  private connected = false;
  private destroyed = false;

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

  subscribe(_onData: (bytes: Uint8Array) => void, _onError: (error: Error) => void): () => void {
    this.assertConnected();
    return () => undefined;
  }

  async writeRaw(_bytes: Uint8Array): Promise<void> {
    this.assertConnected();
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
