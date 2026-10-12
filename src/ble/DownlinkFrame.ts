import { brightnessToInverseRaw } from '../models/BleProtocol';
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

// Power, brightness, colour, status, and clock — Somnara BLE Protocol v0.9
// Commands sheet. The device answers with ACK 0x7F, then a 0x13 status report.
export const SET_POWER_OPCODE = 0x05;
export const SET_POWER_FRAME_LENGTH = 6;
export const SET_BRIGHTNESS_OPCODE = 0x07;
export const SET_BRIGHTNESS_FRAME_LENGTH = 7;
export const SET_COLOUR_TEMPERATURE_OPCODE = 0x04;
export const SET_COLOUR_TEMPERATURE_FRAME_LENGTH = 10;
export const GET_STATUS_OPCODE = 0x13;
export const GET_STATUS_FRAME_LENGTH = 7;
export const SET_CLOCK_OPCODE = 0x16;
export const SET_CLOCK_FRAME_LENGTH = 12;

const POWER_STATES = { on: 1, off: 2 } as const;
const COLOUR_MODE = 1;
const COLOUR_INDEX = 3;
const STATUS_QUERY_MARKER = 0xAA;

export interface SetPowerFrameInput {
  readonly sequence: number;
  readonly power: keyof typeof POWER_STATES;
}

export function createSetPowerFrame(input: SetPowerFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SET_POWER_FRAME_LENGTH,
    input.sequence,
    SET_POWER_OPCODE,
    POWER_STATES[input.power],
    0,
  ]);
  frame[5] = sum8(frame.slice(0, 5));
  return frame;
}

export interface SetBrightnessFrameInput {
  readonly sequence: number;
  readonly brightnessPercent: number;
}

export function createSetBrightnessFrame(input: SetBrightnessFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SET_BRIGHTNESS_FRAME_LENGTH,
    input.sequence,
    SET_BRIGHTNESS_OPCODE,
    input.brightnessPercent,
    brightnessToInverseRaw(input.brightnessPercent),
    0,
  ]);
  frame[6] = sum8(frame.slice(0, 6));
  return frame;
}

export interface SetColourTemperatureFrameInput {
  readonly sequence: number;
  readonly white: number;
  readonly warmWhite: number;
  readonly brightnessPercent: number;
}

export function createSetColourTemperatureFrame(input: SetColourTemperatureFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.white, 0, 255, 'White');
  assertIntegerInRange(input.warmWhite, 0, 255, 'Warm white');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SET_COLOUR_TEMPERATURE_FRAME_LENGTH,
    input.sequence,
    SET_COLOUR_TEMPERATURE_OPCODE,
    COLOUR_MODE,
    COLOUR_INDEX,
    input.white,
    input.warmWhite,
    brightnessToInverseRaw(input.brightnessPercent),
    0,
  ]);
  frame[9] = sum8(frame.slice(0, 9));
  return frame;
}

export interface GetStatusFrameInput {
  readonly sequence: number;
  readonly queryToken: number;
}

export function createGetStatusFrame(input: GetStatusFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.queryToken, 0, 0xFE, 'Query token');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    GET_STATUS_FRAME_LENGTH,
    input.sequence,
    GET_STATUS_OPCODE,
    input.queryToken,
    STATUS_QUERY_MARKER,
    0,
  ]);
  frame[6] = sum8(frame.slice(0, 6));
  return frame;
}

export interface SetClockFrameInput {
  readonly sequence: number;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** 1 = Monday … 7 = Sunday */
  readonly weekday: number;
}

export function createSetClockFrame(input: SetClockFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.year, 2000, 2255, 'Year');
  assertIntegerInRange(input.month, 1, 12, 'Month');
  assertIntegerInRange(input.day, 1, 31, 'Day');
  assertIntegerInRange(input.hour, 0, 23, 'Hour');
  assertIntegerInRange(input.minute, 0, 59, 'Minute');
  assertIntegerInRange(input.second, 0, 59, 'Second');
  assertIntegerInRange(input.weekday, 1, 7, 'Weekday');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    SET_CLOCK_FRAME_LENGTH,
    input.sequence,
    SET_CLOCK_OPCODE,
    input.year - 2000,
    input.month,
    input.day,
    input.hour,
    input.minute,
    input.second,
    input.weekday,
    0,
  ]);
  frame[11] = sum8(frame.slice(0, 11));
  return frame;
}

// Alarm commands — Somnara BLE Protocol v0.9. These frames are not sent from
// the screen yet. Flag bit 0 is enabled and bit 1 is skip-next. The weekday
// mask uses bit 0 for Monday through bit 6 for Sunday, and 0 is invalid.
export const UPSERT_ALARM_OPCODE = 0x17;
export const UPSERT_ALARM_FRAME_LENGTH = 18;
export const READ_ALARMS_OPCODE = 0x18;
export const READ_ALARMS_FRAME_LENGTH = 7;
export const BEGIN_ALARM_SYNC_OPCODE = 0x19;
export const COMMIT_ALARM_SYNC_OPCODE = 0x1A;
export const ALARM_SYNC_FRAME_LENGTH = 8;
export const DELETE_ALARM_OPCODE = 0x1B;
export const DELETE_ALARM_FRAME_LENGTH = 7;

