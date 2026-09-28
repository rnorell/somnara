import { useCallback, useEffect, useRef, useState } from 'react';
import { createBleTransport } from './createBleTransport';
import { BleConnectionState, BleTransport, BleTransportError } from './types';
import { AckTransactionController } from './AckTransactionController';
import { ACK_RESULT_CODES, AckResult, BleProtocolError } from './AckFrame';
import {
  AUDIO_CONTROL_OPCODE,
  createAudioControlFrame,
  createSetVolumeFrame,
  SET_VOLUME_OPCODE,
} from './DownlinkFrame';
import { AlarmListReport, DeviceStatusReport, dispatchUplinkNotification, MINIMUM_ALARM_LIST_MTU } from './UplinkFrame';
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
  const [state, setState] = useState<BleConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [protocolError, setProtocolError] = useState<BleProtocolError | null>(null);
  const [latestStatus, setLatestStatus] = useState<DeviceStatusReport | null>(null);
  const [latestAlarmList, setLatestAlarmList] = useState<AlarmListReport | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(initialDeviceStatus);
  const controllerRef = useRef<AckTransactionController | null>(null);
  // What the app last successfully asked the device to play. Status 0x13 reports
  // the selected sound ID but has no explicit playing/stopped field.
  const [playingSoundId, setPlayingSoundId] = useState<number | null>(null);
  const [commandPending, setCommandPending] = useState(false);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
  }, []);

  const clearSession = useCallback(() => {
    clearStatusTimer();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    controllerRef.current = null;
  }, [clearStatusTimer]);

  const disconnect = useCallback(async () => {
    ++attemptRef.current;
    clearSession();
    if (activeRef.current) {
      setState('disconnected');
      setPlayingSoundId(null);
      setDeviceStatus(initialDeviceStatus);
      setLatestStatus(null);
      setLatestAlarmList(null);
      setError(null);
      setProtocolError(null);
    }
    await transportRef.current?.disconnect();
  }, [clearSession]);

  const connect = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport || connectingRef.current) return;
    connectingRef.current = true;
    const attempt = ++attemptRef.current;
    const current = () => activeRef.current && attemptRef.current === attempt;
    clearSession();
    setError(null);
    setProtocolError(null);
    setLatestStatus(null);
    setLatestAlarmList(null);
    setDeviceStatus(initialDeviceStatus);
    setPlayingSoundId(null);
    setState('scanning');
    const fail = (failure: unknown) => {
      if (!current()) return;
      ++attemptRef.current;
      clearSession();
      setDeviceStatus(initialDeviceStatus);
      setLatestStatus(null);
      setLatestAlarmList(null);
      setError(failure instanceof Error ? failure.message : 'Could not connect to Somnara.');
      setState(failure instanceof BleTransportError && failure.code === 'permission_required' ? 'permission_required' : 'failed');
      void transport.disconnect().catch(() => undefined);
    };
    try {
      await transport.disconnect();
      if (!current()) return;
      const permitted = await transport.requestPermissions();
      if (!current()) return;
      if (!permitted) throw new BleTransportError('permission_required', 'Allow Bluetooth access in Settings, then try again.');
      const candidate = await transport.scan();
      if (!current()) return;
      setState('connecting');
      await transport.connect(candidate.id);
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
            const notification = dispatchUplinkNotification(bytes, controller);
            if (notification.kind === 'status') {
              clearStatusTimer();
              setLatestStatus(notification.status);
              setDeviceStatus(previous => applyBleStatusReport(previous, notification.status));
              setProtocolError(null);
              setState('ready');
            } else if (notification.kind === 'alarm_list') {
              setLatestAlarmList(notification.alarmList);
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
    } catch (failure) {
      fail(failure);
    } finally {
      connectingRef.current = false;
    }
  }, [clearSession, clearStatusTimer]);

  const runCommand = useCallback(async (opcode: number, makeFrame: (sequence: number) => Uint8Array) => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('Connect to Somnara first.');
    setCommandPending(true);
    try {
      const result = await controller.execute(opcode, makeFrame);
      if (!result.ok) throw new Error(ackFailureMessage(result));
      return result;
    } catch (failure) {
      if (failure instanceof BleProtocolError && failure.code === 'command_timeout') {
        throw new Error('Somnara did not respond. Check it is powered and nearby.');
      }
      throw failure;
    } finally {
      if (activeRef.current) setCommandPending(false);
    }
  }, []);

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
    state, error, protocolError, latestStatus, latestAlarmList, deviceStatus, connect, disconnect,
    playingSoundId, commandPending, playSound, stopSound, setVolume,
  };
}
