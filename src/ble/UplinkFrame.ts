import {
  ACK_FRAME_HEADER,
  ACK_FRAME_OPCODE,
  BleProtocolError,
  sum8,
} from './AckFrame';
import { AckTransactionController } from './AckTransactionController';

export const STATUS_REPORT_OPCODE = 0x13;
export const STATUS_REPORT_LENGTH = 24;
export const ALARM_LIST_OPCODE = 0x18;
export const ALARM_LIST_LENGTH = 104;
export const ALARM_SLOT_COUNT = 10;
export const ALARM_SLOT_LENGTH = 9;
export const MINIMUM_ALARM_LIST_MTU = 107;

export interface DeviceStatusReport {
  readonly sequence: number;
  readonly protocolMajor: number;
  readonly protocolMinor: number;
  readonly productId: number;
  readonly hardwareRevision: number;
  readonly firmwareMajor: number;
  readonly firmwareMinor: number;
  readonly firmwarePatch: number;
  readonly firmwareBuild: number;
  readonly power: boolean;
  readonly brightnessPercent: number;
  readonly cctW: number;
  readonly cctWw: number;
  readonly volumePercent: number;
  readonly soundId: number;
  readonly clockValid: boolean;
  readonly alarmCount: number;
  readonly deviceState: 0 | 1 | 2 | 3;
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
  readonly clockValid: boolean;
  readonly slots: readonly DeviceAlarmSlot[];
}

export type UplinkNotification =
  | { readonly kind: 'ack' }
  | { readonly kind: 'status'; readonly status: DeviceStatusReport }
  | { readonly kind: 'alarm_list'; readonly alarmList: AlarmListReport };

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
    throw new BleProtocolError('invalid_status_length', 'Status report must contain exactly 24 bytes.');
  }
  if (frame[3] !== STATUS_REPORT_OPCODE) {
    throw new BleProtocolError('invalid_notification_opcode', 'Frame is not a device status report.');
  }

  assertRange(frame[13], 0, 1, 'Power');
  assertRange(frame[14], 0, 100, 'Brightness');
  assertRange(frame[17], 0, 100, 'Volume');
  assertRange(frame[18], 0, 25, 'Sound ID');
  assertRange(frame[19], 0, 1, 'Clock Valid');
  assertRange(frame[20], 0, 10, 'Alarm Count');
  assertRange(frame[21], 0, 3, 'Device State');

  return {
    sequence: frame[2],
    protocolMajor: frame[4],
    protocolMinor: frame[5],
    productId: frame[6],
    hardwareRevision: frame[7],
    firmwareMajor: frame[8],
    firmwareMinor: frame[9],
    firmwarePatch: frame[10],
    firmwareBuild: frame[11] | (frame[12] << 8),
    power: frame[13] === 1,
    brightnessPercent: frame[14],
    cctW: frame[15],
    cctWw: frame[16],
    volumePercent: frame[17],
    soundId: frame[18],
    clockValid: frame[19] === 1,
    alarmCount: frame[20],
    deviceState: frame[21] as DeviceStatusReport['deviceState'],
    flags: frame[22],
  };
}

export function parseAlarmListFrame(frame: Uint8Array): AlarmListReport {
  validateUplinkEnvelope(frame);
  if (frame.length !== ALARM_LIST_LENGTH) {
    throw new BleProtocolError('invalid_alarm_list_length', 'Alarm list must contain exactly 104 bytes.');
  }
  if (frame[3] !== ALARM_LIST_OPCODE) {
    throw new BleProtocolError('invalid_notification_opcode', 'Frame is not an alarm list report.');
  }
  if (frame[4] !== 0 || frame[10] !== 0 || frame[101] !== 0 || frame[102] !== 0) {
    invalidAlarmList('Alarm list reserved bytes must be zero.');
  }
  assertAlarmRange(frame[7], 0, ALARM_SLOT_COUNT, 'Alarm Count');
  assertAlarmRange(frame[9], 0, 1, 'Clock Valid');
  if (sum8(frame.slice(11, 101)) !== frame[8]) {
    throw new BleProtocolError('invalid_alarm_list_checksum', 'Alarm list data checksum is invalid.');
  }

  const slots: DeviceAlarmSlot[] = [];
  let occupiedCount = 0;
  for (let index = 0; index < ALARM_SLOT_COUNT; index += 1) {
    const offset = 11 + (index * ALARM_SLOT_LENGTH);
    const bytes = frame.slice(offset, offset + ALARM_SLOT_LENGTH);
    const flags = bytes[0];
    if ((flags & 0xF8) !== 0) invalidAlarmList(`Alarm slot ${index + 1} has unsupported flag bits.`);
    const occupied = (flags & 0x01) !== 0;
    if (!occupied) {
      if (bytes.some(value => value !== 0)) invalidAlarmList(`Empty alarm slot ${index + 1} must contain zero bytes.`);
      slots.push({
        index, occupied: false, enabled: false, skipNext: false, hour: null, minute: null,
        weekdayMask: null, sunriseMinutes: null, brightnessPercent: null, soundId: null, volumePercent: null,
      });
      continue;
    }

    occupiedCount += 1;
    assertAlarmRange(bytes[1], 0, 23, `Alarm slot ${index + 1} hour`);
    assertAlarmRange(bytes[2], 0, 59, `Alarm slot ${index + 1} minute`);
    assertAlarmRange(bytes[3], 1, 0x7F, `Alarm slot ${index + 1} weekday mask`);
    if (bytes[4] !== 15 && bytes[4] !== 30 && bytes[4] !== 45) {
      invalidAlarmList(`Alarm slot ${index + 1} sunrise duration is invalid.`);
    }
    assertAlarmRange(bytes[5], 0, 100, `Alarm slot ${index + 1} brightness`);
    assertAlarmRange(bytes[6], 0, 25, `Alarm slot ${index + 1} sound ID`);
    assertAlarmRange(bytes[7], 0, 100, `Alarm slot ${index + 1} volume`);
    if (bytes[8] !== 0) invalidAlarmList(`Alarm slot ${index + 1} reserved byte must be zero.`);
    slots.push({
      index,
      occupied: true,
      enabled: (flags & 0x02) !== 0,
      skipNext: (flags & 0x04) !== 0,
      hour: bytes[1],
      minute: bytes[2],
      weekdayMask: bytes[3],
      sunriseMinutes: bytes[4] as 15 | 30 | 45,
      brightnessPercent: bytes[5],
      soundId: bytes[6],
      volumePercent: bytes[7],
    });
  }
  if (occupiedCount !== frame[7]) invalidAlarmList('Alarm count does not match the occupied alarm slots.');

  return {
    sequence: frame[2],
    revision: frame[5] | (frame[6] << 8),
    alarmCount: frame[7],
    clockValid: frame[9] === 1,
    slots,
  };
}

export function dispatchUplinkNotification(
  frame: Uint8Array,
  ackController: AckTransactionController,
): UplinkNotification {
  validateUplinkEnvelope(frame);
  switch (frame[3]) {
    case ACK_FRAME_OPCODE:
      ackController.handleNotification(frame);
      return { kind: 'ack' };
    case STATUS_REPORT_OPCODE:
      return { kind: 'status', status: parseDeviceStatusFrame(frame) };
    case ALARM_LIST_OPCODE:
      return { kind: 'alarm_list', alarmList: parseAlarmListFrame(frame) };
    default:
      throw new BleProtocolError('invalid_notification_opcode', 'Device notification opcode is not supported.');
  }
}
