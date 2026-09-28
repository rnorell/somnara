import { readoutRows } from './DeviceReadout';
import { parseAlarmListFrame, parseDeviceStatusFrame } from '../ble/UplinkFrame';
import { manufacturerProtocolFixtures } from '../ble/manufacturerProtocolFixtures';

test('lists every status field reported by the device', () => {
  const status = parseDeviceStatusFrame(manufacturerProtocolFixtures.automaticStatus);
  const rows = Object.fromEntries(readoutRows('ready', status, null, 4));
  expect(rows['Connection']).toBe('ready');
  expect(rows['Firmware']).toBe(`${status.firmwareMajor}.${status.firmwareMinor}.${status.firmwarePatch} (build ${status.firmwareBuild})`);
  expect(rows['Selected sound ID']).toBe(String(status.soundId));
  expect(rows['Volume']).toBe(`${status.volumePercent}%`);
  expect(rows['Alarms on device']).toBe(String(status.alarmCount));
  expect(rows['App playing sound']).toBe('4');
});

test('lists occupied alarm slots from the device alarm list', () => {
  const alarmList = parseAlarmListFrame(manufacturerProtocolFixtures.alarmList);
  const rows = Object.fromEntries(readoutRows('ready', null, alarmList, null));
  expect(rows['Status report']).toBe('None received yet');
  expect(rows['Device alarm slot 0']).toMatch(/^07:30 · days 0x3E · sound 4 · on/);
  expect(rows['Device alarm slot 1']).toMatch(/^08:15 · days 0x41 · sound 5/);
});
