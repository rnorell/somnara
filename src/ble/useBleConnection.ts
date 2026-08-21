import { useCallback, useEffect, useRef, useState } from 'react';
import { createBleTransport } from './createBleTransport';
import { BleConnectionState, BleTransport, BleTransportError } from './types';

interface BleConnectionResult {
  state: BleConnectionState;
  error: string | null;
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

  const disconnect = useCallback(async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    await transportRef.current?.disconnect();
    if (activeRef.current) setState('disconnected');
  }, []);

  const connect = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    setError(null);
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
      unsubscribeRef.current = transport.subscribe(
        () => undefined,
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
      void transport.destroy();
      transportRef.current = null;
    };
  }, []);

  return { state, error, connect, disconnect };
}
