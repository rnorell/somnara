import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { useSharedBleConnection } from '../context/BleContext';
import { EMPTY_SOUND_MANIFEST } from '../models/SoundManifest';

const VOLUME_STEP = 10;
// Sound ID 0 is Off; 1–25 are the files on the device.
const SOUNDS = EMPTY_SOUND_MANIFEST.filter(entry => entry.id !== 0);

export function soundName(id: number): string {
  // Names come from the Somnara sound manifest once it is finalised.
  return EMPTY_SOUND_MANIFEST[id]?.displayName ?? `Sound ${id}`;
}

export function SoundsTab() {
  const {
    state, deviceStatus, connect, playingSoundId, commandPending, playSound, stopSound, setVolume,
  } = useSharedBleConnection();
  const ready = state === 'ready';
  const connecting = state === 'scanning' || state === 'connecting' || state === 'connected_unverified';
  const [volume, setLocalVolume] = useState(deviceStatus.volume || 30);
  const [error, setError] = useState<string | null>(null);

  // Follow the device's reported volume whenever a status report arrives.
  useEffect(() => {
    if (deviceStatus.isConnected) setLocalVolume(deviceStatus.volume);
  }, [deviceStatus.isConnected, deviceStatus.volume]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Somnara could not complete that.');
    }
  }

  const changeVolume = (delta: number) => {
    const next = Math.max(0, Math.min(100, volume + delta));
    if (next === volume) return;
    setLocalVolume(next);
    void run(() => setVolume(next));
  };

  const togglePlay = (id: number) => {
    void run(() => (playingSoundId === id ? stopSound() : playSound(id, volume)));
  };

  const disabled = !ready || commandPending;

  return (
    <View style={styles.container}>
      {!ready && (
        <TouchableOpacity
          style={styles.connectBanner}
          onPress={() => { if (!connecting) void connect(); }}
          activeOpacity={0.85}
        >
          {connecting
            ? <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
            : <Feather name="bluetooth" size={18} color={colors.accent.DEFAULT} />}
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>{connecting ? 'Connecting…' : 'Connect your Somnara'}</Text>
            <Text style={styles.bannerSub}>Sounds play on the device, so it needs to be connected.</Text>
          </View>
          {!connecting && <Feather name="chevron-right" size={16} color={colors.text.secondary} />}
        </TouchableOpacity>
      )}

      {/* Now playing + volume */}
      <View style={[styles.card, !ready && styles.dim]}>
        <View style={styles.nowRow}>
          <View style={styles.nowIcon}>
            <Feather name={playingSoundId ? 'volume-2' : 'volume-x'} size={20} color={colors.accent.DEFAULT} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>NOW PLAYING</Text>
            <Text style={styles.nowTitle}>{playingSoundId ? soundName(playingSoundId) : 'Nothing playing'}</Text>
          </View>
          {playingSoundId ? (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => void run(stopSound)}
              disabled={disabled}
              activeOpacity={0.8}
              accessibilityLabel="Stop sound"
            >
              <Feather name="square" size={14} color={colors.text.inverse} />
              <Text style={styles.stopText}>Stop</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.volumeRow}>
          <Text style={styles.volumeLabel}>Volume</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => changeVolume(-VOLUME_STEP)}
            disabled={disabled || volume === 0}
            accessibilityLabel="Volume down"
          >
            <Feather name="minus" size={16} color={colors.accent.DEFAULT} />
          </TouchableOpacity>
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeFill, { width: `${volume}%` }]} />
          </View>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => changeVolume(VOLUME_STEP)}
            disabled={disabled || volume === 100}
            accessibilityLabel="Volume up"
          >
            <Feather name="plus" size={16} color={colors.accent.DEFAULT} />
          </TouchableOpacity>
          <Text style={styles.volumeValue}>{volume}%</Text>
        </View>
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      {/* Sound list */}
      <View style={[styles.card, styles.listCard, !ready && styles.dim]}>
        {SOUNDS.map((entry, index) => {
          const playing = playingSoundId === entry.id;
          return (
            <View key={entry.id}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.soundRow}
                onPress={() => togglePlay(entry.id)}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityLabel={`${playing ? 'Stop' : 'Play'} ${soundName(entry.id)}`}
              >
                <Text style={styles.soundNumber}>{String(entry.id).padStart(2, '0')}</Text>
                <Text style={[styles.soundName, playing && styles.soundNamePlaying]}>{soundName(entry.id)}</Text>
                <View style={[styles.playBtn, playing && styles.playBtnActive]}>
                  <Feather
                    name={playing ? 'square' : 'play'}
                    size={14}
                    color={playing ? colors.text.inverse : colors.accent.DEFAULT}
                  />
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <Text style={styles.footnote}>
        Sound names will appear here once the Somnara sound list is finalised.
      </Text>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#C49A6C',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['3'],
    gap: spacing['3'],
  },
  flex: { flex: 1 },
  dim: { opacity: 0.55 },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.primary.light,
    ...cardShadow,
  },
  bannerTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  bannerSub: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    padding: spacing['4'],
    ...cardShadow,
  },
  listCard: {
    paddingVertical: spacing['1'],
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  nowIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.secondary,
  },
  nowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginTop: 2,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
  },
  stopText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
    marginVertical: spacing['3'],
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
  volumeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    width: 56,
  },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  volumeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.DEFAULT,
    overflow: 'hidden',
  },
  volumeFill: {
    height: 6,
    backgroundColor: colors.accent.DEFAULT,
  },
  volumeValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    width: 40,
    textAlign: 'right',
  },
  error: {
    fontSize: typography.sizes.sm,
    color: '#C0392B',
    textAlign: 'center',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    paddingVertical: spacing['1'],
  },
  soundNumber: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    width: 20,
  },
  soundName: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text.primary,
  },
  soundNamePlaying: {
    color: colors.accent.DEFAULT,
    fontWeight: typography.weights.semibold,
  },
  playBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: colors.accent.DEFAULT,
  },
  footnote: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing['1'],
  },
});
