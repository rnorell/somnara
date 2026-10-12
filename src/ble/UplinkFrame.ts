import {
  ACK_FRAME_HEADER,
  ACK_FRAME_OPCODE,
  BleProtocolError,
  sum8,
} from './AckFrame';
import { AckTransactionController } from './AckTransactionController';

export const STATUS_REPORT_OPCODE = 0x13;
export const STATUS_REPORT_LENGTH = 14;
export const ALARM_LIST_OPCODE = 0x18;
export const ALARM_RECORD_LENGTH = 18;
export const ALARM_LIST_END_LENGTH = 10;
export const ALARM_SLOT_COUNT = 10;
export const MINIMUM_ALARM_LIST_MTU = 107;

export interface DeviceStatusReport {
  readonly sequence: number;
  readonly power: boolean;
  readonly brightnessPercent: number;
  readonly cctW: number;
  readonly cctWw: number;
  readonly volumePercent: number;
  readonly soundId: number;
  readonly clockValid: boolean;
  readonly alarmCount: number;
  readonly flags: number;
}

export interface DeviceAlarmSlot {
  readonly index: number;
  readonly occupied: boolean;
  readonly enabled: boolean;
  readonly skipNext: boolean;
  readonly hour: number | null;
  readonly minute: number | null;
  readonly weekdayMask: number | null;
  readonly sunriseMinutes: 15 | 30 | 45 | null;
  readonly brightnessPercent: number | null;
  readonly soundId: number | null;
  readonly volumePercent: number | null;
}

export interface AlarmListReport {
  readonly sequence: number;
  readonly revision: number;
  readonly alarmCount: number;
  readonly slots: readonly DeviceAlarmSlot[];
}

export interface AlarmListEnd {
  readonly sequence: number;
  readonly revision: number;
  readonly alarmCount: number;
  readonly listChecksum: number;
}

export type UplinkNotification =
  | { readonly kind: 'ack' }
  | { readonly kind: 'status'; readonly status: DeviceStatusReport }
  | { readonly kind: 'alarm_record'; readonly sequence: number; readonly slot: DeviceAlarmSlot }
  | { readonly kind: 'alarm_list'; readonly alarmList: AlarmListReport }
  | { readonly kind: 'alarm_end'; readonly end: AlarmListEnd };

function invalidStatus(message: string): never {
  throw new BleProtocolError('invalid_status_value', message);
}

function assertRange(value: number, min: number, max: number, field: string): void {
  if (value < min || value > max) invalidStatus(`${field} is outside its valid range.`);
}

function invalidAlarmList(message: string): never {
  throw new BleProtocolError('invalid_alarm_list_value', message);
}

function assertAlarmRange(value: number, min: number, max: number, field: string): void {
  if (value < min || value > max) invalidAlarmList(`${field} is outside its valid range.`);
}

export function validateUplinkEnvelope(frame: Uint8Array): void {
  if (frame.length < 5) {
    throw new BleProtocolError('invalid_frame_length', 'Device notification is too short.');
  }
  if (frame[0] !== ACK_FRAME_HEADER) {
    throw new BleProtocolError('invalid_header', 'Device notification has an invalid header.');
  }
  if (frame[1] !== frame.length) {
    throw new BleProtocolError('invalid_frame_length', 'Device notification length does not match its length byte.');
  }
  if (sum8(frame.slice(0, -1)) !== frame[frame.length - 1]) {
    throw new BleProtocolError('invalid_checksum', 'Device notification checksum is invalid.');
  }
}

export function parseDeviceStatusFrame(frame: Uint8Array): DeviceStatusReport {
  validateUplinkEnvelope(frame);
  if (frame.length !== STATUS_REPORT_LENGTH) {
    throw new BleProtocolError('invalid_status_length', 'Status report must contain exactly 14 bytes.');
  }
  if (frame[3] !== STATUS_REPORT_OPCODE) {
    throw new BleProtocolError('invalid_notification_opcode', 'Frame is not a device status report.');
  }

  assertRange(frame[4], 0, 1, 'Power');
  assertRange(frame[5], 0, 100, 'Brightness');
  assertRange(frame[8], 0, 100, 'Volume');
  assertRange(frame[9], 0, 25, 'Sound ID');
  assertRange(frame[10], 0, 1, 'Clock Valid');
  assertRange(frame[11], 0, 10, 'Alarm Count');

  return {
    sequence: frame[2],
    power: frame[4] === 1,
    brightnessPercent: frame[5],
    cctW: frame[6],
    cctWw: frame[7],
    volumePercent: frame[8],
    soundId: frame[9],
    clockValid: frame[10] === 1,
    alarmCount: frame[11],
    flags: frame[12],
  };
}

