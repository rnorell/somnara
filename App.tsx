import 'react-native-reanimated';
import { useState } from 'react';
import { AuthScreen } from './src/screens/AuthScreen';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { SyncProvider } from './src/context/SyncContext';
import { User } from './src/state/authStore';
import { PairedDevice } from './src/models/Device';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  if (!pairedDevice) {
    return <DeviceActivationScreen user={user} onActivated={setPairedDevice} />;
  }

  if (!onboarded) {
    return <OnboardingScreen onComplete={() => setOnboarded(true)} />;
  }

  return (
    <SyncProvider userId={user.id}>
      <WelcomeScreen pairedDevice={pairedDevice} onDeviceReset={() => setPairedDevice(null)} />
    </SyncProvider>
  );
}
