import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

interface Props {
  isOn: boolean;
}

export function DeviceIllustration({ isOn }: Props) {
  const glowOpacity = useSharedValue(0.4);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    if (isOn) {
      glowOpacity.value = withRepeat(
        withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
        -1,
        true
      );
      glowScale.value = withRepeat(
        withTiming(1.12, { duration: 3000, easing: Easing.inOut(Easing.sine) }),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(0.15, { duration: 800 });
      glowScale.value = withTiming(1, { duration: 800 });
    }
  }, [isOn]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.7,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.outerGlow, outerGlowStyle]} />
      <Animated.View style={[styles.midGlow, innerGlowStyle]} />
      <View style={styles.device}>
        <View style={[styles.light, isOn && styles.lightOn]} />
        <View style={styles.body}>
          <View style={styles.base} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  outerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.glow.sunrise,
  },
  midGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.glow.warm,
  },
  device: {
    alignItems: 'center',
  },
  light: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.border.DEFAULT,
  },
  lightOn: {
    backgroundColor: colors.glow.sunrise,
  },
  body: {
    alignItems: 'center',
    marginTop: 6,
  },
  base: {
    width: 88,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border.strong,
  },
});
