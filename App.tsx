import 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthScreen } from './src/screens/AuthScreen';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { SyncProvider } from './src/context/SyncContext';
import { toAppUser, User } from './src/state/authStore';
import { ClaimedDevice } from './src/models/Device';
import { supabase, configError } from './src/lib/supabase';
import { storage } from './src/lib/storage';
import { classifyError } from './src/lib/errors';
import { initMonitoring } from './src/lib/monitoring';
import { useAuthDeepLink } from './src/hooks/useAuthDeepLink';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StatusScreen } from './src/components/StatusScreen';
import { colors } from './src/theme';

initMonitoring();

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [claimedDevice, setClaimedDevice] = useState<ClaimedDevice | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [pendingPasswordRecovery, setPendingPasswordRecovery] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState('');
  const [authOutage, setAuthOutage] = useState<string | null>(null);
  const [deviceOutage, setDeviceOutage] = useState<string | null>(null);
  const [authRetryTick, setAuthRetryTick] = useState(0);
  const [deviceRetryTick, setDeviceRetryTick] = useState(0);
  const hadSessionRef = useRef(false);
  const signingOutRef = useRef(false);
  const deepLinkError = useAuthDeepLink();

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    setAuthLoading(true);
    setAuthOutage(null);
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        const classified = classifyError(error);
        if (classified.kind === 'network') {
          setAuthOutage(classified.message);
          setAuthLoading(false);
          return;
        }
      }
      setUser(!error && data.user ? toAppUser(data.user) : null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setPendingPasswordRecovery(true);
      if (session) {
        hadSessionRef.current = true;
        setSessionExpiredNotice('');
      } else {
        if (hadSessionRef.current && !signingOutRef.current) {
          setSessionExpiredNotice('Your session expired — please sign in again.');
        }
        hadSessionRef.current = false;
        signingOutRef.current = false;
      }
      setUser(session?.user ? toAppUser(session.user) : null);
      if (!session) {
        setClaimedDevice(null);
        setOnboarded(false);
      }
      setAuthLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [authRetryTick]);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    setDeviceLoading(true);
    setDeviceOutage(null);
    supabase
      .from('paired_devices')
      .select('id, serial, name, paired_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const classified = classifyError(error);
          if (classified.kind === 'network') {
            setDeviceOutage(classified.message);
            setDeviceLoading(false);
            return;
          }
        }
        setClaimedDevice(data ? {
          id: data.id,
          serial: data.serial,
          name: data.name,
          claimedAt: data.paired_at,
          ownerId: user.id,
          ownerEmail: user.email,
        } : null);
        setDeviceLoading(false);
      });
    return () => { active = false; };
  }, [user, deviceRetryTick]);

  if (configError) {
    return (
      <StatusScreen
        icon="alert-octagon"
        tone="danger"
        title="Configuration problem"
        message={configError}
      />
    );
  }

  if (authLoading || deviceLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent.DEFAULT} /></View>;
  }

  if (authOutage) {
    return (
      <StatusScreen
        icon="cloud-off"
        title="Can't connect"
        message={authOutage}
        actionLabel="Retry"
        onAction={() => setAuthRetryTick(t => t + 1)}
      />
    );
  }

  if (pendingPasswordRecovery) {
    return <ResetPasswordScreen onDone={() => setPendingPasswordRecovery(false)} />;
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} sessionExpiredNotice={deepLinkError ?? (sessionExpiredNotice || undefined)} />;
  }

  if (deviceOutage) {
    return (
      <StatusScreen
        icon="cloud-off"
        title="Can't connect"
        message={deviceOutage}
        actionLabel="Retry"
        onAction={() => setDeviceRetryTick(t => t + 1)}
      />
    );
  }

  if (!claimedDevice) return <DeviceActivationScreen user={user} onClaimed={setClaimedDevice} />;

  async function unlinkDevice() {
    if (!supabase || !user || !claimedDevice) throw new Error('Secure device service is unavailable.');
    const { error } = await supabase.rpc('unlink_device', { p_device_id: claimedDevice.id });
    if (error) throw error;
    setClaimedDevice(null);
    setOnboarded(false);
  }

  function signOut() {
    signingOutRef.current = true;
    if (user) void storage.clear(user.id);
    void supabase?.auth.signOut();
  }

  async function deleteAccount() {
    if (!supabase || !user) throw new Error('Authentication service is not configured.');
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
    signingOutRef.current = true;
    await storage.clear(user.id);
    await supabase.auth.signOut();
  }

  return (
    <SyncProvider userId={user.id}>
      {!onboarded ? (
        <OnboardingScreen onComplete={() => setOnboarded(true)} />
      ) : (
        <WelcomeScreen
          claimedDevice={claimedDevice}
          onDeviceReset={unlinkDevice}
          onSignOut={signOut}
          onDeleteAccount={deleteAccount}
        />
      )}
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
