import {
  ACK_RESULT_CODES,
  AckResult,
  BleProtocolError,
  parseAckFrame,
} from './AckFrame';

export interface PendingCommand {
  readonly sequence: number;
  readonly requestOpcode: number;
  readonly frame: Uint8Array;
  readonly attempts: number;
}

export type RetryRequirement = 'none' | 'automatic' | 'clock_sync' | 'alarm_readback';

export interface AckTransactionOptions {
  readonly timeoutMs?: number;
  readonly busyRetryDelayMs?: number;
  readonly onProtocolError?: (error: BleProtocolError) => void;
}

interface ActiveCommand {
  readonly sequence: number;
  readonly requestOpcode: number;
  readonly frame: Uint8Array;
  attempts: number;
  resolve: (result: AckResult) => void;
  reject: (error: BleProtocolError) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const MAX_AUTOMATIC_RETRIES: ReadonlySet<number> = new Set([
  ACK_RESULT_CODES.INVALID_CHECKSUM,
  ACK_RESULT_CODES.BUSY,
  ACK_RESULT_CODES.INTERNAL_ERROR,
]);

export function retryRequirement(resultCode: number): RetryRequirement {
  if (MAX_AUTOMATIC_RETRIES.has(resultCode)) return 'automatic';
  if (resultCode === ACK_RESULT_CODES.CLOCK_INVALID) return 'clock_sync';
  if (resultCode === ACK_RESULT_CODES.SYNC_CONFLICT) return 'alarm_readback';
  return 'none';
}

export class AckTransactionController {
  private readonly timeoutMs: number;
  private readonly busyRetryDelayMs: number;
  private nextSequence = 0;
  private active: ActiveCommand | null = null;

  constructor(
    private readonly writeRaw: (bytes: Uint8Array) => Promise<void>,
    private readonly options: AckTransactionOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.busyRetryDelayMs = options.busyRetryDelayMs ?? 250;
  }

  reserveSequence(): number {
    const sequence = this.nextSequence;
    this.nextSequence = (this.nextSequence + 1) % 0xFF;
    return sequence;
  }

  execute(requestOpcode: number, makeFrame: (sequence: number) => Uint8Array): Promise<AckResult> {
    if (this.active) {
      return Promise.reject(new BleProtocolError('command_in_flight', 'Only one BLE command can wait for an ACK.'));
    }
    const sequence = this.reserveSequence();
    const frame = makeFrame(sequence);
    this.assertRequestFrame(frame, sequence, requestOpcode);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.failActive('BLE command ACK timed out.'), this.timeoutMs);
      this.active = { sequence, requestOpcode, frame, attempts: 1, resolve, reject, timeout };
      void this.writeActiveFrame();
    });
  }

  handleNotification(bytes: Uint8Array): void {
    let result: AckResult;
    try {
      result = parseAckFrame(bytes);
    } catch (error) {
      this.reportProtocolError(error);
      return;
    }
    const active = this.active;
    if (!active || result.sequence !== active.sequence || result.requestOpcode !== active.requestOpcode) {
      this.reportProtocolError(new BleProtocolError('unmatched_ack', 'ACK does not match the pending command.'));
      return;
    }
    if (result.ok) {
      this.resolveActive(result);
      return;
    }
    if (retryRequirement(result.resultCode) === 'automatic' && active.attempts < 2) {
      active.attempts += 1;
      if (result.resultCode === ACK_RESULT_CODES.BUSY) {
        setTimeout(() => void this.writeActiveFrame(), this.busyRetryDelayMs);
      } else {
        void this.writeActiveFrame();
      }
      return;
    }
    this.resolveActive(result);
  }

  private assertRequestFrame(frame: Uint8Array, sequence: number, requestOpcode: number): void {
    if (frame.length < 4 || frame[2] !== sequence || frame[3] !== requestOpcode) {
      throw new BleProtocolError('invalid_request_frame', 'Request frame must contain the reserved sequence and request opcode.');
    }
  }

  private async writeActiveFrame(): Promise<void> {
    const active = this.active;
    if (!active) return;
    try {
      await this.writeRaw(active.frame);
    } catch (error) {
      this.failActive(error instanceof Error ? error.message : 'BLE command could not be written.');
    }
  }

  private resolveActive(result: AckResult): void {
    const active = this.active;
    if (!active) return;
    clearTimeout(active.timeout);
    this.active = null;
    active.resolve(result);
  }

  private failActive(message: string): void {
    const active = this.active;
    if (!active) return;
    clearTimeout(active.timeout);
    this.active = null;
    const error = new BleProtocolError('command_timeout', message);
    this.reportProtocolError(error);
    active.reject(error);
  }

  private reportProtocolError(error: unknown): void {
    if (error instanceof BleProtocolError) this.options.onProtocolError?.(error);
  }
}
