import React, { createContext, useContext } from 'react';
import { useBleConnection } from '../ble/useBleConnection';
import { BleTransport } from '../ble/types';

const BleContext = createContext<ReturnType<typeof useBleConnection> | null>(null);

/** Owns the connection across onboarding, home and OTA verification. */
export function BleProvider({ children, transportFactory }: {
  children: React.ReactNode;
  transportFactory?: () => BleTransport;
}) {
  const connection = useBleConnection(transportFactory);
  return <BleContext.Provider value={connection}>{children}</BleContext.Provider>;
}

export function useSharedBleConnection() {
  const connection = useContext(BleContext);
  if (!connection) throw new Error('Bluetooth screens must be inside BleProvider.');
  return connection;
}
