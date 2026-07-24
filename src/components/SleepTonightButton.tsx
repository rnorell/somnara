import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';

const BEDTIME_HOUR = 22;
const BEDTIME_MIN = 30;

function getCountdown() {
  const now = new Date();
  const bed = new Date();
  bed.setHours(BEDTIME_HOUR, BEDTIME_MIN, 0, 0);
  if (bed <= now) bed.setDate(bed.getDate() + 1);
  const diff = Math.floor((bed.getTime() - now.getTime()) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ROUTINE = [
  { icon: 'sun' as const, label: 'Lights dimming to 10%' },
  { icon: 'volume-2' as const, label: 'White noise started' },
  { icon: 'smartphone' as const, label: 'Reminder: put phone away' },
  { icon: 'moon' as const, label: `Bedtime at ${BEDTIME_HOUR}:${String(BEDTIME_MIN).padStart(2, '0')}` },
];

export function SleepTonightButton() {
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState(getCountdown);

  const moonGlow = useSharedValue(0.7);

  useEffect(() => {
    if (active) {
      moonGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );

      const timer = setInterval(() => setCountdown(getCountdown()), 30000);
      return () => clearInterval(timer);
    } else {
      moonGlow.value = withTiming(0.7, { duration: 600 });
    }
  }, [active]);

  const moonStyle = useAnimatedStyle(() => ({
    opacity: moonGlow.value,
  }));

  const activate = () => setActive(true);
  const cancel = () => setActive(false);

  if (!active) {
    return (
      <TouchableOpacity style={styles.idleCard} onPress={activate} activeOpacity={0.85}>
        <View style={styles.idleLeft}>
          <Feather name="moon" size={22} color={colors.glow.soft} />
          <View style={styles.idleText}>
            <Text style={styles.idleTitle}>Sleep Tonight</Text>
            <Text style={styles.idleSub}>Dim · White noise · Reminder · Countdown</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.dark.text} style={{ opacity: 0.4 }} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.activeCard}>
      {/* Header */}
      <View style={styles.activeHeader}>
        <Animated.View style={moonStyle}>
          <Feather name="moon" size={20} color={colors.glow.soft} />
        </Animated.View>
        <Text style={styles.activeTitle}>Sleep mode active</Text>
      </View>

      {/* Routine items */}
      <View style={styles.routineList}>
        {ROUTINE.map((item, i) => (
          <View key={i} style={styles.routineRow}>
            <View style={styles.checkCircle}>
              <Feather name="check" size={10} color={colors.glow.sunrise} />
            </View>
            <Feather name={item.icon} size={13} color={colors.dark.text} style={{ opacity: 0.55, marginRight: spacing['2'] }} />
            <Text style={styles.routineLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Countdown */}
      <View style={styles.countdownBadge}>
        <Feather name="clock" size={13} color={colors.glow.sunrise} />
        <Text style={styles.countdownText}>Bedtime in </Text>
        <Text style={styles.countdownValue}>{countdown}</Text>
      </View>

      {/* Cancel */}
      <TouchableOpacity onPress={cancel} activeOpacity={0.7} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel evening routine</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  idleCard: {
    backgroundColor: colors.dark.background,
    borderRadius: radii.xl,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['5'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  idleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
    flex: 1,
  },
  idleText: {
    gap: 3,
  },
  idleTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.dark.text,
    letterSpacing: typography.letterSpacing.tight,
  },
  idleSub: {
    fontSize: typography.sizes.xs,
    color: colors.dark.text,
    opacity: 0.4,
    letterSpacing: typography.letterSpacing.wide,
  },

  activeCard: {
    backgroundColor: colors.dark.background,
    borderRadius: radii.xl,
    padding: spacing['6'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    marginBottom: spacing['5'],
  },
  activeTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.dark.text,
    letterSpacing: typography.letterSpacing.tight,
  },
  routineList: {
    gap: spacing['3'],
    marginBottom: spacing['5'],
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.glow.sunrise,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['1'],
  },
  routineLabel: {
    fontSize: typography.sizes.sm,
    color: colors.dark.text,
    opacity: 0.75,
    fontWeight: typography.weights.regular,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.md,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    marginBottom: spacing['5'],
  },
  countdownText: {
    fontSize: typography.sizes.sm,
    color: colors.dark.text,
    opacity: 0.6,
  },
  countdownValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.glow.sunrise,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingTop: spacing['2'],
  },
  cancelText: {
    fontSize: typography.sizes.xs,
    color: colors.dark.text,
    opacity: 0.35,
    letterSpacing: typography.letterSpacing.wide,
  },
});
