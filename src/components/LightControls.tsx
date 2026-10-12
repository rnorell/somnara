import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';

const BRIGHTNESS_STEP = 10;

interface Props {
  connected: boolean;
  powerOn: boolean;
  brightness: number;
  busy: boolean;
  onPower: (on: boolean) => Promise<void>;
  onBrightness: (percent: number) => Promise<void>;
}

export function LightControls({ connected, powerOn, brightness, busy, onPower, onBrightness }: Props) {
  const [level, setLevel] = useState(brightness);
  const [error, setError] = useState<string | null>(null);
  const disabled = !connected || busy;

  useEffect(() => {
    if (connected) setLevel(brightness);
  }, [connected, brightness]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Somnara could not complete that.');
    }
  }

  const changeBrightness = (delta: number) => {
    const next = Math.max(0, Math.min(100, level + delta));
    if (next === level) return;
    setLevel(next);
    void run(() => onBrightness(next));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Light</Text>
        {busy ? <ActivityIndicator size="small" color={colors.accent.DEFAULT} /> : null}
      </View>

      {!connected ? (
        <Text style={styles.hint}>Connect your Somnara to control the light.</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.power, disabled && styles.dim]}
        onPress={() => void run(() => onPower(!powerOn))}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={powerOn ? 'Turn off' : 'Turn on'}
      >
        <Feather name="power" size={16} color={powerOn ? colors.success : colors.accent.DEFAULT} />
        <Text style={styles.powerText}>{powerOn ? 'On' : 'Off'}</Text>
      </TouchableOpacity>

      <View style={[styles.brightnessRow, disabled && styles.dim]}>
        <Text style={styles.label}>Brightness</Text>
        <TouchableOpacity
          style={styles.step}
          onPress={() => changeBrightness(-BRIGHTNESS_STEP)}
          disabled={disabled || level === 0}
          accessibilityLabel="Brightness down"
        >
          <Feather name="minus" size={16} color={colors.accent.DEFAULT} />
        </TouchableOpacity>
        <Text style={styles.value}>{level}%</Text>
        <TouchableOpacity
          style={styles.step}
          onPress={() => changeBrightness(BRIGHTNESS_STEP)}
          disabled={disabled || level === 100}
          accessibilityLabel="Brightness up"
        >
          <Feather name="plus" size={16} color={colors.accent.DEFAULT} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    padding: spacing['4'],
    gap: spacing['3'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  power: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    alignSelf: 'flex-start',
    backgroundColor: colors.background.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
  },
  powerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  brightnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  label: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  value: {
    width: 44,
    textAlign: 'right',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  error: {
    fontSize: typography.sizes.sm,
    color: '#C0392B',
  },
  dim: {
    opacity: 0.45,
  },
});
