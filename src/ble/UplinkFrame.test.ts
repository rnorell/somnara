import { BleProtocolError, sum8 } from './AckFrame';
import { AckTransactionController } from './AckTransactionController';
import {
  ALARM_LIST_LENGTH,
  ALARM_LIST_OPCODE,
  dispatchUplinkNotification,
  parseAlarmListFrame,
  parseDeviceStatusFrame,
  STATUS_REPORT_LENGTH,
  STATUS_REPORT_OPCODE,
} from './UplinkFrame';
import { createManufacturerAlarmListFixture, manufacturerProtocolFixtures } from './manufacturerProtocolFixtures';

function statusFrame(overrides: Record<number, number> = {}): Uint8Array {
  const frame = new Uint8Array([
    0xFF, STATUS_REPORT_LENGTH, 0xFF, STATUS_REPORT_OPCODE,
    0, 11, 1, 0, 0, 0, 2, 0, 0,
    1, 75, 120, 0, 40, 5, 1, 3, 2, 0, 0,
  ]);
  for (const [index, value] of Object.entries(overrides)) frame[Number(index)] = value;
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

function alarmListFrame(): Uint8Array {
  const frame = new Uint8Array(ALARM_LIST_LENGTH);
  frame[0] = 0xFF;
  frame[1] = ALARM_LIST_LENGTH;
  frame[2] = 7;
  frame[3] = ALARM_LIST_OPCODE;
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

describe('device uplink dispatch', () => {
  it('parses an automatic status report with sequence 0xFF', () => {
    expect(parseDeviceStatusFrame(statusFrame())).toEqual({
      sequence: 0xFF,
      protocolMajor: 0,
      protocolMinor: 11,
      productId: 1,
      hardwareRevision: 0,
      firmwareMajor: 0,
      firmwareMinor: 0,
      firmwarePatch: 2,
      firmwareBuild: 0,
      power: true,
      brightnessPercent: 75,
      cctW: 120,
      cctWw: 0,
      volumePercent: 40,
      soundId: 5,
      clockValid: true,
      alarmCount: 3,
      deviceState: 2,
      flags: 0,
    });
  });

  it('routes status and alarm reports without invoking the ACK parser', () => {
    const controller = new AckTransactionController(async () => undefined);
    const ackHandler = jest.spyOn(controller, 'handleNotification');
    expect(dispatchUplinkNotification(statusFrame(), controller).kind).toBe('status');
    expect(dispatchUplinkNotification(alarmListFrame(), controller).kind).toBe('alarm_list');
    expect(ackHandler).not.toHaveBeenCalled();
  });

  it('parses all ten manufacturer alarm slots and both checksums', () => {
    const result = parseAlarmListFrame(createManufacturerAlarmListFixture());
    expect(result).toMatchObject({ sequence: 7, revision: 3, alarmCount: 2, clockValid: true });
    expect(result.slots).toHaveLength(10);
    expect(result.slots[0]).toEqual({
      index: 0, occupied: true, enabled: true, skipNext: false, hour: 7, minute: 30,
      weekdayMask: 0x3E, sunriseMinutes: 30, brightnessPercent: 80, soundId: 4, volumePercent: 45,
    });
    expect(result.slots[1].skipNext).toBe(true);
    expect(result.slots[9].occupied).toBe(false);
  });

  it('rejects invalid alarm-list data checksum', () => {
    const frame = createManufacturerAlarmListFixture();
    frame[8] ^= 1;
    frame[103] = sum8(frame.slice(0, -1));
    expect(() => parseAlarmListFrame(frame)).toThrow('data checksum');
  });

  it('rejects invalid alarm-list frame checksum', () => {
    const frame = createManufacturerAlarmListFixture();
    frame[103] ^= 1;
    expect(() => parseAlarmListFrame(frame)).toThrow('checksum');
  });

  it('rejects an alarm count that does not match occupied slots', () => {
    const frame = createManufacturerAlarmListFixture();
    frame[7] = 1;
    frame[103] = sum8(frame.slice(0, -1));
    expect(() => parseAlarmListFrame(frame)).toThrow('does not match');
  });

  it('provides malformed and automatic manufacturer fixtures', () => {
    expect(parseDeviceStatusFrame(manufacturerProtocolFixtures.automaticStatus).sequence).toBe(0xFF);
    expect(() => parseDeviceStatusFrame(manufacturerProtocolFixtures.malformedChecksum)).toThrow('checksum');
    expect(() => parseDeviceStatusFrame(manufacturerProtocolFixtures.malformedHeader)).toThrow('header');
  });

  it.each([
    [13, 2, 'Power'],
    [14, 101, 'Brightness'],
    [17, 101, 'Volume'],
    [18, 26, 'Sound ID'],
    [19, 2, 'Clock Valid'],
    [20, 11, 'Alarm Count'],
    [21, 4, 'Device State'],
  ])('rejects invalid status byte %i', (index, value, field) => {
    expect(() => parseDeviceStatusFrame(statusFrame({ [index]: value }))).toThrow(field);
  });

  it('rejects malformed and unknown notifications', () => {
    const controller = new AckTransactionController(async () => undefined);
    expect(() => dispatchUplinkNotification(new Uint8Array([0xFF]), controller)).toThrow(BleProtocolError);
    expect(() => dispatchUplinkNotification(statusFrame({ 3: 0x55 }), controller)).toThrow('opcode');
    const invalidChecksum = statusFrame();
    invalidChecksum[23] ^= 1;
    expect(() => dispatchUplinkNotification(invalidChecksum, controller)).toThrow('checksum');
  });
});
