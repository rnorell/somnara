export const ACK_FRAME_HEADER = 0xFF;
export const ACK_FRAME_LENGTH = 8;
export const ACK_FRAME_OPCODE = 0x7F;
export const UNSOLICITED_SEQUENCE = 0xFF;

export const ACK_RESULT_CODES = {
  OK: 0,
  INVALID_LENGTH: 1,
  INVALID_CHECKSUM: 2,
  UNKNOWN_OPCODE: 3,
  INVALID_VALUE: 4,
  NOT_BONDED: 5,
  BUSY: 6,
  CLOCK_INVALID: 7,
  ALARM_LIMIT: 8,
  AUDIO_NOT_FOUND: 9,
  SYNC_CONFLICT: 10,
  OTA_INVALID_IMAGE: 11,
  OTA_WRONG_HARDWARE: 12,
  INTERNAL_ERROR: 13,
} as const;

export type AckErrorCode = typeof ACK_RESULT_CODES[keyof typeof ACK_RESULT_CODES];
export type AckResultName = keyof typeof ACK_RESULT_CODES;

export interface AckResult {
  readonly sequence: number;
  readonly requestOpcode: number;
  readonly resultCode: AckErrorCode;
  readonly resultName: AckResultName;
  readonly detail: number;
  readonly ok: boolean;
}

export type BleProtocolErrorCode =
  | 'invalid_frame_length'
  | 'invalid_header'
  | 'invalid_ack_length'
  | 'unsolicited_ack'
  | 'invalid_ack_opcode'
  | 'invalid_checksum'
  | 'unknown_result_code'
  | 'unmatched_ack'
  | 'command_timeout'
  | 'command_in_flight'
  | 'invalid_request_frame'
  | 'invalid_notification_opcode'
  | 'invalid_status_length'
  | 'invalid_status_value'
  | 'invalid_alarm_list_length'
  | 'invalid_alarm_list_checksum'
  | 'invalid_alarm_list_value';

export class BleProtocolError extends Error {
  constructor(public readonly code: BleProtocolErrorCode, message: string) {
    super(message);
    this.name = 'BleProtocolError';
  }
}

const resultNames = new Map<number, AckResultName>(
  Object.entries(ACK_RESULT_CODES).map(([name, code]) => [code, name as AckResultName]),
);

function assertByte(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xFF) {
    throw new RangeError(`${name} must be an integer from 0 to 255.`);
  }
}

export function sum8(bytes: Uint8Array): number {
  return bytes.reduce((sum, byte) => (sum + byte) & 0xFF, 0);
}

export interface AckFrameInput {
  readonly sequence: number;
  readonly requestOpcode: number;
  readonly resultCode: number;
  readonly detail: number;
}

export function createAckFrame(result: AckFrameInput): Uint8Array {
  assertByte(result.sequence, 'Sequence');
  assertByte(result.requestOpcode, 'Request opcode');
  assertByte(result.resultCode, 'Result code');
  assertByte(result.detail, 'Detail');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    ACK_FRAME_LENGTH,
    result.sequence,
    ACK_FRAME_OPCODE,
    result.requestOpcode,
    result.resultCode,
    result.detail,
    0,
  ]);
  frame[7] = sum8(frame.slice(0, 7));
  return frame;
}

export function parseAckFrame(frame: Uint8Array): AckResult {
  if (frame.length !== ACK_FRAME_LENGTH) {
    throw new BleProtocolError('invalid_frame_length', 'ACK frame must contain exactly 8 bytes.');
  }
  if (frame[0] !== ACK_FRAME_HEADER) {
    throw new BleProtocolError('invalid_header', 'ACK frame has an invalid header.');
  }
  if (frame[1] !== ACK_FRAME_LENGTH) {
    throw new BleProtocolError('invalid_ack_length', 'ACK frame length byte must equal 8.');
  }
  if (frame[2] === UNSOLICITED_SEQUENCE) {
    throw new BleProtocolError('unsolicited_ack', 'An ACK frame cannot use the unsolicited sequence.');
  }
  if (frame[3] !== ACK_FRAME_OPCODE) {
    throw new BleProtocolError('invalid_ack_opcode', 'Frame is not an ACK or error response.');
  }
  if (sum8(frame.slice(0, 7)) !== frame[7]) {
    throw new BleProtocolError('invalid_checksum', 'ACK frame checksum is invalid.');
  }
  const resultName = resultNames.get(frame[5]);
  if (!resultName) {
    throw new BleProtocolError('unknown_result_code', 'ACK frame result code is not defined by the protocol.');
  }
  return {
    sequence: frame[2],
    requestOpcode: frame[4],
    resultCode: frame[5] as AckErrorCode,
    resultName,
    detail: frame[6],
    ok: frame[5] === ACK_RESULT_CODES.OK,
  };
}
