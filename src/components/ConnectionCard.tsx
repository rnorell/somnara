import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';

interface Props {
  deviceName: string;
  isConnected: boolean;
  busy: boolean;
  statusText: string;
  error?: string | null;
  onPress: () => void;
}

// Presentational only: the caller owns the BLE connection and decides what
// onPress does (connect / cancel / disconnect).
export function ConnectionCard({ deviceName, isConnected, busy, statusText, error, onPress }: Props) {
  const dotColor = error ? '#C0392B' : isConnected ? colors.success : busy ? colors.glow.warm : colors.text.tertiary;
  const actionLabel = busy ? 'Cancel' : isConnected ? 'Disconnect' : 'Connect';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${statusText}. ${actionLabel}`}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.text}>
        <Text style={styles.status} accessibilityLiveRegion="polite" numberOfLines={1}>{statusText}</Text>
        <Text style={[styles.name, error ? styles.error : null]} numberOfLines={2}>{error ?? deviceName}</Text>
      </View>
      <View style={styles.pill}>
        {busy
          ? <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
          : <Feather name="bluetooth" size={16} color={isConnected ? colors.success : colors.accent.DEFAULT} />}
        <Text style={styles.pillText}>{actionLabel}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    backgroundColor: colors.background.elevated,
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['5'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1 },
  status: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  name: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  error: { color: '#C0392B' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    backgroundColor: colors.background.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
  },
  pillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
});
