import { sum8 } from './AckFrame';
import {
  ALARM_LIST_LENGTH,
  ALARM_LIST_OPCODE,
  ALARM_SLOT_LENGTH,
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
    0, 11, 1, 0, 0, 0, 2, 0, 0,
    1, 60, 100, 0, 30, 4, 1, 2, 2, 0, 0,
  ]));
}

export function createManufacturerAlarmListFixture(sequence = 7): Uint8Array {
  const frame = new Uint8Array(ALARM_LIST_LENGTH);
  frame.set([0xFF, ALARM_LIST_LENGTH, sequence, ALARM_LIST_OPCODE, 0, 3, 0, 2, 0, 1, 0]);
  frame.set([0x03, 7, 30, 0x3E, 30, 80, 4, 45, 0], 11);
  frame.set([0x07, 8, 15, 0x41, 15, 65, 5, 35, 0], 11 + ALARM_SLOT_LENGTH);
  frame[8] = sum8(frame.slice(11, 101));
  return finishFrame(frame);
}

export const manufacturerProtocolFixtures = {
  automaticStatus: createManufacturerStatusFixture(),
  requestedStatus: createManufacturerStatusFixture(8),
  alarmList: createManufacturerAlarmListFixture(),
  malformedHeader: new Uint8Array([0x00, 5, 0xFF, STATUS_REPORT_OPCODE, 0x12]),
  malformedChecksum: (() => {
    const frame = createManufacturerStatusFixture();
    frame[frame.length - 1] ^= 0x01;
    return frame;
  })(),
} as const;
