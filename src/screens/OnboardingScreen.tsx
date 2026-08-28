import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  SafeAreaView, Dimensions, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence, withDelay,
  interpolateColor, Easing, SharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import { colors, typography, spacing, radii } from '../theme';
import { DeviceIllustration } from '../components/DeviceIllustration';
import { SunriseDurationPicker } from '../components/SunriseDurationPicker';
import { useSyncContext } from '../context/SyncContext';
import { useBleConnection } from '../ble/useBleConnection';

const { width: W, height: H } = Dimensions.get('window');
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS = [1, 2, 3, 4, 5];

// ─── Fade wrapper ────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[dots.dot, i === current && dots.dotActive]} />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border.strong },
  dotActive: { width: 18, backgroundColor: colors.accent.DEFAULT },
});

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ), -1,
    );
  }, []);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF0E0', '#F5E8D0']} style={s.fill}>
      <SafeAreaView style={s.fill}>
        <View style={s.welcomeInner}>
          <FadeIn delay={100}>
            <Image source={require('../../assets/logo.png')} style={s.welcomeLogo} resizeMode="contain" tintColor={colors.accent.DEFAULT} />
          </FadeIn>
          <FadeIn delay={900}>
            <Text style={s.welcomeSub}>
              Your light-based alarm clock that wakes you{'\n'}with a gentle, natural sunrise.
            </Text>
          </FadeIn>
          <FadeIn delay={1300}>
            <Animated.View style={btnStyle}>
              <TouchableOpacity style={s.beginBtn} onPress={onNext} activeOpacity={0.85}>
                <Text style={s.beginBtnText}>Begin setup</Text>
                <Feather name="arrow-right" size={18} color={colors.text.inverse} />
              </TouchableOpacity>
            </Animated.View>
          </FadeIn>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Step 1: Power On ─────────────────────────────────────────────────────────
