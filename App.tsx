import 'react-native-reanimated';
import { useState } from 'react';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';

export default function App() {
  const [onboarded, setOnboarded] = useState(true);

  if (!onboarded) {
    return <OnboardingScreen onComplete={() => setOnboarded(true)} />;
  }

  return <WelcomeScreen />;
}