export function parseAlarmRecordFrame(frame: Uint8Array): { sequence: number; slot: DeviceAlarmSlot } {
  validateUplinkEnvelope(frame);
  if (frame.length !== ALARM_RECORD_LENGTH || frame[3] !== ALARM_LIST_OPCODE || frame[4] === 0xFF) {
    throw new BleProtocolError('invalid_alarm_list_length', 'Alarm record has an unexpected length.');
  }
  const [index, flags, hour, minute, weekdayMask, sunriseMinutes, brightnessPercent, soundId, volumePercent] = [
    frame[4], frame[5], frame[6], frame[7], frame[8], frame[9], frame[10], frame[11], frame[12],
  ];
  const reserved = frame[13] | frame[14] | frame[15] | frame[16];
  const sunriseOk = sunriseMinutes === 15 || sunriseMinutes === 30 || sunriseMinutes === 45;
  if ((flags & ~0x03) !== 0) invalidAlarmList('Alarm record has unsupported flag bits.');
  if (reserved !== 0) invalidAlarmList('Alarm record reserved bytes must be zero.');
  assertAlarmRange(index, 0, 9, 'Alarm index');
  assertAlarmRange(hour, 0, 23, 'Alarm hour');
  assertAlarmRange(minute, 0, 59, 'Alarm minute');
  assertAlarmRange(weekdayMask, 1, 0x7F, 'Alarm weekday mask');
  if (!sunriseOk) invalidAlarmList('Alarm sunrise duration is invalid.');
  assertAlarmRange(brightnessPercent, 0, 100, 'Alarm brightness');
  assertAlarmRange(soundId, 0, 25, 'Alarm sound ID');
  assertAlarmRange(volumePercent, 0, 100, 'Alarm volume');
  return {
    sequence: frame[2],
    slot: {
      index, occupied: true, hour, minute, weekdayMask, soundId, volumePercent,
      enabled: (flags & 0x01) !== 0,
      skipNext: (flags & 0x02) !== 0,
      sunriseMinutes: sunriseMinutes as 15 | 30 | 45,
      brightnessPercent,
    },
  };
}

export function parseAlarmListEndFrame(frame: Uint8Array): AlarmListEnd {
  validateUplinkEnvelope(frame);
  if (frame.length !== ALARM_LIST_END_LENGTH || frame[3] !== ALARM_LIST_OPCODE || frame[4] !== 0xFF) {
    throw new BleProtocolError('invalid_alarm_list_length', 'Alarm list end has an unexpected length.');
  }
  assertAlarmRange(frame[7], 0, ALARM_SLOT_COUNT, 'Alarm Count');
  return {
    sequence: frame[2],
    revision: frame[5] | (frame[6] << 8),
    alarmCount: frame[7],
    listChecksum: frame[8],
  };
}

export function applyAlarmRecord(current: AlarmListReport | null, sequence: number, slot: DeviceAlarmSlot): AlarmListReport {
  const slots = [...(current?.slots ?? []).filter(item => item.index !== slot.index), slot]
    .sort((left, right) => left.index - right.index);
  return { sequence, revision: current?.revision ?? 0, alarmCount: slots.length, slots };
}

export class AlarmListReader {
  private pending: DeviceAlarmSlot[] = [];

  clear(): void {
    this.pending = [];
  }

  push(frame: Uint8Array): UplinkNotification {
    if (frame[4] === 0xFF) return this.finish(frame);
    const record = parseAlarmRecordFrame(frame);
    if (this.pending.some(slot => slot.index === record.slot.index)) {
      this.pending = [];
      invalidAlarmList('Alarm record index is repeated.');
    }
    this.pending.push(record.slot);
    return { kind: 'alarm_record', sequence: record.sequence, slot: record.slot };
  }

  private finish(frame: Uint8Array): UplinkNotification {
    const end = parseAlarmListEndFrame(frame);
    const pending = this.pending;
    this.pending = [];
    if (pending.length === 0 && end.alarmCount > 0) return { kind: 'alarm_end', end };
    if (pending.length !== end.alarmCount) invalidAlarmList('Alarm count does not match the occupied alarm slots.');
    const listed = new Uint8Array(pending.length * 13);
    [...pending].sort((left, right) => left.index - right.index)
      .forEach((slot, index) => listed.set(alarmRecordBody(slot), index * 13));
    if (sum8(listed) !== end.listChecksum) {
      throw new BleProtocolError('invalid_alarm_list_checksum', 'Alarm list data checksum is invalid.');
    }
    const slots = [...pending].sort((left, right) => left.index - right.index);
    return {
      kind: 'alarm_list',
      alarmList: { sequence: end.sequence, revision: end.revision, alarmCount: end.alarmCount, slots },
    };
  }
}

function alarmRecordBody(slot: DeviceAlarmSlot): Uint8Array {
  return new Uint8Array([
    slot.index,
    (slot.enabled ? 0x01 : 0) | (slot.skipNext ? 0x02 : 0),
    slot.hour ?? 0,
    slot.minute ?? 0,
    slot.weekdayMask ?? 0,
    slot.sunriseMinutes ?? 0,
    slot.brightnessPercent ?? 0,
    slot.soundId ?? 0,
    slot.volumePercent ?? 0,
    0, 0, 0, 0,
  ]);
}

export function dispatchUplinkNotification(
  frame: Uint8Array,
  ackController: AckTransactionController,
  alarmReader: AlarmListReader,
): UplinkNotification {
  validateUplinkEnvelope(frame);
  switch (frame[3]) {
    case ACK_FRAME_OPCODE:
      ackController.handleNotification(frame);
      alarmReader.clear();
      return { kind: 'ack' };
    case STATUS_REPORT_OPCODE:
      return { kind: 'status', status: parseDeviceStatusFrame(frame) };
    case ALARM_LIST_OPCODE:
      return alarmReader.push(frame);
    default:
      throw new BleProtocolError('invalid_notification_opcode', 'Device notification opcode is not supported.');
  }
}
