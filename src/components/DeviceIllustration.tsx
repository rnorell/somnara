import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
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
  const glowOpacity = useSharedValue(0.2);
  const glowScale = useSharedValue(0.95);

  useEffect(() => {
    if (isOn) {
      glowOpacity.value = withRepeat(
        withTiming(0.55, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      glowScale.value = withRepeat(
        withTiming(1.08, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(0.08, { duration: 1000 });
      glowScale.value = withTiming(0.95, { duration: 1000 });
    }
  }, [isOn]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 1.4,
    transform: [{ scale: glowScale.value * 0.88 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.outerGlow, outerGlowStyle]} />
      <Animated.View style={[styles.innerGlow, innerGlowStyle]} />
      <Image
        source={require('../../assets/device.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,
    height: 240,
  },
  outerGlow: {
    position: 'absolute',
    width: 280,
    height: 200,
    borderRadius: 140,
    backgroundColor: colors.glow.sunrise,
  },
  innerGlow: {
    position: 'absolute',
    width: 200,
    height: 140,
    borderRadius: 100,
    backgroundColor: colors.glow.warm,
  },
  image: {
    width: 300,
    height: 220,
  },
});
