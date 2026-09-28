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

// Audio Control 0x09 and Set Volume 0x08 — Commands tab of the manufacturer
// protocol workbook, accepted by reference in the 2026-09-01 v1.0 reply.
// The device answers with ACK 0x7F, then a 0x13 status report.
export const SET_VOLUME_OPCODE = 0x08;
export const SET_VOLUME_FRAME_LENGTH = 6;
export const AUDIO_CONTROL_OPCODE = 0x09;
export const AUDIO_CONTROL_FRAME_LENGTH = 8;

export const AUDIO_ACTIONS = { stop: 0, preview: 1 } as const;
export type AudioAction = keyof typeof AUDIO_ACTIONS;

export interface AudioControlFrameInput {
  readonly sequence: number;
  readonly action: AudioAction;
  readonly soundId: number;
  readonly volumePercent: number;
}

export function createAudioControlFrame(input: AudioControlFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.soundId, 0, 25, 'Sound ID');
  assertIntegerInRange(input.volumePercent, 0, 100, 'Volume');

  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    AUDIO_CONTROL_FRAME_LENGTH,
    input.sequence,
    AUDIO_CONTROL_OPCODE,
    AUDIO_ACTIONS[input.action],
    input.soundId,
    input.volumePercent,
    0,
  ]);
  frame[7] = sum8(frame.slice(0, 7));
  return frame;
}

export interface SetVolumeFrameInput {
  readonly sequence: number;
  readonly volumePercent: number;
}

export function createSetVolumeFrame(input: SetVolumeFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.volumePercent, 0, 100, 'Volume');

  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SET_VOLUME_FRAME_LENGTH,
    input.sequence,
    SET_VOLUME_OPCODE,
    input.volumePercent,
    0,
  ]);
  frame[5] = sum8(frame.slice(0, 5));
  return frame;
}