function PowerOnStep({ onNext }: { onNext: () => void }) {
  return (
    <LinearGradient colors={['#FDF8F0', '#FAF0E0', '#F5E8D0']} style={s.fill}>
      <SafeAreaView style={s.fill}>
        <View style={s.stepInner}>
          <StepDots total={4} current={0} />
          <FadeIn delay={100}>
            <View style={s.illustrationWrap}>
              <DeviceIllustration isOn={false} />
            </View>
          </FadeIn>
          <FadeIn delay={300}>
            <Text style={s.stepTitle}>Turn on your Somnara</Text>
          </FadeIn>
          <FadeIn delay={500}>
            <Text style={s.stepSub}>Connect your Somnara to power before Bluetooth setup.</Text>
          </FadeIn>
          <FadeIn delay={700}>
            <TouchableOpacity style={s.nextBtn} onPress={onNext} activeOpacity={0.85}>
              <Text style={s.nextBtnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color={colors.text.inverse} />
            </TouchableOpacity>
          </FadeIn>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Step 2: Bluetooth ────────────────────────────────────────────────────────
function BluetoothStep({ onNext }: { onNext: () => void }) {
  const { state, error, connect } = useBleConnection();

  const ring1 = useSharedValue(1);
  const ring2 = useSharedValue(1);
  const ring3 = useSharedValue(1);
  const ringOp1 = useSharedValue(0.6);
  const ringOp2 = useSharedValue(0.6);
  const ringOp3 = useSharedValue(0.6);

  useEffect(() => {
    const loop = (sv: SharedValue<number>, opSv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(delay, withRepeat(withSequence(withTiming(2.4, { duration: 1800 }), withTiming(1, { duration: 0 })), -1));
      opSv.value = withDelay(delay, withRepeat(withSequence(withTiming(0, { duration: 1800 }), withTiming(0.6, { duration: 0 })), -1));
    };
    loop(ring1, ringOp1, 0);
    loop(ring2, ringOp2, 600);
    loop(ring3, ringOp3, 1200);

    return undefined;
  }, []);

  const r1s = useAnimatedStyle(() => ({ transform: [{ scale: ring1.value }], opacity: ringOp1.value }));
  const r2s = useAnimatedStyle(() => ({ transform: [{ scale: ring2.value }], opacity: ringOp2.value }));
  const r3s = useAnimatedStyle(() => ({ transform: [{ scale: ring3.value }], opacity: ringOp3.value }));
  const busy = state === 'scanning' || state === 'connecting';
  const connected = state === 'connected_unverified' || state === 'ready';
  const title = state === 'idle'
    ? 'Connect your Somnara'
    : state === 'scanning'
      ? 'Looking for Somnara…'
      : state === 'connecting'
        ? 'Connecting…'
        : state === 'ready'
          ? 'Development device ready'
          : state === 'connected_unverified'
            ? 'Somnara connected'
            : state === 'permission_required'
              ? 'Bluetooth permission required'
              : 'Connection stopped';
  const message = state === 'connected_unverified'
    ? 'If your phone asks to bond, accept the prompt. It starts after Notify is enabled or after the first data packet.'
    : state === 'permission_required'
      ? 'Allow Bluetooth access, then try again.'
      : error ?? 'Keep your phone near Somnara. The bonding prompt starts after the first secure data exchange.';

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF0E0', '#F5E8D0']} style={s.fill}>
      <SafeAreaView style={s.fill}>
        <View style={s.stepInner}>
          <StepDots total={4} current={1} />
          <View style={s.btCenter}>
            <Animated.View style={[s.btRing, r3s]} />
            <Animated.View style={[s.btRing, r2s]} />
            <Animated.View style={[s.btRing, r1s]} />
            <View style={s.btCore}>
              <Feather name={connected ? 'check' : 'bluetooth'} size={28} color={colors.accent.DEFAULT} />
            </View>
          </View>
          <FadeIn delay={200}>
            <Text style={s.stepTitle}>{title}</Text>
          </FadeIn>
          <FadeIn delay={400}>
            <Text style={s.stepSub}>{message}</Text>
          </FadeIn>
          {!busy && state !== 'connected_unverified' && (
            <FadeIn delay={500}>
              <TouchableOpacity
                style={s.nextBtn}
                onPress={state === 'ready' ? onNext : () => { void connect(); }}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={s.nextBtnText}>{state === 'ready' ? 'Continue' : state === 'idle' ? 'Find My Somnara' : 'Try Again'}</Text>
                <Feather name={state === 'ready' ? 'arrow-right' : 'refresh-cw'} size={16} color={colors.text.inverse} />
              </TouchableOpacity>
            </FadeIn>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Step 3: Sunrise animation ────────────────────────────────────────────────
const SUN_W = 220;
const HORIZON_Y = H * 0.55;

function SunriseStep({ onNext }: { onNext: () => void }) {
  const progress = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 10000, easing: Easing.out(Easing.ease) });
    textOpacity.value = withDelay(1500, withTiming(1, { duration: 1200 }));
    const t = setTimeout(onNext, 10500);
    return () => clearTimeout(t);
  }, []);

  const skyStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value,
      [0, 0.25, 0.55, 0.8, 1],
      ['#0E0A04', '#2A1008', '#8B3A0C', '#D4780A', '#FAD090'],
    ),
  }));

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 160 }],
    backgroundColor: interpolateColor(progress.value,
      [0, 0.4, 0.75, 1],
      ['#8B2000', '#E05010', '#F09030', '#FAD070'],
    ),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.55,
    transform: [
      { translateY: (1 - progress.value) * 160 },
      { scaleX: 1 + progress.value * 1.2 },
      { scaleY: 1 + progress.value * 0.6 },
    ],
  }));

  const groundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value,
      [0, 0.5, 1],
      ['#080602', '#1A0C04', '#3A200A'],
    ),
  }));

  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as any }));

  return (
    <View style={s.fill}>
      <Animated.View style={[s.fill, skyStyle]}>
        {/* Ground */}
        <Animated.View style={[s.ground, groundStyle]} />

        {/* Sun glow */}
        <View style={[s.sunContainer, { top: HORIZON_Y - SUN_W / 2 }]}>
          <Animated.View style={[s.sunGlow, glowStyle]} />
          {/* Sun arc */}
          <Animated.View style={[s.sun, sunStyle]} />
        </View>

        {/* Horizon line */}
        <View style={[s.horizon, { top: HORIZON_Y }]} />

        {/* Overlay text */}
        <SafeAreaView style={s.sunriseOverlay}>
          <Animated.View style={[s.sunriseTextWrap, textStyle]}>
            <Text style={s.sunriseTitle}>This is how Somnara{'\n'}wakes you.</Text>
            <Text style={s.sunriseSub}>A gentle sunrise, every morning.</Text>
          </Animated.View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressBar, progressStyle]} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─── Step 4: Wake time ────────────────────────────────────────────────────────
