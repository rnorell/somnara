import { connectionStatusLabel } from './connectionStatus';

describe('connectionStatusLabel', () => {
  it('names each recoverable connection problem', () => {
    expect(connectionStatusLabel('permission_required', 'permission_required', false)).toBe('Permission needed');
    expect(connectionStatusLabel('bluetooth_off', 'bluetooth_off', false)).toBe('Bluetooth is off');
    expect(connectionStatusLabel('failed', 'scan_timeout', false)).toBe('No device found');
    expect(connectionStatusLabel('failed', 'connection_failed', false)).toBe("Couldn't connect");
  });

  it('returns to a normal label once the failure is cleared', () => {
    expect(connectionStatusLabel('disconnected', null, false)).toBe('Disconnected');
    expect(connectionStatusLabel('disconnected', null, true)).toBe('Choose a device');
    expect(connectionStatusLabel('ready', null, false)).toBe('Connected');
  });
});
