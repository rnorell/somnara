import { PermissionsAndroid, Platform } from 'react-native';

/** Shared by the control and OTA scanners. Matches app.json's BLE plugin. */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = Number(Platform.Version);
  if (apiLevel < 23) return true;
  const permissions = apiLevel >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}