function WakeTimeStep({ onComplete }: { onComplete: (hour: number, minute: number, days: number[], sunriseDuration: 15 | 30 | 45) => void }) {
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(30);
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  const [sunriseDuration, setSunriseDuration] = useState<15 | 30 | 45>(30);

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF0E0', '#F5E8D0']} style={s.fill}>
      <SafeAreaView style={s.fill}>
        <ScrollView contentContainerStyle={s.stepInnerScroll} showsVerticalScrollIndicator={false}>
          <StepDots total={4} current={3} />
          <FadeIn delay={100}>
            <Text style={s.stepTitle}>When would you like to wake up?</Text>
            <Text style={s.stepSub}>You can change this any time from the Alarms tab.</Text>
          </FadeIn>

          <FadeIn delay={300}>
            <View style={s.timePicker}>
              <Spinner value={hour} min={0} max={23} onChange={setHour} />
              <Text style={s.colon}>:</Text>
              <Spinner value={minute} min={0} max={59} onChange={setMinute} />
            </View>
          </FadeIn>

          <FadeIn delay={500}>
            <Text style={s.daysLabel}>REPEAT</Text>
            <View style={s.daysRow}>
              {DAY_LABELS.map((l, i) => {
                const on = days.includes(i);
                return (
                  <TouchableOpacity
                    key={i} style={[s.dayChip, on && s.dayChipOn]}
                    onPress={() => toggleDay(i)} activeOpacity={0.7}
                  >
                    <Text style={[s.dayChipTxt, on && s.dayChipTxtOn]}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FadeIn>

          <FadeIn delay={600}>
            <View style={s.sunrisePicker}>
              <SunriseDurationPicker value={sunriseDuration} onChange={d => setSunriseDuration(d as 15 | 30 | 45)} />
            </View>
          </FadeIn>

          <FadeIn delay={700}>
            <TouchableOpacity
              style={[s.nextBtn, days.length === 0 && { opacity: 0.4 }]}
              onPress={() => days.length > 0 && onComplete(hour, minute, days, sunriseDuration)}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnText}>Start my mornings</Text>
              <Feather name="sunrise" size={16} color={colors.text.inverse} />
            </TouchableOpacity>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Spinner({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={s.spinner}>
      <TouchableOpacity onPress={() => onChange(value >= max ? min : value + 1)} style={s.spinBtn} activeOpacity={0.6}>
        <Feather name="chevron-up" size={26} color={colors.accent.DEFAULT} />
      </TouchableOpacity>
      <Text style={s.spinValue}>{String(value).padStart(2, '0')}</Text>
      <TouchableOpacity onPress={() => onChange(value <= min ? max : value - 1)} style={s.spinBtn} activeOpacity={0.6}>
        <Feather name="chevron-down" size={26} color={colors.accent.DEFAULT} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const next = () => setStep(s => s + 1);
  const { alarms, setAlarms, setPreferences } = useSyncContext();

  const finishSetup = (hour: number, minute: number, days: number[], sunriseDuration: 15 | 30 | 45) => {
    setAlarms([{
      id: alarms[0]?.id ?? Crypto.randomUUID(),
      hour, minute, days,
      enabled: true,
      label: 'Sunrise alarm',
      sunriseDuration,
    }]);
    setPreferences({ sunriseDuration });
    onComplete();
  };

  return (
    <View style={s.fill}>
      {step === 0 && <WelcomeStep onNext={next} />}
      {step === 1 && <PowerOnStep onNext={next} />}
      {step === 2 && <BluetoothStep onNext={next} />}
      {step === 3 && <SunriseStep onNext={next} />}
      {step === 4 && <WakeTimeStep onComplete={finishSetup} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  fill: { flex: 1 },

  // Welcome
  welcomeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['8'],
    gap: spacing['4'],
  },
  welcomeLogo: {
    width: W * 0.75,
    height: W * 0.4,
  },
  welcomeSub: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: typography.weights.light,
    marginTop: spacing['2'],
  },
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    backgroundColor: colors.accent.DEFAULT,
    paddingVertical: spacing['5'],
    paddingHorizontal: spacing['10'],
    borderRadius: radii.full,
    marginTop: spacing['6'],
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  beginBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
    letterSpacing: typography.letterSpacing.wide,
  },

  // Steps shared
  stepInner: {
    flex: 1,
    paddingHorizontal: spacing['7'],
    paddingTop: spacing['8'],
    paddingBottom: spacing['8'],
    gap: spacing['5'],
    justifyContent: 'center',
  },
  stepInnerScroll: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: spacing['7'],
    paddingTop: spacing['8'],
    paddingBottom: spacing['8'],
    gap: spacing['5'],
    justifyContent: 'center',
  },
  sunrisePicker: {
    width: '100%',
  },
  illustrationWrap: {
    alignItems: 'center',
    marginVertical: spacing['4'],
  },
  stepTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
    lineHeight: 38,
  },
  stepSub: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: typography.weights.light,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['3'],
    backgroundColor: colors.accent.DEFAULT,
    paddingVertical: spacing['5'],
    borderRadius: radii.xl,
    marginTop: spacing['4'],
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  nextBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
    letterSpacing: typography.letterSpacing.wide,
  },

  // Bluetooth
  btCenter: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    marginVertical: spacing['8'],
  },
  btRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: colors.accent.light,
  },
  btCore: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.background.elevated,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },

  // Sunrise
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: HORIZON_Y,
  },
  sunContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sunGlow: {
    position: 'absolute',
    width: SUN_W * 1.6,
    height: SUN_W * 0.8,
    borderRadius: SUN_W * 0.8,
    backgroundColor: '#F09030',
    bottom: 0,
  },
  sun: {
    width: SUN_W,
    height: SUN_W / 2,
    borderTopLeftRadius: SUN_W / 2,
    borderTopRightRadius: SUN_W / 2,
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,140,30,0.25)',
  },
  sunriseOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sunriseTextWrap: {
    alignItems: 'center',
    paddingTop: spacing['16'],
    gap: spacing['3'],
  },
  sunriseTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.light,
    color: '#FDF0DC',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: typography.letterSpacing.tight,
  },
  sunriseSub: {
    fontSize: typography.sizes.base,
    color: 'rgba(253,240,220,0.6)',
    textAlign: 'center',
    fontWeight: typography.weights.light,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: spacing['8'],
    marginBottom: spacing['10'],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,200,100,0.7)',
    borderRadius: 2,
  },

  // Wake time
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['3'],
  },
  spinner: { alignItems: 'center', gap: 2 },
  spinBtn: { padding: spacing['3'] },
  spinValue: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: -2,
    minWidth: 88,
    textAlign: 'center',
  },
  colon: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.light,
    color: colors.text.tertiary,
    marginBottom: 6,
  },
  daysLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing['3'],
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border.strong,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  dayChipOn: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  dayChipTxt: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  dayChipTxtOn: {
    color: colors.text.inverse,
    fontWeight: typography.weights.semibold,
  },
});
