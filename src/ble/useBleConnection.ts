import { useCallback, useEffect, useRef, useState } from 'react';
import { createBleTransport } from './createBleTransport';
import { BleConnectionState, BleTransport, BleTransportError } from './types';
import { AckTransactionController } from './AckTransactionController';
import { BleProtocolError } from './AckFrame';
import { AlarmListReport, DeviceStatusReport, dispatchUplinkNotification, MINIMUM_ALARM_LIST_MTU } from './UplinkFrame';
import { DeviceStatus } from '../models/Device';
import { applyBleStatusReport, initialDeviceStatus } from '../state/deviceStore';

interface BleConnectionResult {
  state: BleConnectionState;
  error: string | null;
  protocolError: BleProtocolError | null;
  latestStatus: DeviceStatusReport | null;
  latestAlarmList: AlarmListReport | null;
  deviceStatus: DeviceStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

function stateForError(error: unknown): BleConnectionState {
  return error instanceof BleTransportError && error.code === 'permission_required'
    ? 'permission_required'
    : 'failed';
}

export function stateAfterConnection(kind: BleTransport['kind'], allowMockReady: boolean): BleConnectionState {
  return kind === 'mock' && allowMockReady ? 'ready' : 'connected_unverified';
}

export function useBleConnection(transportFactory: () => BleTransport = createBleTransport): BleConnectionResult {
  const transportRef = useRef<BleTransport | null>(null);
  const transportFactoryRef = useRef(transportFactory);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(true);
  const [state, setState] = useState<BleConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [protocolError, setProtocolError] = useState<BleProtocolError | null>(null);
  const [latestStatus, setLatestStatus] = useState<DeviceStatusReport | null>(null);
  const [latestAlarmList, setLatestAlarmList] = useState<AlarmListReport | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(initialDeviceStatus);
  const controllerRef = useRef<AckTransactionController | null>(null);

  const disconnect = useCallback(async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    controllerRef.current = null;
    await transportRef.current?.disconnect();
    if (activeRef.current) setState('disconnected');
  }, []);

  const connect = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    setError(null);
    setProtocolError(null);
    setLatestStatus(null);
    setLatestAlarmList(null);
    try {
      const permitted = await transport.requestPermissions();
      if (!permitted) {
        setState('permission_required');
        return;
      }
      setState('scanning');
      const candidate = await transport.scan();
      if (!activeRef.current) return;
      setState('connecting');
      await transport.connect(candidate.id);
      if (!activeRef.current) return;
      await transport.negotiateMtu(MINIMUM_ALARM_LIST_MTU);
      if (!activeRef.current) return;
      controllerRef.current = new AckTransactionController(
        bytes => transport.writeRaw(bytes),
        { onProtocolError: nextError => activeRef.current && setProtocolError(nextError) },
      );
      unsubscribeRef.current = transport.subscribe(
        bytes => {
          const controller = controllerRef.current;
          if (!controller) return;
          try {
            const notification = dispatchUplinkNotification(bytes, controller);
            if (notification.kind === 'status') {
              setLatestStatus(notification.status);
              setDeviceStatus(current => applyBleStatusReport(current, notification.status));
              setProtocolError(null);
            } else if (notification.kind === 'alarm_list') {
              setLatestAlarmList(notification.alarmList);
              setProtocolError(null);
            }
          } catch (protocolFailure) {
            if (activeRef.current && protocolFailure instanceof BleProtocolError) {
              setProtocolError(protocolFailure);
            }
          }
        },
        notificationError => {
          if (!activeRef.current) return;
          setError(notificationError.message);
          setState('failed');
        },
      );
      setState(stateAfterConnection(transport.kind, __DEV__));
    } catch (connectionError) {
      if (!activeRef.current) return;
      setError(connectionError instanceof Error ? connectionError.message : 'Could not connect to Somnara.');
      setState(stateForError(connectionError));
    }
  }, []);

  useEffect(() => {
    const transport = transportFactoryRef.current();
    transportRef.current = transport;
    return () => {
      activeRef.current = false;
      unsubscribeRef.current?.();
      controllerRef.current = null;
      void transport.destroy();
      transportRef.current = null;
    };
  }, []);

  return { state, error, protocolError, latestStatus, latestAlarmList, deviceStatus, connect, disconnect };
}
