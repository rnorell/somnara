import { createManufacturerStatusFixture } from '../ble/manufacturerProtocolFixtures';
import { parseDeviceStatusFrame } from '../ble/UplinkFrame';
import { applyBleStatusReport, initialDeviceStatus } from './deviceStore';

describe('device BLE state mapping', () => {
  it('maps confirmed status fields into app device state', () => {
    const result = applyBleStatusReport(initialDeviceStatus, parseDeviceStatusFrame(createManufacturerStatusFixture()));
    expect(result).toMatchObject({
      isConnected: true,
      isOn: true,
      brightness: 60,
      volume: 30,
      activeSoundId: 4,
      playbackState: 'unknown',
      clockValidity: 'valid',
      storedAlarmCount: 2,
      firmwareVersion: '0.0.2+0',
      hardwareVersion: '0',
    });
  });
});
