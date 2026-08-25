export const SOMNARA_SERVICE_UUID = '0000AE30-0000-1000-8000-00805F9B34FB';
export const SOMNARA_WRITE_UUID = '0000AE01-0000-1000-8000-00805F9B34FB';
export const SOMNARA_NOTIFY_UUID = '0000AE02-0000-1000-8000-00805F9B34FB';

export type BleConnectionState =
  | 'idle'
  | 'permission_required'
  | 'scanning'
  | 'connecting'
  | 'connected_unverified'
  | 'ready'
  | 'disconnected'
  | 'failed';

export type BleTransportErrorCode =
  | 'permission_required'
  | 'bluetooth_off'
  | 'scan_timeout'
  | 'connection_failed'
  | 'mtu_negotiation_failed'
  | 'operation_cancelled'
  | 'unknown';

export interface BleDeviceCandidate {
  id: string;
  name: string | null;
}

export interface BleTransport {
  readonly kind: 'native' | 'mock';
  requestPermissions(): Promise<boolean>;
  scan(timeoutMs?: number): Promise<BleDeviceCandidate>;
  connect(deviceId: string): Promise<void>;
  negotiateMtu(minimumMtu: number): Promise<number | null>;
  disconnect(): Promise<void>;
  subscribe(onData: (bytes: Uint8Array) => void, onError: (error: Error) => void): () => void;
  writeRaw(bytes: Uint8Array): Promise<void>;
  destroy(): Promise<void>;
}

export class BleTransportError extends Error {
  constructor(public readonly code: BleTransportErrorCode, message: string) {
    super(message);
    this.name = 'BleTransportError';
  }
}
