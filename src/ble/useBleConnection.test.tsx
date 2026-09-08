import { act, renderHook } from '@testing-library/react-native';
import { MockBleTransport } from './MockBleTransport';
import { stateAfterConnection, useBleConnection } from './useBleConnection';
import { BleTransportError } from './types';
import { createAckFrame, sum8 } from './AckFrame';
import { STATUS_REPORT_LENGTH, STATUS_REPORT_OPCODE } from './UplinkFrame';
import { createManufacturerAlarmListFixture } from './manufacturerProtocolFixtures';

function automaticStatusFrame(): Uint8Array {
  const frame = new Uint8Array([
    0xFF, STATUS_REPORT_LENGTH, 0xFF, STATUS_REPORT_OPCODE,
    0, 11, 1, 0, 0, 0, 2, 0, 0,
    1, 60, 100, 0, 30, 4, 1, 2, 3, 0, 0,
  ]);
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

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

  it('records malformed manufacturer notifications without treating native hardware as ready', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(new Uint8Array([0xFF])); });
    expect(result.current.protocolError?.code).toBe('invalid_frame_length');
    await act(async () => { transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 })); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('accepts automatic status without sending it to the ACK-only parser', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.protocolError).toBeNull();
    expect(result.current.latestStatus).toMatchObject({
      sequence: 0xFF,
      protocolMinor: 11,
      firmwarePatch: 2,
      power: true,
      brightnessPercent: 60,
      alarmCount: 2,
      deviceState: 3,
    });
    expect(result.current.state).toBe('ready');
    expect(result.current.deviceStatus).toMatchObject({
      isConnected: true,
      isOn: true,
      brightness: 60,
      volume: 30,
      activeSoundId: 4,
      clockValidity: 'valid',
      storedAlarmCount: 2,
      firmwareVersion: '0.0.2+0',
      hardwareVersion: '0',
    });
    await unmount();
  });

  it('stores a parsed alarm list', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(createManufacturerAlarmListFixture()); });
    expect(result.current.latestAlarmList).toMatchObject({ revision: 3, alarmCount: 2 });
    expect(result.current.latestAlarmList?.slots).toHaveLength(10);
    await unmount();
  });

  it('fails clearly when the negotiated MTU is too small', async () => {
    const transport = new MockBleTransport();
    transport.negotiatedMtu = 106;
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('at least 107 bytes');
    await unmount();
  });
});

function nativeTestTransport() {
  const transport = new MockBleTransport();
  Object.defineProperty(transport, 'kind', { value: 'native' });
  return transport;
}

describe('native onboarding readiness', () => {
  it('waits for valid status before allowing native setup to continue', async () => {
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('connected_unverified');
    await act(async () => { transport.emitNotification(new Uint8Array([0xFF])); });
    expect(result.current.state).toBe('connected_unverified');
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.state).toBe('ready');
    expect(result.current.deviceStatus.isConnected).toBe(true);
    await unmount();
  });

  it('does not overwrite status received while subscribing', async () => {
    const transport = nativeTestTransport();
    const subscribe = transport.subscribe.bind(transport);
    jest.spyOn(transport, 'subscribe').mockImplementation((onData, onError) => {
      const unsubscribe = subscribe(onData, onError);
      onData(automaticStatusFrame());
      return unsubscribe;
    });
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('times out a silent device and permits another attempt', async () => {
    jest.useFakeTimers();
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { jest.advanceTimersByTime(20_000); });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('did not send its status');
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.state).toBe('ready');
    await unmount();
    jest.useRealTimers();
  });

  it('clears live device status when disconnected', async () => {
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    await act(async () => { await result.current.disconnect(); });
    expect(result.current.deviceStatus.isConnected).toBe(false);
    expect(result.current.latestStatus).toBeNull();
    expect(result.current.state).toBe('disconnected');
    await unmount();
  });

  it('does not start a scan after cancellation during permission request', async () => {
    const transport = nativeTestTransport();
    let grant!: (value: boolean) => void;
    jest.spyOn(transport, 'requestPermissions').mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const scan = jest.spyOn(transport, 'scan');
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.connect(); });
    await act(async () => { await result.current.disconnect(); });
    await act(async () => { grant(true); await pending; });
    expect(scan).not.toHaveBeenCalled();
    expect(result.current.state).toBe('disconnected');
    await unmount();
  });

  it('clears ready status after a connection error', async () => {
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    await act(async () => { transport.emitError(new Error('Device disconnected')); });
    expect(result.current.state).toBe('failed');
    expect(result.current.deviceStatus.isConnected).toBe(false);
    await unmount();
  });
});
