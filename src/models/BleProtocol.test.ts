import {
  CONNECTION_SYNC_SEQUENCE,
  assertPercent,
  assertSoundId,
  brightnessToInverseRaw,
  validateDeviceAlarmProfile,
} from './BleProtocol';

describe('BLE protocol model', () => {
  it.each([
    [0, 255],
    [1, 252],
    [50, 128],
    [99, 3],
    [100, 0],
  ])('maps %i%% brightness to inverse raw %i', (percent, raw) => {
    expect(brightnessToInverseRaw(percent)).toBe(raw);
  });

  it('rejects invalid percentages and sound IDs', () => {
    expect(() => assertPercent(-1)).toThrow(RangeError);
    expect(() => assertPercent(101)).toThrow(RangeError);
    expect(() => assertSoundId(26)).toThrow(RangeError);
  });

  it('accepts sound IDs 0, 1, and 25', () => {
    expect([0, 1, 25].map(assertSoundId)).toEqual([0, 1, 25]);
  });

  it('validates alarm slots and per-alarm settings', () => {
    expect(validateDeviceAlarmProfile({
      slot: 9,
      sunriseDuration: 30,
      finalBrightness: 100,
      soundId: 25,
      volume: 0,
    }).slot).toBe(9);
    expect(() => validateDeviceAlarmProfile({
      slot: 10,
      sunriseDuration: 30,
      finalBrightness: 100,
      soundId: 25,
      volume: 50,
    })).toThrow(RangeError);
  });

  it('keeps the required connection sequence', () => {
    expect(CONNECTION_SYNC_SEQUENCE.map(step => step.id)).toEqual([
      'secure', 'clock', 'status', 'alarms', 'reconcile',
    ]);
  });
});
