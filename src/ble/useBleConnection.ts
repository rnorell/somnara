import { useCallback, useEffect, useRef, useState } from 'react';
import { createBleTransport } from './createBleTransport';
import { BleConnectionState, BleTransport, BleTransportError, BleTransportErrorCode } from './types';
import { AckTransactionController } from './AckTransactionController';
import { ACK_RESULT_CODES, AckResult, BleProtocolError } from './AckFrame';
import {
  AUDIO_CONTROL_OPCODE,
  BEGIN_ALARM_SYNC_OPCODE,
  clockFrameFromDate,
  COMMIT_ALARM_SYNC_OPCODE,
  createAudioControlFrame,
  createBeginAlarmSyncFrame,
  createCommitAlarmSyncFrame,
  createDeleteAlarmFrame,
  createGetStatusFrame,
  createReadAlarmsFrame,
  createSetBrightnessFrame,
  createSetPowerFrame,
  createSetVolumeFrame,
  createSkipNextAlarmFrame,
  createUpsertAlarmFrame,
  DELETE_ALARM_OPCODE,
  GET_STATUS_OPCODE,
  READ_ALARMS_OPCODE,
  SET_BRIGHTNESS_OPCODE,
  SET_CLOCK_OPCODE,
  SET_POWER_OPCODE,
  SET_VOLUME_OPCODE,
  SKIP_NEXT_ALARM_OPCODE,
  UPSERT_ALARM_OPCODE,
} from './DownlinkFrame';
import { DeviceAlarmWrite, MAX_DEVICE_ALARMS } from './deviceAlarm';
import { AlarmListReader, AlarmListReport, applyAlarmRecord, DeviceStatusReport, dispatchUplinkNotification, MINIMUM_ALARM_LIST_MTU } from './UplinkFrame';
import { DeviceStatus } from '../models/Device';
import { applyBleStatusReport, initialDeviceStatus } from '../state/deviceStore';

export function stateAfterConnection(kind: BleTransport['kind'], allowMockReady: boolean): BleConnectionState {
  return kind === 'mock' && allowMockReady ? 'ready' : 'connected_unverified';
}

export function ackFailureMessage(result: AckResult): string {
  switch (result.resultCode) {
    case ACK_RESULT_CODES.AUDIO_NOT_FOUND: return 'That sound is not installed on this Somnara.';
    case ACK_RESULT_CODES.NOT_BONDED: return 'Somnara is not paired with this phone. Reconnect and accept the pairing prompt.';
    case ACK_RESULT_CODES.BUSY: return 'Somnara is busy. Try again in a moment.';
    case ACK_RESULT_CODES.INVALID_VALUE: return 'Somnara rejected that value.';
    default: return `Somnara could not complete the command (${result.resultName}).`;
  }
}

