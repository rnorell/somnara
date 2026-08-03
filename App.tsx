import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthScreen } from './src/screens/AuthScreen';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { SyncProvider } from './src/context/SyncContext';
import { toAppUser, User } from './src/state/authStore';
import { PairedDevice } from './src/models/Device';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [deviceLoading, setDeviceLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setUser(!error && data.user ? toAppUser(data.user) : null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ? toAppUser(session.user) : null);
      if (!session) {
        setPairedDevice(null);
        setOnboarded(false);
      }
      setAuthLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    setDeviceLoading(true);
    supabase
      .from('paired_devices')
      .select('id, serial, name, paired_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          setPairedDevice({
            id: data.id,
            serial: data.serial,
            name: data.name,
            pairedAt: data.paired_at,
            ownerId: user.id,
            ownerEmail: user.email,
          });
        } else {
          setPairedDevice(null);
        }
        setDeviceLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  if (authLoading || deviceLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent.DEFAULT} /></View>;
  }

  if (!user) return <AuthScreen onAuth={setUser} />;
  if (!pairedDevice) return <DeviceActivationScreen user={user} onActivated={setPairedDevice} />;
  if (!onboarded) return <OnboardingScreen onComplete={() => setOnboarded(true)} />;

  async function unlinkDevice() {
    if (!supabase || !user || !pairedDevice) throw new Error('Secure device service is unavailable.');
    const { error } = await supabase.rpc('unlink_device', { p_device_id: pairedDevice.id });
    if (error) throw error;
    setPairedDevice(null);
    setOnboarded(false);
  }

  return (
    <SyncProvider userId={user.id}>
      <WelcomeScreen
        pairedDevice={pairedDevice}
        onDeviceReset={unlinkDevice}
        onSignOut={() => { void supabase?.auth.signOut(); }}
      />
    </SyncProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
});
