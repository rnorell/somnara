import { BleDeviceCandidate, BleTransport, BleTransportError } from './types';
import { ACK_RESULT_CODES, createAckFrame, sum8, UNSOLICITED_SEQUENCE } from './AckFrame';
import { AUDIO_CONTROL_OPCODE, SET_VOLUME_OPCODE } from './DownlinkFrame';
import { createManufacturerStatusFixture } from './manufacturerProtocolFixtures';

export interface MockBleTransportOptions {
  /** Answer writes with ACK + 0x13 status like the real device (dev demo mode). */
  readonly simulateDevice?: boolean;
}

export class MockBleTransport implements BleTransport {
  readonly kind = 'mock' as const;
  readonly candidate: BleDeviceCandidate = { id: 'mock-somnara-001', name: 'Somnara Development Device' };
  private connected = false;
  private destroyed = false;
  readonly writtenFrames: Uint8Array[] = [];
  negotiatedMtu = 247;
  private onData: ((bytes: Uint8Array) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private simulatedVolume = 30;
  private simulatedSoundId = 0;

  constructor(private readonly options: MockBleTransportOptions = {}) {}

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
    if (this.options.simulateDevice) this.later(() => this.simulatedStatus(UNSOLICITED_SEQUENCE));
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
    if (this.options.simulateDevice) this.simulateResponse(bytes);
  }

  private simulateResponse(frame: Uint8Array): void {
    const sequence = frame[2];
    const opcode = frame[3];
    let resultCode: number = ACK_RESULT_CODES.OK;
    if (opcode === AUDIO_CONTROL_OPCODE) {
      const [action, soundId, volume] = [frame[4], frame[5], frame[6]];
      this.simulatedSoundId = action === 1 ? soundId : 0;
      if (action === 1) this.simulatedVolume = volume;
    } else if (opcode === SET_VOLUME_OPCODE) {
      this.simulatedVolume = frame[4];
    } else {
      resultCode = ACK_RESULT_CODES.UNKNOWN_OPCODE;
    }
    this.later(() => {
      this.onData?.(createAckFrame({ sequence, requestOpcode: opcode, resultCode, detail: 0 }));
      if (resultCode === ACK_RESULT_CODES.OK) this.simulatedStatus(sequence);
    });
  }

  private simulatedStatus(sequence: number): void {
    const frame = createManufacturerStatusFixture(sequence);
    frame[17] = this.simulatedVolume;
    frame[18] = this.simulatedSoundId;
    frame[frame.length - 1] = sum8(frame.slice(0, -1));
    this.onData?.(frame);
  }

  private later(fn: () => void): void {
    setTimeout(() => { if (this.connected && !this.destroyed) fn(); }, 150);
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
