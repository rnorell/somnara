import { PermissionsAndroid, Platform } from 'react-native';
import { requestBluetoothPermissions } from './requestBluetoothPermissions';



jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual, 'Platform', { value: { OS: 'android', Version: 31 }, configurable: true });
  return actual;
});

const platform = Platform as unknown as { OS: string; Version: number };
const request = jest.spyOn(PermissionsAndroid, 'requestMultiple') as jest.Mock;
beforeEach(() => { platform.OS = 'android'; platform.Version = 31; request.mockReset(); });

it('requests Nearby Devices before Android 12+ scans', async () => {
  request.mockResolvedValue({ 'android.permission.BLUETOOTH_SCAN': 'granted', 'android.permission.BLUETOOTH_CONNECT': 'granted' });
  expect(await requestBluetoothPermissions()).toBe(true);
  expect(request).toHaveBeenCalledWith([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
});
it('does not proceed with partially denied permissions', async () => {
  request.mockResolvedValue({ 'android.permission.BLUETOOTH_SCAN': 'granted', 'android.permission.BLUETOOTH_CONNECT': 'denied' });
  expect(await requestBluetoothPermissions()).toBe(false);
});
it('requests location on older Android versions', async () => {
  platform.Version = 30;
  request.mockResolvedValue({ 'android.permission.ACCESS_FINE_LOCATION': 'granted' });
  expect(await requestBluetoothPermissions()).toBe(true);
  expect(request).toHaveBeenCalledWith([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
});
it('leaves iOS authorization to CoreBluetooth', async () => {
  platform.OS = 'ios';
  expect(await requestBluetoothPermissions()).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
