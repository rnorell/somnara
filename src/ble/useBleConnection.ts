import { useCallback, useEffect, useRef, useState } from 'react';
import { createBleTransport } from './createBleTransport';
import { BleConnectionState, BleTransport, BleTransportError } from './types';
import { AckTransactionController } from './AckTransactionController';
import { BleProtocolError } from './AckFrame';
import { AlarmListReport, DeviceStatusReport, dispatchUplinkNotification, MINIMUM_ALARM_LIST_MTU } from './UplinkFrame';
import { DeviceStatus } from '../models/Device';
import { applyBleStatusReport, initialDeviceStatus } from '../state/deviceStore';

export function stateAfterConnection(kind: BleTransport['kind'], allowMockReady: boolean): BleConnectionState {
  return kind === 'mock' && allowMockReady ? 'ready' : 'connected_unverified';
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

  return { state, error, protocolError, latestStatus, latestAlarmList, deviceStatus, connect, disconnect };
}
