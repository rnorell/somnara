import { BleProtocolError, sum8 } from './AckFrame';
import { AckTransactionController } from './AckTransactionController';
import {
  AlarmListReader,
  ALARM_LIST_OPCODE,
  dispatchUplinkNotification,
  parseDeviceStatusFrame,
  STATUS_REPORT_LENGTH,
  STATUS_REPORT_OPCODE,
} from './UplinkFrame';
import { createManufacturerAlarmListFrames, manufacturerProtocolFixtures } from './manufacturerProtocolFixtures';

function statusFrame(overrides: Record<number, number> = {}): Uint8Array {
  const frame = new Uint8Array([
    0xFF, STATUS_REPORT_LENGTH, 0xFF, STATUS_REPORT_OPCODE,
    1, 75, 120, 0, 40, 5, 1, 3, 0, 0,
  ]);
  for (const [index, value] of Object.entries(overrides)) frame[Number(index)] = value;
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

function emptyAlarmEnd(): Uint8Array {
  const frame = new Uint8Array([0xFF, 10, 7, ALARM_LIST_OPCODE, 0xFF, 0, 0, 0, 0, 0]);
  frame[9] = sum8(frame.slice(0, 9));
  return frame;
}

function readAlarmList(frames: readonly Uint8Array[]) {
  const reader = new AlarmListReader();
  let list = null;
  for (const frame of frames) {
    const notification = reader.push(frame);
    if (notification.kind === 'alarm_list') list = notification.alarmList;
  }
  if (!list) throw new Error('Alarm list did not finish.');
  return list;
}

describe('device uplink dispatch', () => {
  it('parses an automatic status report with sequence 0xFF', () => {
    expect(parseDeviceStatusFrame(statusFrame())).toEqual({
      sequence: 0xFF,
      power: true,
      brightnessPercent: 75,
      cctW: 120,
      cctWw: 0,
      volumePercent: 40,
      soundId: 5,
      clockValid: true,
      alarmCount: 3,
      flags: 0,
    });
  });

  it('routes status and alarm reports without invoking the ACK parser', () => {
    const controller = new AckTransactionController(async () => undefined);
    const reader = new AlarmListReader();
    const ackHandler = jest.spyOn(controller, 'handleNotification');
    expect(dispatchUplinkNotification(statusFrame(), controller, reader).kind).toBe('status');
    expect(dispatchUplinkNotification(emptyAlarmEnd(), controller, reader).kind).toBe('alarm_list');
    expect(ackHandler).not.toHaveBeenCalled();
  });

  it('assembles alarm records and checks the list end', () => {
    const result = readAlarmList(createManufacturerAlarmListFrames());
    expect(result).toMatchObject({ sequence: 7, revision: 3, alarmCount: 2 });
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0]).toEqual({
      index: 0, occupied: true, enabled: true, skipNext: false, hour: 7, minute: 30,
      weekdayMask: 0x3E, sunriseMinutes: 30, brightnessPercent: 80, soundId: 4, volumePercent: 45,
    });
    expect(result.slots[1].skipNext).toBe(true);
  });

  it('keeps a save or skip record before the list end arrives', () => {
    const reader = new AlarmListReader();
    const [first] = createManufacturerAlarmListFrames();
    const record = reader.push(first);
    expect(record.kind).toBe('alarm_record');
    if (record.kind !== 'alarm_record') return;
    expect(record.slot.enabled).toBe(true);
    expect(record.slot.skipNext).toBe(false);
  });

  it('accepts a list end that does not repeat the records', () => {
    const frames = createManufacturerAlarmListFrames();
    const reader = new AlarmListReader();
    expect(reader.push(frames[frames.length - 1]).kind).toBe('alarm_end');
  });

  it('rejects invalid alarm-list data checksum', () => {
    const frames = createManufacturerAlarmListFrames();
    const end = frames[frames.length - 1];
    end[8] ^= 1;
    end[9] = sum8(end.slice(0, 9));
    expect(() => readAlarmList(frames)).toThrow('data checksum');
  });

  it('rejects invalid alarm-list frame checksum', () => {
    const frames = createManufacturerAlarmListFrames();
    frames[0][frames[0].length - 1] ^= 1;
    expect(() => readAlarmList(frames)).toThrow('checksum');
  });

  it('rejects an alarm count that does not match occupied slots', () => {
    const frames = createManufacturerAlarmListFrames();
    const end = frames[frames.length - 1];
    end[7] = 1;
    end[9] = sum8(end.slice(0, 9));
    expect(() => readAlarmList(frames)).toThrow('does not match');
  });

  it('provides malformed and automatic manufacturer fixtures', () => {
    expect(parseDeviceStatusFrame(manufacturerProtocolFixtures.automaticStatus).sequence).toBe(0xFF);
    expect(() => parseDeviceStatusFrame(manufacturerProtocolFixtures.malformedChecksum)).toThrow('checksum');
    expect(() => parseDeviceStatusFrame(manufacturerProtocolFixtures.malformedHeader)).toThrow('header');
  });

  it.each([
    [4, 2, 'Power'],
    [5, 101, 'Brightness'],
    [8, 101, 'Volume'],
    [9, 26, 'Sound ID'],
    [10, 2, 'Clock Valid'],
    [11, 11, 'Alarm Count'],
  ])('rejects invalid status byte %i', (index, value, field) => {
    expect(() => parseDeviceStatusFrame(statusFrame({ [index]: value }))).toThrow(field);
  });

  it('rejects malformed and unknown notifications', () => {
    const controller = new AckTransactionController(async () => undefined);
    const reader = new AlarmListReader();
    expect(() => dispatchUplinkNotification(new Uint8Array([0xFF]), controller, reader)).toThrow(BleProtocolError);
    expect(() => dispatchUplinkNotification(statusFrame({ 3: 0x55 }), controller, reader)).toThrow('opcode');
    const invalidChecksum = statusFrame();
    invalidChecksum[STATUS_REPORT_LENGTH - 1] ^= 1;
    expect(() => dispatchUplinkNotification(invalidChecksum, controller, reader)).toThrow('checksum');
  });
});
