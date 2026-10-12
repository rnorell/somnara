import { sum8 } from './AckFrame';
import {
  ALARM_LIST_END_LENGTH,
  ALARM_LIST_OPCODE,
  ALARM_RECORD_LENGTH,
  STATUS_REPORT_LENGTH,
  STATUS_REPORT_OPCODE,
} from './UplinkFrame';

function finishFrame(frame: Uint8Array): Uint8Array {
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

export function createManufacturerStatusFixture(sequence = 0xFF): Uint8Array {
  return finishFrame(new Uint8Array([
    0xFF, STATUS_REPORT_LENGTH, sequence, STATUS_REPORT_OPCODE,
    1, 60, 100, 0, 30, 4, 1, 2, 0, 0,
  ]));
}

export function createManufacturerAlarmListFrames(sequence = 7): Uint8Array[] {
  const records = [
    alarmRecordFrame(sequence, [0, 0x01, 7, 30, 0x3E, 30, 80, 4, 45]),
    alarmRecordFrame(sequence, [1, 0x03, 8, 15, 0x41, 15, 65, 5, 35]),
  ];
  const listed = new Uint8Array(records.length * 13);
  records.forEach((frame, index) => listed.set(frame.slice(4, 17), index * 13));
  const end = new Uint8Array([
    0xFF, ALARM_LIST_END_LENGTH, sequence, ALARM_LIST_OPCODE, 0xFF, 3, 0, records.length, sum8(listed), 0,
  ]);
  return [...records, finishFrame(end)];
}

function alarmRecordFrame(sequence: number, body: number[]): Uint8Array {
  return finishFrame(new Uint8Array([
    0xFF, ALARM_RECORD_LENGTH, sequence, ALARM_LIST_OPCODE, ...body, 0, 0, 0, 0, 0,
  ]));
}

export const manufacturerProtocolFixtures = {
  automaticStatus: createManufacturerStatusFixture(),
  requestedStatus: createManufacturerStatusFixture(8),
  alarmList: createManufacturerAlarmListFrames(),
  malformedHeader: new Uint8Array([0x00, 5, 0xFF, STATUS_REPORT_OPCODE, 0x12]),
  malformedChecksum: (() => {
    const frame = createManufacturerStatusFixture();
    frame[frame.length - 1] ^= 0x01;
    return frame;
  })(),
} as const;
