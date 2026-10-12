import { sum8 } from './AckFrame';
import {
  createSkipNextAlarmFrame,
  SKIP_NEXT_ALARM_FRAME_LENGTH,
  SKIP_NEXT_ALARM_OPCODE,
  AUDIO_CONTROL_OPCODE,
  createAudioControlFrame,
  clockFrameFromDate,
  createGetStatusFrame,
  createSetBrightnessFrame,
  createSetClockFrame,
  createSetColourTemperatureFrame,
  createSetPowerFrame,
  createSetVolumeFrame,
  GET_STATUS_FRAME_LENGTH,
  SET_BRIGHTNESS_FRAME_LENGTH,
  SET_CLOCK_FRAME_LENGTH,
  SET_COLOUR_TEMPERATURE_FRAME_LENGTH,
  SET_POWER_FRAME_LENGTH,
  SET_VOLUME_FRAME_LENGTH,
  SET_VOLUME_OPCODE,
  UPSERT_ALARM_FRAME_LENGTH,
  READ_ALARMS_FRAME_LENGTH,
  ALARM_SYNC_FRAME_LENGTH,
  DELETE_ALARM_FRAME_LENGTH,
  createUpsertAlarmFrame,
  createReadAlarmsFrame,
  createBeginAlarmSyncFrame,
  createCommitAlarmSyncFrame,
  createDeleteAlarmFrame,
} from './DownlinkFrame';

describe('confirmed app-to-device frames', () => {
  it('creates the confirmed Skip Next 0x1C frame', () => {
    const frame = createSkipNextAlarmFrame({ sequence: 0x2A, alarmIndex: 4, skip: true });
    expect(frame).toEqual(new Uint8Array([0xFF, 0x07, 0x2A, 0x1C, 0x04, 0x01, 0x51]));
    expect(frame[1]).toBe(SKIP_NEXT_ALARM_FRAME_LENGTH);
    expect(frame[3]).toBe(SKIP_NEXT_ALARM_OPCODE);
    expect(frame[6]).toBe(sum8(frame.slice(0, 6)));
  });

  it('creates the clear-skip variant', () => {
    expect(createSkipNextAlarmFrame({ sequence: 0, alarmIndex: 9, skip: false }))
      .toEqual(new Uint8Array([0xFF, 0x07, 0x00, 0x1C, 0x09, 0x00, 0x2B]));
  });

  it.each([
    [{ sequence: -1, alarmIndex: 0, skip: true }, 'Sequence'],
    [{ sequence: 0xFF, alarmIndex: 0, skip: true }, 'Sequence'],
    [{ sequence: 0, alarmIndex: -1, skip: true }, 'Alarm index'],
    [{ sequence: 0, alarmIndex: 10, skip: true }, 'Alarm index'],
  ])('rejects invalid Skip Next input', (input, field) => {
    expect(() => createSkipNextAlarmFrame(input)).toThrow(field);
  });
});

describe('audio frames', () => {
  it('creates an Audio Control 0x09 preview frame', () => {
    // FF 08 05 09 01 03 32 → 255+8+5+9+1+3+50 = 331 → 0x4B
    expect(createAudioControlFrame({ sequence: 5, action: 'preview', soundId: 3, volumePercent: 50 }))
      .toEqual(new Uint8Array([0xFF, 0x08, 0x05, AUDIO_CONTROL_OPCODE, 0x01, 0x03, 0x32, 0x4B]));
  });

  it('creates an Audio Control 0x09 stop frame', () => {
    expect(createAudioControlFrame({ sequence: 0, action: 'stop', soundId: 0, volumePercent: 0 }))
      .toEqual(new Uint8Array([0xFF, 0x08, 0x00, 0x09, 0x00, 0x00, 0x00, 0x10]));
  });

  it('creates a Set Volume 0x08 frame', () => {
    // FF 06 01 08 50 → 255+6+1+8+80 = 350 → 0x5E
    expect(createSetVolumeFrame({ sequence: 1, volumePercent: 80 }))
      .toEqual(new Uint8Array([0xFF, SET_VOLUME_FRAME_LENGTH, 0x01, SET_VOLUME_OPCODE, 0x50, 0x5E]));
  });

  it.each([
    [{ sequence: 0, action: 'preview' as const, soundId: 26, volumePercent: 50 }, 'Sound ID'],
    [{ sequence: 0, action: 'preview' as const, soundId: 1, volumePercent: 101 }, 'Volume'],
    [{ sequence: 0xFF, action: 'stop' as const, soundId: 0, volumePercent: 0 }, 'Sequence'],
  ])('rejects invalid audio input', (input, field) => {
    expect(() => createAudioControlFrame(input)).toThrow(field);
  });
});

