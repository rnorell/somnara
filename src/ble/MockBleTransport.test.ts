import { ACK_RESULT_CODES } from './AckFrame';
import {
  createAudioControlFrame,
  createBeginAlarmSyncFrame,
  createCommitAlarmSyncFrame,
  createDeleteAlarmFrame,
  createGetStatusFrame,
  createReadAlarmsFrame,
  createSetBrightnessFrame,
  createSetClockFrame,
  createSetColourTemperatureFrame,
  createSetPowerFrame,
  createSkipNextAlarmFrame,
  createUpsertAlarmFrame,
} from './DownlinkFrame';
import { MockBleTransport } from './MockBleTransport';
import { BleTransportError } from './types';

async function answered(transport: MockBleTransport, frame: Uint8Array): Promise<Uint8Array[]> {
  const notes: Uint8Array[] = [];
  await transport.connect(transport.candidate.id);
  transport.subscribe(bytes => notes.push(bytes), () => undefined);
  await jest.advanceTimersByTimeAsync(150);
  notes.length = 0;
  await transport.writeRaw(frame);
  await jest.advanceTimersByTimeAsync(150);
  return notes;
}

describe('MockBleTransport', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('follows the deterministic scan and connection flow', async () => {
    const transport = new MockBleTransport();
    expect(await transport.requestPermissions()).toBe(true);
    const candidate = await transport.scan();
    expect(candidate.id).toBe('mock-somnara-001');
    await transport.connect(candidate.id);
    expect(() => transport.subscribe(() => undefined, () => undefined)).not.toThrow();
    await expect(transport.writeRaw(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    await transport.disconnect();
    await expect(transport.writeRaw(new Uint8Array([1]))).rejects.toThrow('not connected');
  });

  it('refuses the fake device when the phone radio is off', async () => {
    const transport = new MockBleTransport({
      prepareRadio: async () => { throw new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'); },
    });
    await expect(transport.discover()).rejects.toThrow('Turn on Bluetooth');
    await expect(transport.connect(transport.candidate.id)).rejects.toThrow('Turn on Bluetooth');
  });

  it('drops an open link when the phone radio turns off', async () => {
    const watch: { onLost: ((error: Error) => void) | null } = { onLost: null };
    const transport = new MockBleTransport({
      watchRadio: listener => {
        watch.onLost = listener;
        return () => { watch.onLost = null; };
      },
    });
    const errors: Error[] = [];
    await transport.connect(transport.candidate.id);
    transport.subscribe(() => undefined, error => errors.push(error));
    watch.onLost?.(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'));
    expect(errors[0]).toMatchObject({ code: 'bluetooth_off' });
    await expect(transport.writeRaw(new Uint8Array([1]))).rejects.toThrow('not connected');
  });

  it('ignores a radio loss after the user disconnects', async () => {
    const watch: { onLost: ((error: Error) => void) | null } = { onLost: null };
    const transport = new MockBleTransport({
      watchRadio: listener => {
        watch.onLost = listener;
        return () => { watch.onLost = null; };
      },
    });
    const errors: Error[] = [];
    await transport.connect(transport.candidate.id);
    transport.subscribe(() => undefined, error => errors.push(error));
    await transport.disconnect();
    expect(watch.onLost).toBeNull();
    expect(errors).toHaveLength(0);
  });

  it('answers power, brightness, colour, clock, and status with ACK then status', async () => {
    const transport = new MockBleTransport({ simulateDevice: true });
    const power = await answered(transport, createSetPowerFrame({ sequence: 1, power: 'off' }));
    expect(power[0][3]).toBe(0x7F);
    expect(power[0][5]).toBe(ACK_RESULT_CODES.OK);
    expect(power[1][3]).toBe(0x13);
    expect(power[1][13]).toBe(0);

    const brightness = await answered(new MockBleTransport({ simulateDevice: true }), createSetBrightnessFrame({ sequence: 2, brightnessPercent: 50 }));
    expect(brightness[1][14]).toBe(50);

    const colour = await answered(new MockBleTransport({ simulateDevice: true }), createSetColourTemperatureFrame({
      sequence: 3, white: 10, warmWhite: 200, brightnessPercent: 100,
    }));
    expect(colour[1][14]).toBe(100);
    expect(colour[1][15]).toBe(10);
    expect(colour[1][16]).toBe(200);

    const clock = await answered(new MockBleTransport({ simulateDevice: true }), createSetClockFrame({
      sequence: 4, year: 2026, month: 10, day: 6, hour: 11, minute: 30, second: 0, weekday: 2,
    }));
    expect(clock[1][19]).toBe(1);

    const status = await answered(new MockBleTransport({ simulateDevice: true }), createGetStatusFrame({ sequence: 5, queryToken: 1 }));
    expect(status[0][4]).toBe(0x13);
    expect(status[1][3]).toBe(0x13);
  });

  it('reports a missing sound and stays busy until the first command finishes', async () => {
    const transport = new MockBleTransport({ simulateDevice: true });
    const notes: Uint8Array[] = [];
    await transport.connect(transport.candidate.id);
    transport.subscribe(bytes => notes.push(bytes), () => undefined);
    await jest.advanceTimersByTimeAsync(150);
    notes.length = 0;

    const preview = createAudioControlFrame({ sequence: 1, action: 'preview', soundId: 1, volumePercent: 20 });
    preview[5] = 26;
    preview[preview.length - 1] = preview.slice(0, -1).reduce((sum, byte) => (sum + byte) & 0xFF, 0);
    await transport.writeRaw(preview);
    await transport.writeRaw(createSetPowerFrame({ sequence: 2, power: 'off' }));
    await jest.advanceTimersByTimeAsync(150);

    expect(notes[0][5]).toBe(ACK_RESULT_CODES.AUDIO_NOT_FOUND);
    expect(notes[1][5]).toBe(ACK_RESULT_CODES.BUSY);
    expect(notes.some(frame => frame[3] === 0x13 && frame[13] === 0)).toBe(false);
  });

  it('rejects a bad brightness value and does not change the light', async () => {
    const transport = new MockBleTransport({ simulateDevice: true });
    const frame = createSetBrightnessFrame({ sequence: 1, brightnessPercent: 40 });
    frame[4] = 101;
    frame[frame.length - 1] = frame.slice(0, -1).reduce((sum, byte) => (sum + byte) & 0xFF, 0);
    const notes = await answered(transport, frame);
    expect(notes[0][5]).toBe(ACK_RESULT_CODES.INVALID_VALUE);
    expect(notes).toHaveLength(1);
  });

  it('keeps one alarm, stages a full list until commit, and rejects a bad clock', async () => {
    const transport = new MockBleTransport({ simulateDevice: true });
    const notes: Uint8Array[] = [];
    await transport.connect(transport.candidate.id);
    transport.subscribe(bytes => notes.push(bytes), () => undefined);
    await jest.advanceTimersByTimeAsync(150);

    const send = async (frame: Uint8Array) => {
      notes.length = 0;
      await transport.writeRaw(frame);
      await jest.advanceTimersByTimeAsync(150);
      return notes.slice();
    };
    const alarm = {
      sequence: 1, alarmIndex: 0, enabled: true, skipNext: false, hour: 7, minute: 30,
      weekdayMask: 0x01, sunriseMinutes: 30 as const, brightnessPercent: 80, soundId: 0, volumePercent: 40,
    };

    const saved = await send(createUpsertAlarmFrame(alarm));
    expect(saved.map(frame => frame[3])).toEqual([0x7F, 0x18]);
    expect(saved[0][5]).toBe(ACK_RESULT_CODES.OK);
    expect(saved[1][4]).toBe(0);
    expect(saved[1][11]).toBe(0x03);
    expect(saved[1][12]).toBe(7);

    const listed = await send(createReadAlarmsFrame({ sequence: 2, queryToken: 1 }));
    expect(listed).toHaveLength(2);
    expect(listed[1]).toHaveLength(104);
    expect(listed[1][7]).toBe(1);

    const status = await send(createGetStatusFrame({ sequence: 3, queryToken: 1 }));
    expect(status[1][20]).toBe(1);

    const begun = await send(createBeginAlarmSyncFrame({ sequence: 4, revision: 0x0102, alarmCount: 1 }));
    expect(begun).toHaveLength(1);
    expect(begun[0][5]).toBe(ACK_RESULT_CODES.OK);
    const staged = await send(createUpsertAlarmFrame({ ...alarm, sequence: 5, alarmIndex: 3, hour: 8 }));
    expect(staged[1][7]).toBe(1);
    expect(staged[1][12]).toBe(7);
    const during = await send(createReadAlarmsFrame({ sequence: 6, queryToken: 2 }));
    expect(during[during.length - 1][7]).toBe(1);
    expect(during.some(frame => frame[4] === 3)).toBe(false);

    const committed = await send(createCommitAlarmSyncFrame({ sequence: 7, revision: 0x0102, alarmCount: 1 }));
    expect(committed[0][5]).toBe(ACK_RESULT_CODES.OK);
    expect(committed[1][4]).toBe(0);
    expect(committed[1][5]).toBe(0x02);
    expect(committed[1][6]).toBe(0x01);
    expect(committed[1][7]).toBe(1);
    const replaced = await send(createReadAlarmsFrame({ sequence: 8, queryToken: 3 }));
    expect(replaced).toHaveLength(2);
    expect(replaced[1][38]).toBe(0x03);
    expect(replaced[1][39]).toBe(8);

    const conflict = await send(createCommitAlarmSyncFrame({ sequence: 9, revision: 0x0102, alarmCount: 1 }));
    expect(conflict[0][5]).toBe(ACK_RESULT_CODES.SYNC_CONFLICT);
    expect(conflict).toHaveLength(1);

    const limited = createBeginAlarmSyncFrame({ sequence: 10, revision: 1, alarmCount: 0 });
    limited[6] = 11;
    limited[limited.length - 1] = limited.slice(0, -1).reduce((sum, byte) => (sum + byte) & 0xFF, 0);
    expect((await send(limited))[0][5]).toBe(ACK_RESULT_CODES.ALARM_LIMIT);

    const invalid = createUpsertAlarmFrame({ ...alarm, sequence: 11 });
    invalid[9] = 20;
    invalid[invalid.length - 1] = invalid.slice(0, -1).reduce((sum, byte) => (sum + byte) & 0xFF, 0);
    expect((await send(invalid))[0][5]).toBe(ACK_RESULT_CODES.INVALID_VALUE);
    expect((await send(createReadAlarmsFrame({ sequence: 12, queryToken: 4 })))[1][39]).toBe(8);

    (transport as unknown as { clockValid: boolean }).clockValid = false;
    expect((await send(createDeleteAlarmFrame({ sequence: 13, alarmIndex: 3 })))[0][5]).toBe(ACK_RESULT_CODES.CLOCK_INVALID);
    expect((await send(createReadAlarmsFrame({ sequence: 14, queryToken: 5 })))).toHaveLength(2);
    await send(createSetClockFrame({
      sequence: 15, year: 2026, month: 10, day: 8, hour: 9, minute: 0, second: 0, weekday: 4,
    }));
    expect((await send(createSkipNextAlarmFrame({ sequence: 16, alarmIndex: 3, skip: true })))[1][38]).toBe(0x07);
    expect((await send(createDeleteAlarmFrame({ sequence: 17, alarmIndex: 3 })))).toHaveLength(1);
    expect((await send(createReadAlarmsFrame({ sequence: 18, queryToken: 6 })))).toHaveLength(2);

    await send(createUpsertAlarmFrame({ ...alarm, sequence: 19 }));
    await transport.disconnect();
    await transport.connect(transport.candidate.id);
    transport.subscribe(bytes => notes.push(bytes), () => undefined);
    await jest.advanceTimersByTimeAsync(150);
    const restored = await send(createReadAlarmsFrame({ sequence: 20, queryToken: 7 }));
    expect(restored).toHaveLength(2);
    expect(restored[1][4]).toBe(0);
  });

  it('rejects work after destroy', async () => {
    const transport = new MockBleTransport();
    await transport.destroy();
    await expect(transport.scan()).rejects.toThrow('closed');
  });
});
