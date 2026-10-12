import { act, renderHook } from '@testing-library/react-native';
import { MockBleTransport } from './MockBleTransport';
import { stateAfterConnection, useBleConnection } from './useBleConnection';
import { BleTransportError } from './types';
import { createAckFrame, sum8 } from './AckFrame';
import { createSetBrightnessFrame, createSetPowerFrame, createSetVolumeFrame, SET_BRIGHTNESS_OPCODE, SET_POWER_OPCODE, SET_VOLUME_OPCODE } from './DownlinkFrame';
import { STATUS_REPORT_LENGTH, STATUS_REPORT_OPCODE } from './UplinkFrame';
import { createManufacturerAlarmListFrames } from './manufacturerProtocolFixtures';

function automaticStatusFrame(): Uint8Array {
  const frame = new Uint8Array([
    0xFF, STATUS_REPORT_LENGTH, 0xFF, STATUS_REPORT_OPCODE,
    1, 60, 100, 0, 30, 4, 1, 2, 0, 0,
  ]);
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

describe('useBleConnection', () => {
  it('lets the development mock reach ready', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('sets the clock and reads status when the mock device answers', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 6, 11, 30, 0));
    const transport = new MockBleTransport({ simulateDevice: true });
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => {
      const pending = result.current.connect(transport.candidate.id);
      await jest.advanceTimersByTimeAsync(500);
      await pending;
    });
    const commands = transport.writtenFrames.filter(frame => frame[3] === 0x16 || frame[3] === 0x13);
    expect(commands.map(frame => frame[3])).toEqual([0x16, 0x13]);
    expect(commands[0][4]).toBe(26);
    expect(commands[0][5]).toBe(10);
    expect(commands[0][6]).toBe(6);
    expect(commands[0][10]).toBe(2);
    expect(result.current.deviceStatus.clockValidity).toBe('valid');
    expect(result.current.state).toBe('ready');
    await unmount();
    jest.useRealTimers();
  });

  it('sends power and brightness to the connected device', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });

    let powering!: Promise<void>;
    await act(async () => { powering = result.current.setPower(false); });
    expect(transport.writtenFrames.at(-1)).toEqual(createSetPowerFrame({ sequence: 0, power: 'off' }));
    await act(async () => {
      transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: SET_POWER_OPCODE, resultCode: 0, detail: 0 }));
      await powering;
    });

    let dimming!: Promise<void>;
    await act(async () => { dimming = result.current.setBrightness(40); });
    expect(transport.writtenFrames.at(-1)).toEqual(createSetBrightnessFrame({ sequence: 1, brightnessPercent: 40 }));
    await act(async () => {
      transport.emitNotification(createAckFrame({ sequence: 1, requestOpcode: SET_BRIGHTNESS_OPCODE, resultCode: 0, detail: 0 }));
      await dimming;
    });
    expect(result.current.commandPending).toBe(false);
    await unmount();
  });

  it('keeps status notifications and writes on the selected device', async () => {
    const transport = new MockBleTransport();
    const subscribe = jest.spyOn(transport, 'subscribe');
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));

    await expect(result.current.setVolume(40)).rejects.toThrow('Connect to Somnara first.');
    expect(transport.writtenFrames).toHaveLength(0);
    expect(subscribe).not.toHaveBeenCalled();

    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.connectedDevice?.id).toBe(transport.candidate.id);
    expect(subscribe).toHaveBeenCalledTimes(1);

    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.deviceStatus.isConnected).toBe(true);

    let setting!: Promise<void>;
    await act(async () => { setting = result.current.setVolume(40); });
    expect(transport.writtenFrames.at(-1)).toEqual(createSetVolumeFrame({ sequence: 0, volumePercent: 40 }));

    await act(async () => {
      transport.emitNotification(createAckFrame({
        sequence: 0, requestOpcode: SET_VOLUME_OPCODE, resultCode: 0, detail: 0,
      }));
      await setting;
    });
    expect(result.current.commandPending).toBe(false);
    await unmount();
  });

  it('shows Bluetooth off, then allows another scan', async () => {
    const transport = new MockBleTransport();
    jest.spyOn(transport, 'discover')
      .mockRejectedValueOnce(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.'));
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('bluetooth_off');
    expect(result.current.failureCode).toBe('bluetooth_off');
    expect(result.current.error).toBe('Turn on Bluetooth and try again.');
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('disconnected');
    expect(result.current.failureCode).toBeNull();
    expect(result.current.foundDevices).toEqual([transport.candidate]);
    await unmount();
  });

  it('shows a missed scan, then allows another scan', async () => {
    const transport = new MockBleTransport();
    jest.spyOn(transport, 'discover')
      .mockRejectedValueOnce(new BleTransportError('scan_timeout', 'No Somnara was found.'));
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.state).toBe('failed');
    expect(result.current.failureCode).toBe('scan_timeout');
    await act(async () => { await result.current.connect(); });
    expect(result.current.failureCode).toBeNull();
    expect(result.current.foundDevices).toEqual([transport.candidate]);
    await unmount();
  });

  it('shows permission_required when access is denied', async () => {
    const transport = new MockBleTransport();
    jest.spyOn(transport, 'requestPermissions').mockResolvedValue(false);
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.state).toBe('permission_required');
    await unmount();
  });

  it('never treats a native connection as protocol-ready', () => {
    expect(stateAfterConnection('native', true)).toBe('connected_unverified');
    expect(stateAfterConnection('mock', false)).toBe('connected_unverified');
  });

  it('lists the mock device and does not connect until one is chosen', async () => {
    const transport = new MockBleTransport();
    const connect = jest.spyOn(transport, 'connect');
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(); });
    expect(result.current.foundDevices).toEqual([transport.candidate]);
    expect(result.current.state).toBe('disconnected');
    expect(connect).not.toHaveBeenCalled();
    await unmount();
  });

  it('reconnects to a known device without scanning', async () => {
    const transport = new MockBleTransport();
    const scan = jest.spyOn(transport, 'scan');
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(scan).not.toHaveBeenCalled();
    expect(result.current.connectedDevice?.id).toBe(transport.candidate.id);
    await unmount();
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
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { await result.current.disconnect(); });
    expect(result.current.state).toBe('disconnected');
    expect(result.current.failureCode).toBeNull();
    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('records malformed manufacturer notifications without treating native hardware as ready', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { transport.emitNotification(new Uint8Array([0xFF])); });
    expect(result.current.protocolError?.code).toBe('invalid_frame_length');
    await act(async () => { transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 })); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('accepts automatic status without sending it to the ACK-only parser', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.protocolError).toBeNull();
    expect(result.current.latestStatus).toMatchObject({
      sequence: 0xFF,
      power: true,
      brightnessPercent: 60,
      volumePercent: 30,
      soundId: 4,
      alarmCount: 2,
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
      firmwareVersion: null,
      hardwareVersion: null,
    });
    await unmount();
  });

  it('stores a parsed alarm list', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => {
      createManufacturerAlarmListFrames().forEach(frame => transport.emitNotification(frame));
    });
    expect(result.current.latestAlarmList).toMatchObject({ revision: 3, alarmCount: 2 });
    expect(result.current.latestAlarmList?.slots).toHaveLength(2);
    expect(result.current.latestAlarmList?.slots[1].skipNext).toBe(true);
    await unmount();
  });

  it('fails clearly when the negotiated MTU is too small', async () => {
    const transport = new MockBleTransport();
    transport.negotiatedMtu = 106;
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
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
    await act(async () => { await result.current.connect(transport.candidate.id); });
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
    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.state).toBe('ready');
    await unmount();
  });

  it('times out a silent device and permits another attempt', async () => {
    jest.useFakeTimers();
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { jest.advanceTimersByTime(20_000); });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toContain('did not send its status');
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    expect(result.current.state).toBe('ready');
    await unmount();
    jest.useRealTimers();
  });

  it('clears live device status when disconnected', async () => {
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
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

  it('reconnects the same device after the open link drops', async () => {
    const watch: { onLost: ((error: Error) => void) | null } = { onLost: null };
    const transport = new MockBleTransport({
      watchRadio: listener => {
        watch.onLost = listener;
        return () => { watch.onLost = null; };
      },
    });
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    await act(async () => { watch.onLost?.(new BleTransportError('bluetooth_off', 'Turn on Bluetooth and try again.')); });
    expect(result.current.state).toBe('bluetooth_off');
    expect(result.current.deviceStatus.isConnected).toBe(false);
    expect(result.current.connectedDevice).toBeNull();
    expect(watch.onLost).toBeNull();

    await act(async () => { await result.current.connect(transport.candidate.id); });
    expect(result.current.state).toBe('ready');
    expect(result.current.connectedDevice?.id).toBe(transport.candidate.id);
    expect(result.current.error).toBeNull();
    expect(result.current.failureCode).toBeNull();
    await unmount();
  });

  it('sends one alarm and can replace the whole set', async () => {
    jest.useFakeTimers();
    const transport = new MockBleTransport({ simulateDevice: true });
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => {
      const pending = result.current.connect(transport.candidate.id);
      await jest.advanceTimersByTimeAsync(800);
      await pending;
    });
    const alarm = {
      alarmIndex: 0, enabled: true, skipNext: false, hour: 7, minute: 30,
      weekdayMask: 0x1F, sunriseMinutes: 30 as const, brightnessPercent: 80, soundId: 0, volumePercent: 30,
    };
    const before = transport.writtenFrames.length;
    await act(async () => {
      const pending = result.current.upsertDeviceAlarm(alarm);
      await jest.advanceTimersByTimeAsync(800);
      await pending;
    });
    expect(transport.writtenFrames.slice(before).map(frame => frame[3])).toEqual([0x17, 0x13, 0x18]);
    expect(result.current.deviceAlarmList?.alarmCount).toBe(1);

    const replaceFrom = transport.writtenFrames.length;
    await act(async () => {
      const pending = result.current.replaceDeviceAlarms([alarm, { ...alarm, alarmIndex: 1, hour: 8 }]);
      await jest.advanceTimersByTimeAsync(1500);
      await pending;
    });
    expect(transport.writtenFrames.slice(replaceFrom).map(frame => frame[3])).toEqual([0x19, 0x17, 0x17, 0x1A, 0x13, 0x18]);
    expect(result.current.deviceAlarmList?.slots.map(slot => slot.index)).toEqual([0, 1]);
    await unmount();
    jest.useRealTimers();
  });

  it('clears ready status after a connection error', async () => {
    const transport = nativeTestTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await act(async () => { await result.current.connect(transport.candidate.id); });
    await act(async () => { transport.emitNotification(automaticStatusFrame()); });
    await act(async () => { transport.emitError(new Error('Device disconnected')); });
    expect(result.current.state).toBe('failed');
    expect(result.current.deviceStatus.isConnected).toBe(false);
    await unmount();
  });
});
