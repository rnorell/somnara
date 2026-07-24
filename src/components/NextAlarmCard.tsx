import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '../theme';

const MESSAGES = [
  'A consistent wake-up time improves sleep quality.',
  'Your morning begins with light, not noise.',
  'Gentle light is kinder than any alarm.',
  'Another great morning starts here.',
  'The softest mornings begin the night before.',
  'You deserve a peaceful start to your day.',
  'Rise gently. Live fully.',
];

const TOGGLE_W = 56;
const TOGGLE_H = 32;
const THUMB = 24;
const TRAVEL = TOGGLE_W - THUMB - 8;

export function NextAlarmCard() {
  const [enabled, setEnabled] = useState(true);

  const progress = useSharedValue(1);
  const pulse = useSharedValue(1);

  const message = MESSAGES[new Date().getDay() % MESSAGES.length];

  const startPulse = () => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  };

  useEffect(() => {
    startPulse();
  }, []);

  const onToggle = () => {
    const next = !enabled;
    setEnabled(next);
    progress.value = withTiming(next ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    if (next) {
      startPulse();
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 400 });
    }
  };

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.border.strong, colors.accent.DEFAULT],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.4 + progress.value * 0.6,
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + progress.value * 0.4,
  }));

  const cardGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.05 + progress.value * 0.12,
  }));

  return (
    <Animated.View style={[styles.card, cardGlowStyle]}>
      {/* Label row + toggle */}
      <View style={styles.topRow}>
        <Text style={styles.cardLabel}>NEXT SUNRISE</Text>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.85} hitSlop={12}>
          <Animated.View style={[styles.track, trackStyle]}>
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Time + sunrise icon */}
      <View style={styles.timeBlock}>
        <Animated.Image
          source={require('../../assets/logo-icon.png')}
          style={[styles.sunriseIcon, iconStyle]}
          resizeMode="contain"
          tintColor={colors.accent.DEFAULT}
        />
        <View>
          <Text style={styles.time}>06:30</Text>
          <Text style={styles.when}>Tomorrow</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Detail rows */}
      <Animated.View style={dimStyle}>
        <DetailRow icon="sun" label="Sunrise begins" value="06:00" />
        <View style={styles.thinDivider} />
        <DetailRow icon="clock" label="Sunrise duration" value="30 min" />
        <View style={styles.thinDivider} />
        <DetailRow icon="volume-2" label="Alarm sound" value="Birds" />
        <View style={styles.thinDivider} />
        <DetailRow icon="repeat" label="Repeat" value="Weekdays" />
      </Animated.View>

      <View style={styles.divider} />

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6}>
          <Text style={styles.actionEdit}>Edit Alarm</Text>
        </TouchableOpacity>
        <View style={styles.actionSep} />
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6}>
          <Text style={styles.actionSkip}>Skip Tomorrow</Text>
        </TouchableOpacity>
      </View>

      {/* Daily message */}
      <View style={styles.messageWrap}>
        <Text style={styles.message}>"{message}"</Text>
      </View>
    </Animated.View>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name'] ; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={14} color={colors.accent.DEFAULT} style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAF8F5',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['7'],
    paddingTop: spacing['7'],
    paddingBottom: spacing['5'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 28,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['6'],
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
  },
  track: {
    width: TOGGLE_W,
    height: TOGGLE_H,
    borderRadius: TOGGLE_H / 2,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
    marginBottom: spacing['6'],
  },
  sunriseIcon: {
    width: 52,
    height: 52,
  },
  time: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: -1,
    lineHeight: 52,
  },
  when: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.text.secondary,
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
    marginVertical: spacing['5'],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['3'],
  },
  detailIcon: {
    marginRight: spacing['3'],
  },
  detailLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  thinDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
    marginLeft: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing['3'],
    alignItems: 'center',
  },
  actionSep: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: colors.border.strong,
  },
  actionEdit: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.accent.DEFAULT,
    letterSpacing: typography.letterSpacing.wide,
  },
  actionSkip: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    letterSpacing: typography.letterSpacing.wide,
  },
  messageWrap: {
    marginTop: spacing['4'],
    paddingTop: spacing['4'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.DEFAULT,
  },
  message: {
    fontSize: typography.sizes.xs,
    fontStyle: 'italic',
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.wide,
    lineHeight: 18,
  },
});