describe('v0.9 core control frames', () => {
  it('creates a Set Power 0x05 frame with off as 2', () => {
    const on = createSetPowerFrame({ sequence: 1, power: 'on' });
    const off = createSetPowerFrame({ sequence: 1, power: 'off' });
    expect(on).toEqual(new Uint8Array([0xFF, SET_POWER_FRAME_LENGTH, 0x01, 0x05, 0x01, sum8(on.slice(0, 5))]));
    expect(off[4]).toBe(2);
    expect(off[5]).toBe(sum8(off.slice(0, 5)));
  });

  it('creates a Set Brightness 0x07 frame with the inverse byte', () => {
    const frame = createSetBrightnessFrame({ sequence: 2, brightnessPercent: 50 });
    expect(frame).toEqual(new Uint8Array([0xFF, SET_BRIGHTNESS_FRAME_LENGTH, 0x02, 0x07, 50, 128, sum8(frame.slice(0, 6))]));
  });

  it('creates a Set Colour Temperature 0x04 frame', () => {
    const frame = createSetColourTemperatureFrame({ sequence: 3, white: 255, warmWhite: 0, brightnessPercent: 100 });
    expect(frame).toEqual(new Uint8Array([
      0xFF, SET_COLOUR_TEMPERATURE_FRAME_LENGTH, 0x03, 0x04, 0x01, 0x03, 0xFF, 0x00, 0x00, sum8(frame.slice(0, 9)),
    ]));
  });

  it('creates a Get Status 0x13 query', () => {
    const frame = createGetStatusFrame({ sequence: 4, queryToken: 7 });
    expect(frame).toEqual(new Uint8Array([0xFF, GET_STATUS_FRAME_LENGTH, 0x04, 0x13, 0x07, 0xAA, sum8(frame.slice(0, 6))]));
  });

  it('numbers Monday as 1 and Sunday as 7', () => {
    const sunday = clockFrameFromDate(1, new Date(2026, 9, 4, 9, 0, 0));
    const tuesday = clockFrameFromDate(2, new Date(2026, 9, 6, 11, 30, 0));
    expect(sunday[10]).toBe(7);
    expect(tuesday[10]).toBe(2);
    expect(tuesday[4]).toBe(26);
  });

  it('creates a Set Clock 0x16 frame with the year stored from 2000', () => {
    const frame = createSetClockFrame({
      sequence: 5, year: 2026, month: 10, day: 6, hour: 11, minute: 30, second: 0, weekday: 2,
    });
    expect(frame).toEqual(new Uint8Array([
      0xFF, SET_CLOCK_FRAME_LENGTH, 0x05, 0x16, 26, 10, 6, 11, 30, 0, 2, sum8(frame.slice(0, 11)),
    ]));
  });

  it.each([
    [() => createSetPowerFrame({ sequence: 0xFF, power: 'on' }), 'Sequence'],
    [() => createSetBrightnessFrame({ sequence: 0, brightnessPercent: 101 }), 'Percentage'],
    [() => createSetColourTemperatureFrame({ sequence: 0, white: 256, warmWhite: 0, brightnessPercent: 10 }), 'White'],
    [() => createGetStatusFrame({ sequence: 0, queryToken: 0xFF }), 'Query token'],
    [() => createSetClockFrame({ sequence: 0, year: 1999, month: 1, day: 1, hour: 0, minute: 0, second: 0, weekday: 1 }), 'Year'],
    [() => createSetClockFrame({ sequence: 0, year: 2026, month: 10, day: 6, hour: 11, minute: 30, second: 0, weekday: 0 }), 'Weekday'],
  ])('rejects an invalid core control frame', (create, field) => {
    expect(create).toThrow(field);
  });
});

