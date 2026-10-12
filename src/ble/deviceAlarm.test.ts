import { daysFromWeekdayMask, deviceAlarmWrite, mergeReadAlarms, nextDeviceSlot, weekdayMaskFromDays } from './deviceAlarm';
import { AlarmListReport } from './UplinkFrame';

const alarm = {
  id: 'a1', hour: 6, minute: 30, days: [1, 2, 3, 4, 5], enabled: true, label: 'Sunrise alarm',
};

test('maps Monday to bit 0 and Sunday to bit 6', () => {
  expect(weekdayMaskFromDays([1, 2, 3, 4, 5])).toBe(0x1F);
  expect(weekdayMaskFromDays([0, 6])).toBe(0x60);
  expect(daysFromWeekdayMask(0x1F)).toEqual([1, 2, 3, 4, 5]);
  expect(daysFromWeekdayMask(0x40)).toEqual([0]);
});

test('fills the protocol fields the alarm form does not ask for', () => {
  expect(deviceAlarmWrite(alarm, 2, 30, 40)).toMatchObject({
    alarmIndex: 2, weekdayMask: 0x1F, sunriseMinutes: 30, brightnessPercent: 80, soundId: 0, volumePercent: 40, skipNext: false,
  });
});

test('keeps a phone label when the device reads the same slot back', () => {
  const report = {
    sequence: 1, revision: 4, alarmCount: 1,
    slots: [{
      index: 2, occupied: true, enabled: false, skipNext: true, hour: 7, minute: 15,
      weekdayMask: 0x01, sunriseMinutes: 15, brightnessPercent: 50, soundId: 0, volumePercent: 20,
    }],
  } satisfies AlarmListReport;
  const merged = mergeReadAlarms([{ ...alarm, deviceSlot: 2 }, { ...alarm, id: 'local', deviceSlot: null }], report);
  expect(merged[0]).toMatchObject({ id: 'a1', label: 'Sunrise alarm', deviceSlot: 2, hour: 7, enabled: false, skipNext: true });
  expect(merged[1].id).toBe('local');
});

test('uses the lowest free slot', () => {
  expect(nextDeviceSlot([{ ...alarm, deviceSlot: 0 }, { ...alarm, id: 'b', deviceSlot: 1 }])).toBe(2);
  expect(nextDeviceSlot([{ ...alarm, deviceSlot: 0 }], 'a1')).toBe(0);
});
