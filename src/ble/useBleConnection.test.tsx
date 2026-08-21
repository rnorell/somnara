import { act, renderHook } from '@testing-library/react-native';
import { MockBleTransport } from './MockBleTransport';
import { stateAfterConnection, useBleConnection } from './useBleConnection';
import { BleTransportError } from './types';

describe('useBleConnection', () => {
  it('lets the development mock reach ready', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('shows permission_required when access is denied', async () => {
    const transport = new MockBleTransport();
    jest.spyOn(transport, 'requestPermissions').mockResolvedValue(false);
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('permission_required');
    await unmount();
  });

  it('never treats a native connection as protocol-ready', () => {
    expect(stateAfterConnection('native', true)).toBe('connected_unverified');
    expect(stateAfterConnection('mock', false)).toBe('connected_unverified');
  });

  it('reports scan timeout and cleans up its transport', async () => {
    const transport = new MockBleTransport();
    jest.spyOn(transport, 'scan').mockRejectedValue(new BleTransportError('scan_timeout', 'No Somnara was found.'));
    const destroy = jest.spyOn(transport, 'destroy');
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toBe('No Somnara was found.');
    await unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('moves a connected transport to disconnected', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { await result.current.disconnect(); });
    expect(result.current.state).toBe('disconnected');
    await unmount();
  });
});