export function useBleConnection(transportFactory: () => BleTransport = createBleTransport) {
  const transportRef = useRef<BleTransport | null>(null);
  const transportFactoryRef = useRef(transportFactory);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const attemptRef = useRef(0);
  const connectingRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmReaderRef = useRef(new AlarmListReader());
  const alarmListRef = useRef<AlarmListReport | null>(null);
  const [state, setState] = useState<BleConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<BleTransportErrorCode | null>(null);
  const [protocolError, setProtocolError] = useState<BleProtocolError | null>(null);
  const [latestStatus, setLatestStatus] = useState<DeviceStatusReport | null>(null);
  const [latestAlarmList, setLatestAlarmList] = useState<AlarmListReport | null>(null);
  const [deviceAlarmList, setDeviceAlarmList] = useState<AlarmListReport | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(initialDeviceStatus);
  const controllerRef = useRef<AckTransactionController | null>(null);
  // What the app last successfully asked the device to play. Status 0x13 reports
  // the selected sound ID but has no explicit playing/stopped field.
  const [playingSoundId, setPlayingSoundId] = useState<number | null>(null);
  const [commandPending, setCommandPending] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<{ id: string; name: string | null } | null>(null);
  const [foundDevices, setFoundDevices] = useState<{ id: string; name: string | null }[]>([]);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
  }, []);

  const clearSession = useCallback(() => {
    clearStatusTimer();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    controllerRef.current?.cancel();
    controllerRef.current = null;
    alarmReaderRef.current.clear();
    alarmListRef.current = null;
  }, [clearStatusTimer]);

  const disconnect = useCallback(async () => {
    ++attemptRef.current;
    clearSession();
    if (activeRef.current) {
      setState('disconnected');
      setPlayingSoundId(null);
      setConnectedDevice(null);
      setFailureCode(null);
      setDeviceStatus(initialDeviceStatus);
      setLatestStatus(null);
      setLatestAlarmList(null);
      setError(null);
      setProtocolError(null);
    }
    await transportRef.current?.disconnect();
  }, [clearSession]);

  const connect = useCallback(async (preferredDeviceId?: string) => {
    const transport = transportRef.current;
    if (!transport || connectingRef.current) return;
    connectingRef.current = true;
    const attempt = ++attemptRef.current;
    const current = () => activeRef.current && attemptRef.current === attempt;
    clearSession();
    setError(null);
    setFailureCode(null);
    setProtocolError(null);
    setLatestStatus(null);
    setLatestAlarmList(null);
    setDeviceStatus(initialDeviceStatus);
    setPlayingSoundId(null);
    setConnectedDevice(null);
    if (!preferredDeviceId) setFoundDevices([]);
    setState(preferredDeviceId ? 'connecting' : 'scanning');
    const fail = (failure: unknown) => {
      if (!current()) return;
      ++attemptRef.current;
      clearSession();
      setConnectedDevice(null);
      setDeviceStatus(initialDeviceStatus);
      setLatestStatus(null);
      setLatestAlarmList(null);
      const code = failure instanceof BleTransportError ? failure.code : null;
      setFailureCode(code);
      setError(failure instanceof Error ? failure.message : 'Could not connect to Somnara.');
      setState(code === 'permission_required' ? 'permission_required' : code === 'bluetooth_off' ? 'bluetooth_off' : 'failed');
      void transport.disconnect().catch(() => undefined);
    };
    try {
      await transport.disconnect();
      if (!current()) return;
      const permitted = await transport.requestPermissions();
      if (!current()) return;
      if (!permitted) throw new BleTransportError('permission_required', 'Allow Bluetooth access in Settings, then try again.');
      if (!preferredDeviceId) {
        const found = await transport.discover();
        if (!current()) return;
        setFoundDevices(found);
        setState('disconnected');
        return;
      }
      const candidate = { id: preferredDeviceId, name: null as string | null };
      if (!current()) return;
      setState('connecting');
      await transport.connect(candidate.id);
      if (current()) setConnectedDevice({ id: candidate.id, name: candidate.name });
      if (!current()) { await transport.disconnect(); return; }
      await transport.negotiateMtu(MINIMUM_ALARM_LIST_MTU);
      if (!current()) { await transport.disconnect(); return; }
      controllerRef.current = new AckTransactionController(
        bytes => transport.writeRaw(bytes),
        { onProtocolError: nextError => current() && setProtocolError(nextError) },
      );
      // Set the waiting state first: a synchronous status callback must not be overwritten.
      const nextState = stateAfterConnection(transport.kind, __DEV__);
      setState(nextState);
      if (nextState === 'connected_unverified') {
        statusTimerRef.current = setTimeout(() => fail(new Error('Somnara connected but did not send its status. Accept any pairing prompt and try again.')), 20_000);
      }
      const unsubscribe = transport.subscribe(
        bytes => {
          if (!current()) return;
          const controller = controllerRef.current;
          if (!controller) return;
          try {
            const notification = dispatchUplinkNotification(bytes, controller, alarmReaderRef.current);
            if (notification.kind === 'status') {
              clearStatusTimer();
              setLatestStatus(notification.status);
              setDeviceStatus(previous => applyBleStatusReport(previous, notification.status));
              setProtocolError(null);
              setState('ready');
            } else if (notification.kind === 'alarm_record') {
              setLatestAlarmList(previous => applyAlarmRecord(previous, notification.sequence, notification.slot));
              setProtocolError(null);
            } else if (notification.kind === 'alarm_list') {
              alarmListRef.current = notification.alarmList;
              setLatestAlarmList(notification.alarmList);
              setDeviceAlarmList(notification.alarmList);
              setProtocolError(null);
            } else if (notification.kind === 'alarm_end') {
              setProtocolError(null);
            }
          } catch (failure) {
            if (failure instanceof BleProtocolError) setProtocolError(failure);
          }
        },
        fail,
      );
      if (current()) unsubscribeRef.current = unsubscribe;
      else unsubscribe();
      if (current() && transport.syncsClockOnConnect) {
        try {
          const controller = controllerRef.current;
          if (!controller) return;
          const clock = await controller.execute(SET_CLOCK_OPCODE, sequence => clockFrameFromDate(sequence, new Date()));
          if (!current()) return;
          if (!clock.ok) throw new Error(ackFailureMessage(clock));
          const status = await controller.execute(GET_STATUS_OPCODE, sequence => createGetStatusFrame({ sequence, queryToken: sequence }));
          if (!current()) return;
          if (!status.ok) throw new Error(ackFailureMessage(status));
          const alarms = await controller.execute(READ_ALARMS_OPCODE, sequence => createReadAlarmsFrame({ sequence, queryToken: sequence }));
          if (!current()) return;
          if (!alarms.ok) throw new Error(ackFailureMessage(alarms));
        } catch {
          // The link stays up. The next connect sends the clock again.
        }
      }
    } catch (failure) {
      fail(failure);
    } finally {
      connectingRef.current = false;
    }
  }, [clearSession, clearStatusTimer]);

  const executeCommand = useCallback(async (opcode: number, makeFrame: (sequence: number) => Uint8Array) => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('Connect to Somnara first.');
    try {
      const result = await controller.execute(opcode, makeFrame);
      if (!result.ok) throw new Error(ackFailureMessage(result));
      return result;
    } catch (failure) {
      if (failure instanceof BleProtocolError && failure.code === 'command_timeout') {
        throw new Error('Somnara did not respond. Check it is powered and nearby.');
      }
      throw failure;
    }
  }, []);

  const runCommand = useCallback(async (opcode: number, makeFrame: (sequence: number) => Uint8Array) => {
    setCommandPending(true);
    try {
      return await executeCommand(opcode, makeFrame);
    } finally {
      if (activeRef.current) setCommandPending(false);
    }
  }, [executeCommand]);

  const refreshAlarmStatus = useCallback(async () => {
    await executeCommand(GET_STATUS_OPCODE, sequence => createGetStatusFrame({ sequence, queryToken: sequence }));
    await executeCommand(READ_ALARMS_OPCODE, sequence => createReadAlarmsFrame({ sequence, queryToken: sequence }));
    return alarmListRef.current;
  }, [executeCommand]);

  const playSound = useCallback(async (soundId: number, volumePercent: number) => {
    await runCommand(AUDIO_CONTROL_OPCODE, sequence =>
      createAudioControlFrame({ sequence, action: 'preview', soundId, volumePercent }));
    if (activeRef.current) setPlayingSoundId(soundId === 0 ? null : soundId);
  }, [runCommand]);

  const stopSound = useCallback(async () => {
    await runCommand(AUDIO_CONTROL_OPCODE, sequence =>
      createAudioControlFrame({ sequence, action: 'stop', soundId: 0, volumePercent: 0 }));
    if (activeRef.current) setPlayingSoundId(null);
  }, [runCommand]);

  const setVolume = useCallback(async (volumePercent: number) => {
    await runCommand(SET_VOLUME_OPCODE, sequence => createSetVolumeFrame({ sequence, volumePercent }));
  }, [runCommand]);

  const setPower = useCallback(async (on: boolean) => {
    await runCommand(SET_POWER_OPCODE, sequence => createSetPowerFrame({ sequence, power: on ? 'on' : 'off' }));
  }, [runCommand]);

  const setBrightness = useCallback(async (brightnessPercent: number) => {
    await runCommand(SET_BRIGHTNESS_OPCODE, sequence => createSetBrightnessFrame({ sequence, brightnessPercent }));
  }, [runCommand]);

  const finishAlarmChange = useCallback(async (steps: readonly { opcode: number; makeFrame: (sequence: number) => Uint8Array }[]) => {
    setCommandPending(true);
    try {
      for (const step of steps) await executeCommand(step.opcode, step.makeFrame);
      return await refreshAlarmStatus();
    } finally {
      if (activeRef.current) setCommandPending(false);
    }
  }, [executeCommand, refreshAlarmStatus]);

  const upsertDeviceAlarm = useCallback(async (alarm: DeviceAlarmWrite) => {
    return finishAlarmChange([
      { opcode: UPSERT_ALARM_OPCODE, makeFrame: sequence => createUpsertAlarmFrame({ sequence, ...alarm }) },
    ]);
  }, [finishAlarmChange]);

  const deleteDeviceAlarm = useCallback(async (alarmIndex: number) => {
    return finishAlarmChange([
      { opcode: DELETE_ALARM_OPCODE, makeFrame: sequence => createDeleteAlarmFrame({ sequence, alarmIndex }) },
    ]);
  }, [finishAlarmChange]);

  const skipDeviceAlarm = useCallback(async (alarmIndex: number, skip: boolean) => {
    return finishAlarmChange([
      { opcode: SKIP_NEXT_ALARM_OPCODE, makeFrame: sequence => createSkipNextAlarmFrame({ sequence, alarmIndex, skip }) },
    ]);
  }, [finishAlarmChange]);

  const readDeviceAlarms = useCallback(async () => {
    setCommandPending(true);
    try {
      await executeCommand(READ_ALARMS_OPCODE, sequence => createReadAlarmsFrame({ sequence, queryToken: sequence }));
      return alarmListRef.current;
    } finally {
      if (activeRef.current) setCommandPending(false);
    }
  }, [executeCommand]);

  const replaceDeviceAlarms = useCallback(async (alarms: readonly DeviceAlarmWrite[]) => {
    if (alarms.length > MAX_DEVICE_ALARMS) throw new RangeError('Somnara can store 10 alarms.');
    const revision = ((alarmListRef.current?.revision ?? 0) + 1) & 0xFFFF;
    return finishAlarmChange([
      { opcode: BEGIN_ALARM_SYNC_OPCODE, makeFrame: sequence => createBeginAlarmSyncFrame({ sequence, revision, alarmCount: alarms.length }) },
      ...alarms.map(alarm => ({
        opcode: UPSERT_ALARM_OPCODE,
        makeFrame: (sequence: number) => createUpsertAlarmFrame({ sequence, ...alarm }),
      })),
      { opcode: COMMIT_ALARM_SYNC_OPCODE, makeFrame: sequence => createCommitAlarmSyncFrame({ sequence, revision, alarmCount: alarms.length }) },
    ]);
  }, [finishAlarmChange]);

  useEffect(() => {
    activeRef.current = true;
    const transport = transportFactoryRef.current();
    transportRef.current = transport;
    return () => {
      activeRef.current = false;
      ++attemptRef.current;
      clearSession();
      void transport.destroy().catch(() => undefined);
      transportRef.current = null;
    };
  }, [clearSession]);

  return {
    state, error, failureCode, protocolError, latestStatus, latestAlarmList, deviceStatus, connectedDevice, foundDevices, connect, disconnect,
    playingSoundId, commandPending, playSound, stopSound, setVolume, setPower, setBrightness, deviceAlarmList,
    upsertDeviceAlarm, deleteDeviceAlarm, skipDeviceAlarm, readDeviceAlarms, replaceDeviceAlarms,
  };
}