export interface UpsertAlarmFrameInput {
  readonly sequence: number;
  readonly alarmIndex: number;
  readonly enabled: boolean;
  readonly skipNext: boolean;
  readonly hour: number;
  readonly minute: number;
  /** Bit 0 = Monday … bit 6 = Sunday. Zero is invalid. */
  readonly weekdayMask: number;
  readonly sunriseMinutes: 15 | 30 | 45;
  readonly brightnessPercent: number;
  readonly soundId: number;
  readonly volumePercent: number;
}

export function createUpsertAlarmFrame(input: UpsertAlarmFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.alarmIndex, 0, 9, 'Alarm index');
  assertIntegerInRange(input.hour, 0, 23, 'Hour');
  assertIntegerInRange(input.minute, 0, 59, 'Minute');
  assertIntegerInRange(input.weekdayMask, 1, 0x7F, 'Weekday mask');
  assertSunriseMinutes(input.sunriseMinutes);
  assertIntegerInRange(input.brightnessPercent, 0, 100, 'Final brightness');
  assertIntegerInRange(input.soundId, 0, 25, 'Sound ID');
  assertIntegerInRange(input.volumePercent, 0, 100, 'Volume');

  const flags = (input.enabled ? 0x01 : 0) | (input.skipNext ? 0x02 : 0);
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    UPSERT_ALARM_FRAME_LENGTH,
    input.sequence,
    UPSERT_ALARM_OPCODE,
    input.alarmIndex,
    flags,
    input.hour,
    input.minute,
    input.weekdayMask,
    input.sunriseMinutes,
    input.brightnessPercent,
    input.soundId,
    input.volumePercent,
    0, 0, 0, 0,
    0,
  ]);
  frame[17] = sum8(frame.slice(0, 17));
  return frame;
}

export function createReadAlarmsFrame(input: GetStatusFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.queryToken, 0, 0xFE, 'Query token');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    READ_ALARMS_FRAME_LENGTH,
    input.sequence,
    READ_ALARMS_OPCODE,
    input.queryToken,
    STATUS_QUERY_MARKER,
    0,
  ]);
  frame[6] = sum8(frame.slice(0, 6));
  return frame;
}

export interface AlarmSyncFrameInput {
  readonly sequence: number;
  readonly revision: number;
  readonly alarmCount: number;
}

export function createBeginAlarmSyncFrame(input: AlarmSyncFrameInput): Uint8Array {
  return createAlarmSyncFrame(BEGIN_ALARM_SYNC_OPCODE, input);
}

export function createCommitAlarmSyncFrame(input: AlarmSyncFrameInput): Uint8Array {
  return createAlarmSyncFrame(COMMIT_ALARM_SYNC_OPCODE, input);
}

export interface DeleteAlarmFrameInput {
  readonly sequence: number;
  readonly alarmIndex: number;
}

export function createDeleteAlarmFrame(input: DeleteAlarmFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.alarmIndex, 0, 9, 'Alarm index');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    DELETE_ALARM_FRAME_LENGTH,
    input.sequence,
    DELETE_ALARM_OPCODE,
    input.alarmIndex,
    STATUS_QUERY_MARKER,
    0,
  ]);
  frame[6] = sum8(frame.slice(0, 6));
  return frame;
}

function createAlarmSyncFrame(opcode: number, input: AlarmSyncFrameInput): Uint8Array {
  assertIntegerInRange(input.sequence, 0, 0xFE, 'Sequence');
  assertIntegerInRange(input.revision, 0, 0xFFFF, 'Revision');
  assertIntegerInRange(input.alarmCount, 0, 10, 'Alarm count');
  const frame = new Uint8Array([
    ACK_FRAME_HEADER,
    ALARM_SYNC_FRAME_LENGTH,
    input.sequence,
    opcode,
    input.revision & 0xFF,
    (input.revision >> 8) & 0xFF,
    input.alarmCount,
    0,
  ]);
  frame[7] = sum8(frame.slice(0, 7));
  return frame;
}

function assertSunriseMinutes(value: number): asserts value is 15 | 30 | 45 {
  if (value !== 15 && value !== 30 && value !== 45) {
    throw new RangeError('Sunrise minutes must be 15, 30, or 45.');
  }
}

export function clockFrameFromDate(sequence: number, date: Date): Uint8Array {
  const jsDay = date.getDay();
  return createSetClockFrame({
    sequence,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    weekday: jsDay === 0 ? 7 : jsDay,
  });
}