describe('v0.9 alarm frames', () => {
  const alarm = {
    sequence: 6,
    alarmIndex: 4,
    enabled: true,
    skipNext: true,
    hour: 7,
    minute: 30,
    weekdayMask: 0x1F,
    sunriseMinutes: 30 as const,
    brightnessPercent: 80,
    soundId: 4,
    volumePercent: 45,
  };

  it('creates an upsert 0x17 frame with Monday in bit 0', () => {
    const frame = createUpsertAlarmFrame(alarm);
    expect(frame).toEqual(new Uint8Array([
      0xFF, UPSERT_ALARM_FRAME_LENGTH, 0x06, 0x17,
      0x04, 0x03, 7, 30, 0x1F, 30, 80, 4, 45,
      0, 0, 0, 0,
      sum8(frame.slice(0, 17)),
    ]));
    expect(frame).toHaveLength(18);
  });

  it('leaves both flag bits clear when the alarm is off and not skipped', () => {
    const frame = createUpsertAlarmFrame({ ...alarm, enabled: false, skipNext: false });
    expect(frame[5]).toBe(0);
  });

  it('creates a read-alarms 0x18 query', () => {
    const frame = createReadAlarmsFrame({ sequence: 4, queryToken: 7 });
    expect(frame).toEqual(new Uint8Array([
      0xFF, READ_ALARMS_FRAME_LENGTH, 0x04, 0x18, 0x07, 0xAA, sum8(frame.slice(0, 6)),
    ]));
  });

  it('stores the sync revision as little-endian', () => {
    const begin = createBeginAlarmSyncFrame({ sequence: 1, revision: 0x1234, alarmCount: 2 });
    const commit = createCommitAlarmSyncFrame({ sequence: 1, revision: 0x1234, alarmCount: 2 });
    expect(begin).toEqual(new Uint8Array([
      0xFF, ALARM_SYNC_FRAME_LENGTH, 0x01, 0x19, 0x34, 0x12, 0x02, sum8(begin.slice(0, 7)),
    ]));
    expect(commit[3]).toBe(0x1A);
    expect(commit[4]).toBe(0x34);
    expect(commit[5]).toBe(0x12);
    expect(commit[7]).toBe(sum8(commit.slice(0, 7)));
  });

  it('creates a delete 0x1B frame', () => {
    const frame = createDeleteAlarmFrame({ sequence: 3, alarmIndex: 4 });
    expect(frame).toEqual(new Uint8Array([
      0xFF, DELETE_ALARM_FRAME_LENGTH, 0x03, 0x1B, 0x04, 0xAA, sum8(frame.slice(0, 6)),
    ]));
  });

  it.each([
    [() => createUpsertAlarmFrame({ ...alarm, weekdayMask: 0 }), 'Weekday mask'],
    [() => createUpsertAlarmFrame({ ...alarm, weekdayMask: 0x80 }), 'Weekday mask'],
    [() => createUpsertAlarmFrame({ ...alarm, sunriseMinutes: 20 as 15 }), 'Sunrise'],
    [() => createUpsertAlarmFrame({ ...alarm, alarmIndex: 10 }), 'Alarm index'],
    [() => createReadAlarmsFrame({ sequence: 0, queryToken: 0xFF }), 'Query token'],
    [() => createBeginAlarmSyncFrame({ sequence: 0, revision: 0x10000, alarmCount: 1 }), 'Revision'],
    [() => createCommitAlarmSyncFrame({ sequence: 0, revision: 1, alarmCount: 11 }), 'Alarm count'],
    [() => createDeleteAlarmFrame({ sequence: 0xFF, alarmIndex: 0 }), 'Sequence'],
  ])('rejects an invalid alarm frame', (create, field) => {
    expect(create).toThrow(field);
  });
});
