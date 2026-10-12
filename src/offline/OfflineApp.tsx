import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BleProvider, useSharedBleConnection } from '../context/BleContext';
import { SyncProvider } from '../context/SyncContext';
import { LOCAL_USER_ID } from '../lib/appMode';
import { SavedBleDevice, storage } from '../lib/storage';
import { ClaimedDevice } from '../models/Device';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors } from '../theme';

function localProfile(saved: SavedBleDevice | null): ClaimedDevice {
  return {
    id: saved?.id ?? 'local-device',
    serial: saved?.id ?? 'LOCAL',
    name: saved?.name ?? 'Somnara',
    claimedAt: new Date(0).toISOString(),
    ownerId: LOCAL_USER_ID,
    ownerEmail: '',
  };
}

export function OfflineApp() {
  const [saved, setSaved] = useState<SavedBleDevice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    storage.loadBleDevice()
      .then(device => {
        if (!active) return;
        setSaved(device);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  if (!ready) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent.DEFAULT} /></View>;
  }

  return (
    <BleProvider>
      <SyncProvider userId={LOCAL_USER_ID}>
        <OfflineController saved={saved} onSaved={setSaved} />
      </SyncProvider>
    </BleProvider>
  );
}

function OfflineController({ saved, onSaved }: {
  saved: SavedBleDevice | null;
  onSaved: (device: SavedBleDevice | null) => void;
}) {
  const { connectedDevice, disconnect } = useSharedBleConnection();
  const saveGeneration = useRef(0);

  useEffect(() => {
    if (!connectedDevice) return;
    const name = connectedDevice.name?.trim() || saved?.name || 'Somnara';
    if (saved?.id === connectedDevice.id && saved.name === name) return;
    const next = { id: connectedDevice.id, name };
    const generation = ++saveGeneration.current;
    void storage.saveBleDevice(next).then(() => {
      if (saveGeneration.current !== generation) return;
      onSaved(next);
    });
  }, [connectedDevice, onSaved, saved]);

  async function forgetDevice() {
    saveGeneration.current += 1;
    await disconnect();
    await storage.clearBleDevice();
    onSaved(null);
  }

  return (
    <WelcomeScreen
      claimedDevice={localProfile(saved)}
      accountFeatures={false}
      devicePresentation={saved ? 'local' : 'hidden'}
      preferredDeviceId={saved?.id}
      onDeviceReset={forgetDevice}
    />
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
