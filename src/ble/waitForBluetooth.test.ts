import { State } from 'react-native-ble-plx';
import { waitForBluetooth } from './waitForBluetooth';

jest.mock('react-native-ble-plx', () => ({
  State: { Unknown: 'Unknown', Resetting: 'Resetting', PoweredOn: 'PoweredOn', PoweredOff: 'PoweredOff', Unauthorized: 'Unauthorized', Unsupported: 'Unsupported' },
}));

describe('Bluetooth startup', () => {
  afterEach(() => jest.useRealTimers());

  it('waits through initialization and removes its listener once ready', async () => {
    let listener!: (state: State) => void;
    const remove = jest.fn();
    const manager = { onStateChange: jest.fn(callback => { listener = callback; callback(State.Unknown); return { remove }; }) };
    const ready = waitForBluetooth(manager);
    expect(remove).not.toHaveBeenCalled();
    listener(State.Resetting);
    expect(remove).not.toHaveBeenCalled();
    listener(State.PoweredOn);
    await ready;
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it.each([
    [State.PoweredOff, 'bluetooth_off'],
    [State.Unauthorized, 'permission_required'],
    [State.Unsupported, 'unknown'],
  ])('reports %s without starting a scan', async (state, code) => {
    const remove = jest.fn();
    const manager = { onStateChange: jest.fn(callback => { callback(state); return { remove }; }) };
    await expect(waitForBluetooth(manager)).rejects.toMatchObject({ code });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('times out initialization and removes the listener', async () => {
    jest.useFakeTimers();
    const remove = jest.fn();
    const ready = waitForBluetooth({ onStateChange: jest.fn(() => ({ remove })) });
    const assertion = expect(ready).rejects.toThrow('still starting');
    jest.advanceTimersByTime(5_000);
    await assertion;
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
