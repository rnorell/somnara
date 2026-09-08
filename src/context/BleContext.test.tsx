import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { BleProvider, useSharedBleConnection } from './BleContext';
import { MockBleTransport } from '../ble/MockBleTransport';
import { createManufacturerStatusFixture } from '../ble/manufacturerProtocolFixtures';

it('keeps a verified native connection when setup is replaced by the home screen', async () => {
  const transport = new MockBleTransport();
  Object.defineProperty(transport, 'kind', { value: 'native' });
  const factory = jest.fn(() => transport);
  const destroy = jest.spyOn(transport, 'destroy');
  let connection!: ReturnType<typeof useSharedBleConnection>;
  function Setup() {
    connection = useSharedBleConnection();
    return <Text>Setup {connection.state}</Text>;
  }
  function Home() {
    const ble = useSharedBleConnection();
    return <Text>Home {ble.state} {String(ble.deviceStatus.isConnected)}</Text>;
  }
  function App({ home }: { home: boolean }) {
    return <BleProvider transportFactory={factory}>{home ? <Home /> : <Setup />}</BleProvider>;
  }
  const screen = await render(<App home={false} />);
  await act(async () => { await connection.connect(); });
  await act(async () => { transport.emitNotification(createManufacturerStatusFixture()); });
  expect(screen.getByText('Setup ready')).toBeTruthy();
  await screen.rerender(<App home />);
  expect(screen.getByText('Home ready true')).toBeTruthy();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(destroy).not.toHaveBeenCalled();
  await screen.unmount();
  expect(destroy).toHaveBeenCalledTimes(1);
});
