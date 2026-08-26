import { ACK_FRAME_HEADER, sum8 } from './AckFrame';

export const SKIP_NEXT_ALARM_OPCODE = 0x1C;
export const SKIP_NEXT_ALARM_FRAME_LENGTH = 7;

export interface SkipNextAlarmFrameInput {
  readonly sequence: number;
  readonly alarmIndex: number;
  readonly skip: boolean;
}

function assertIntegerInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${field} must be an integer from ${min} to ${max}.`);
  }
}

export function createSkipNextAlarmFrame(input: SkipNextAlarmFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.alarmIndex, 0, 9, 'Alarm index');

  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SKIP_NEXT_ALARM_FRAME_LENGTH,
    input.sequence,
    SKIP_NEXT_ALARM_OPCODE,
    input.alarmIndex,
    input.skip ? 1 : 0,
    0,
  ]);
  frame[6] = sum8(frame.slice(0, 6));
  return frame;
}
