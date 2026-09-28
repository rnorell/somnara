import { fireEvent, render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../components/OtaTestPanel', () => ({ OtaTestPanel: () => null }));
const mockConnect = jest.fn(() => Promise.resolve());
const mockDisconnect = jest.fn(() => Promise.resolve());
const mockSetAlarms = jest.fn();
const mockShowMessage = jest.fn((..._args: unknown[]) => undefined);
const mockConfirm = jest.fn((..._args: unknown[]) => Promise.resolve(false));

jest.mock('../lib/dialog', () => ({
  showMessage: (...args: unknown[]) => mockShowMessage(...args),
  confirmAction: (...args: unknown[]) => mockConfirm(...args),
}));
jest.mock('../components/DeviceIllustration', () => ({ DeviceIllustration: () => null }));
jest.mock('../components/SyncStatusCard', () => ({ SyncStatusCard: () => null }));
jest.mock('./HelpScreen', () => ({ HelpScreen: () => null }));
jest.mock('../context/BleContext', () => ({
  useSharedBleConnection: () => ({
    deviceStatus: { isConnected: false, isOn: false, clockValidity: 'valid', firmwareVersion: null },
    state: 'disconnected',
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    playingSoundId: null,
    commandPending: false,
    playSound: jest.fn(),
    stopSound: jest.fn(),
    setVolume: jest.fn(),
  }),
}));
jest.mock('../context/SyncContext', () => ({
  useSyncContext: () => ({
    alarms: [{ id: 'a1', hour: 6, minute: 30, days: [1, 2, 3, 4, 5], enabled: true, label: '', sunriseDuration: 30 }],
    setAlarms: mockSetAlarms,
    preferences: { sunriseDuration: 30 },
    setPreferences: jest.fn(),
  }),
}));

const device = { id: 'd', serial: 'SN123456', name: 'Somnara Light', claimedAt: '', ownerId: 'u', ownerEmail: 'a@b.c' };

async function renderScreen(overrides: Partial<React.ComponentProps<typeof WelcomeScreen>> = {}) {
  const props = {
    claimedDevice: device,
    userName: 'carlos luque',
    onDeviceReset: jest.fn(() => Promise.resolve()),
    onSignOut: jest.fn(),
    onDeleteAccount: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
  await render(<WelcomeScreen {...props} />);
  return props;
}

beforeEach(() => jest.clearAllMocks());

test('profile button opens Settings', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByLabelText('Account and settings'));
  expect(screen.getByText('MY DEVICE')).toBeTruthy();
});

test('connection card calls connect when disconnected', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Disconnected'));
  expect(mockConnect).toHaveBeenCalled();
});

test('next alarm card opens Alarms and its toggle disables the alarm', async () => {
  await renderScreen();
  await fireEvent.press(screen.getAllByLabelText('Alarm enabled')[0]);
  expect(mockSetAlarms).toHaveBeenCalledWith([expect.objectContaining({ id: 'a1', enabled: false })]);
  await fireEvent.press(screen.getByText('NEXT ALARM'));
  expect(screen.getByText('Add Alarm')).toBeTruthy();
});

test('quick tiles show a message or navigate', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Light'));
  await fireEvent.press(screen.getByText('Sleep Mode'));
  await fireEvent.press(screen.getByText('Routines'));
  expect(mockShowMessage).toHaveBeenCalledTimes(3);
  await fireEvent.press(screen.getAllByText('Sounds')[0]);
  expect(screen.getByText('Connect your Somnara')).toBeTruthy();
});

test('Get Started opens Alarms', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Get Started'));
  expect(screen.getByText('Add Alarm')).toBeTruthy();
});

test('Settings: sign out works and delete account asks for confirmation', async () => {
  const props = await renderScreen();
  await fireEvent.press(screen.getByText('Settings'));
  await fireEvent.press(screen.getByText('Sign Out'));
  expect(props.onSignOut).toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Delete Account'));
  expect(mockConfirm).toHaveBeenCalled();
  await Promise.resolve();
  expect(props.onDeleteAccount).not.toHaveBeenCalled();
});

test('Settings: unlink device asks for confirmation', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Settings'));
  await fireEvent.press(screen.getByText(/Unlink/));
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Unlink Device' }));
});
