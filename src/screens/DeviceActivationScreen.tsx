import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform, ActivityIndicator,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence, withDelay,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { PairedDevice } from '../models/Device';
import { User } from '../state/authStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { classifyError } from '../lib/errors';
import { APP_ENV } from '../lib/env';
import { SomnaraLogo } from '../components/SomnaraLogo';

// See AuthScreen.tsx — same dev-only, no-backend preview bypass.
const DEV_AUTH_BYPASS = APP_ENV === 'development' && !isSupabaseConfigured;

interface Props {
  user: User;
  onActivated: (device: PairedDevice) => void;
}

type Step = 'enter' | 'verifying' | 'confirm' | 'success';

function maskActivationCode(raw: string) {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.length > 4 ? `••••-${clean.slice(-4)}` : '••••';
}

function PulsingRing({ delay = 0 }: { delay?: number }) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withTiming(1.6, { duration: 1800, easing: Easing.out(Easing.ease) }), -1,
    ));
    opacity.value = withDelay(delay, withRepeat(
      withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) }), -1,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

function CheckmarkCircle() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.4)) });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[styles.checkCircle, style]}>
      <Feather name="check" size={32} color="#fff" />
    </Animated.View>
  );
}

export function DeviceActivationScreen({ user, onActivated }: Props) {
  const [step, setStep] = useState<Step>('enter');
  const [serial, setSerial] = useState('');
  const [deviceName, setDeviceName] = useState('My Somnara');
  const [error, setError] = useState('');
  const [claimedDevice, setClaimedDevice] = useState<PairedDevice | null>(null);

  function handleSerialChange(text: string) {
    const clean = text.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    setSerial(clean);
    setError('');
  }

  async function handleActivate() {
    const clean = serial.replace(/-/g, '');
    if (clean.length < 8) {
      setError('Please enter a valid device code (e.g. SOM-2024-XXXX).');
      return;
    }
    setError('');
    setStep('verifying');
    if (!supabase) {
      if (DEV_AUTH_BYPASS) {
        setTimeout(() => {
          setClaimedDevice({
            id: `dev-device-${Date.now()}`,
            serial,
            name: deviceName.trim() || 'My Somnara',
            pairedAt: new Date().toISOString(),
            ownerId: user.id,
            ownerEmail: user.email,
          });
          setStep('confirm');
        }, 800);
        return;
      }
      setError('Secure device activation is not configured.');
      setStep('enter');
      return;
    }
    const { data, error: claimError } = await supabase.rpc('claim_device', {
      p_activation_code: serial.trim(),
      p_name: deviceName.trim().slice(0, 60) || 'My Somnara',
    });
    if (claimError) {
      // A thrown/network-shaped failure means we couldn't verify the code
      // at all — different from the RPC succeeding and correctly reporting
      // the code as invalid/already-claimed (data === null, below).
      const classified = classifyError(claimError);
      setError(classified.kind === 'network'
        ? classified.message
        : 'This device code could not be verified. Check it and try again.');
      setStep('enter');
      return;
    }
    if (!data) {
      setError('This device code could not be verified. Check it and try again.');
      setStep('enter');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const device: PairedDevice = {
      id: row.id,
      serial: row.serial,
      name: row.name,
      pairedAt: row.paired_at,
      ownerId: user.id,
      ownerEmail: user.email,
    };
    setClaimedDevice(device);
    setStep('confirm');
  }

  async function handlePair() {
    if (!claimedDevice) {
      setError('Secure device activation did not complete.');
      setStep('enter');
      return;
    }
    const name = deviceName.trim().slice(0, 60) || 'My Somnara';

    if (!supabase) {
      if (DEV_AUTH_BYPASS) {
        setStep('success');
        setTimeout(() => { onActivated({ ...claimedDevice, name }); }, 2000);
        return;
      }
      setError('Secure device activation did not complete.');
      setStep('enter');
      return;
    }

    const { error: updateError } = await supabase
      .from('paired_devices')
      .update({ name })
      .eq('id', claimedDevice.id)
      .eq('user_id', user.id);
    if (updateError) {
      setError('The device was verified, but its name could not be saved. Please try again.');
      return;
    }
    setStep('success');
    setTimeout(() => {
      onActivated({ ...claimedDevice, name });
    }, 2000);
  }

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF3E6', '#F5EBD8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <SomnaraLogo />

            {DEV_AUTH_BYPASS && (
              <View style={styles.devBanner}>
                <Feather name="tool" size={12} color={colors.text.tertiary} />
                <Text style={styles.devBannerText}>
                  Dev mode — any device code (8+ characters) will pair a fake local device.
                </Text>
              </View>
            )}

            {step === 'enter' && <EnterStep serial={serial} onChange={handleSerialChange} onNext={handleActivate} error={error} />}
            {step === 'verifying' && <VerifyingStep serial={maskActivationCode(serial)} />}
            {step === 'confirm' && (
              <ConfirmStep
                serial={claimedDevice?.serial ?? ''}
                deviceName={deviceName}
                onNameChange={setDeviceName}
                onPair={handlePair}
              />
            )}
            {step === 'success' && <SuccessStep name={deviceName} userName={user.name} />}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function EnterStep({ serial, onChange, onNext, error }: {
  serial: string; onChange: (t: string) => void; onNext: () => void; error: string;
}) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.iconBadge}>
        <Feather name="shield" size={28} color={colors.accent.DEFAULT} />
      </View>
      <Text style={styles.stepTitle}>Activate your Somnara</Text>
      <Text style={styles.stepSubtitle} numberOfLines={1}>
        Enter your device code to confirm ownership.
      </Text>

      {/* Device hint illustration */}
      <View style={styles.hintCard}>
        <View style={styles.hintDevice}>
          <View style={styles.hintDeviceBody} />
          <View style={styles.hintDeviceBase}>
            <View style={styles.hintCodeBox}>
              <Text style={styles.hintCodeLabel} numberOfLines={1}>SOM-2024-XXXX</Text>
            </View>
          </View>
        </View>
        <Text style={styles.hintText}>Code is on the underside of the base</Text>
      </View>

      <TextInput
        style={[styles.codeInput, error ? styles.codeInputError : null]}
        placeholder="SOM-XXXX-XXXX"
        placeholderTextColor={colors.text.tertiary}
        value={serial}
        onChangeText={onChange}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={14}
        returnKeyType="done"
        onSubmitEditing={onNext}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.primaryBtn} onPress={onNext} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Verify Device</Text>
        <Feather name="arrow-right" size={18} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.legalNote}>
        This links the device exclusively to your account. You can transfer ownership at any time in Settings.
      </Text>
    </View>
  );
}

function VerifyingStep({ serial }: { serial: string }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.ringContainer}>
        <PulsingRing delay={0} />
        <PulsingRing delay={600} />
        <PulsingRing delay={1200} />
        <View style={styles.ringCenter}>
          <Feather name="cpu" size={28} color={colors.accent.DEFAULT} />
        </View>
      </View>
      <Text style={styles.stepTitle}>Verifying device…</Text>
      <Text style={styles.stepSubtitle}>Checking {serial} with Somnara servers</Text>
      <ActivityIndicator color={colors.accent.DEFAULT} style={{ marginTop: spacing['4'] }} />
    </View>
  );
}

function ConfirmStep({ serial, deviceName, onNameChange, onPair }: {
  serial: string; deviceName: string; onNameChange: (t: string) => void; onPair: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <View style={[styles.iconBadge, styles.iconBadgeGreen]}>
        <Feather name="check-circle" size={28} color="#2ECC71" />
      </View>
      <Text style={styles.stepTitle}>Device confirmed</Text>
      <Text style={styles.stepSubtitle}>We found your Somnara. Pair it to your account to get started.</Text>

      <View style={styles.deviceCard}>
        <View style={styles.deviceCardRow}>
          <Text style={styles.deviceCardLabel}>Model</Text>
          <Text style={styles.deviceCardValue}>Somnara Pro</Text>
        </View>
        <View style={styles.deviceCardDivider} />
        <View style={styles.deviceCardRow}>
          <Text style={styles.deviceCardLabel}>Serial</Text>
          <Text style={styles.deviceCardValue}>{serial}</Text>
        </View>
        <View style={styles.deviceCardDivider} />
        <View style={styles.deviceCardRow}>
          <Text style={styles.deviceCardLabel}>Firmware</Text>
          <Text style={styles.deviceCardValue}>v2.4.1</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>NAME YOUR DEVICE</Text>
      <TextInput
        style={styles.nameInput}
        value={deviceName}
        onChangeText={onNameChange}
        placeholder="My Somnara"
        placeholderTextColor={colors.text.tertiary}
        maxLength={30}
        returnKeyType="done"
        onSubmitEditing={onPair}
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={onPair} activeOpacity={0.85}>
        <Feather name="link" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Pair to My Account</Text>
      </TouchableOpacity>
    </View>
  );
}

function SuccessStep({ name, userName }: { name: string; userName: string }) {
  return (
    <View style={styles.stepContainer}>
      <CheckmarkCircle />
      <Text style={styles.stepTitle}>Paired successfully!</Text>
      <Text style={styles.stepSubtitle}>
        <Text style={{ fontWeight: '600', color: colors.accent.DEFAULT }}>{name}</Text>
        {' '}is now linked to {userName}'s account.
      </Text>

      <View style={styles.successCard}>
        <Feather name="shield" size={16} color={colors.accent.DEFAULT} />
        <Text style={styles.successCardText}>
          Only you can control, reset, or transfer this device.
          If it's ever lost or sold, use Settings → Transfer Ownership.
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing['4'] }}>
        <ActivityIndicator color={colors.accent.DEFAULT} />
        <Text style={[styles.legalNote, { marginTop: spacing['3'] }]}>Setting up your experience…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: spacing['6'],
    paddingBottom: spacing['10'],
    alignItems: 'center',
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.background.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    marginBottom: spacing['4'],
  },
  devBannerText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    flexShrink: 1,
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing['6'],
    gap: spacing['4'],
  },
  iconBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: `${colors.accent.DEFAULT}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: `${colors.accent.DEFAULT}30`,
  },
  iconBadgeGreen: {
    backgroundColor: '#2ECC7115',
    borderColor: '#2ECC7130',
  },
  stepTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing['4'],
  },

  // Hint illustration
  hintCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.border.DEFAULT,
    padding: spacing['5'],
    width: '100%',
    alignItems: 'center',
    gap: spacing['3'],
  },
  hintDevice: { alignItems: 'center', gap: 0 },
  hintDeviceBody: {
    width: 80, height: 50,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 14,
    opacity: 0.3,
  },
  hintDeviceBase: {
    width: 140, height: 22,
    backgroundColor: colors.border.strong,
    borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  hintCodeBox: {
    backgroundColor: '#fff',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 3,
    flexShrink: 0,
  },
  hintCodeLabel: {
    fontSize: 9, fontWeight: '700',
    color: colors.text.primary, letterSpacing: 1,
  },
  hintText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    letterSpacing: typography.letterSpacing.wide,
  },

  codeInput: {
    width: '100%',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1.5, borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['4'],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    letterSpacing: 3,
    textAlign: 'center',
    outlineStyle: 'none',
  } as any,
  codeInputError: { borderColor: '#C0392B' },
  errorText: {
    fontSize: typography.sizes.xs, color: '#C0392B', textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xl,
    paddingVertical: spacing['5'],
    width: '100%',
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#fff',
    letterSpacing: typography.letterSpacing.wide,
  },
  legalNote: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
    paddingHorizontal: spacing['2'],
  },

  // Verifying rings
  ringContainer: {
    width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: colors.accent.DEFAULT,
  },
  ringCenter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: `${colors.accent.DEFAULT}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: `${colors.accent.DEFAULT}40`,
  },

  // Confirm step
  deviceCard: {
    width: '100%',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['2'],
  },
  deviceCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing['4'],
  },
  deviceCardLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontWeight: typography.weights.regular,
  },
  deviceCardValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  deviceCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    alignSelf: 'flex-start',
    marginBottom: -spacing['2'],
  },
  nameInput: {
    width: '100%',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1.5, borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['4'],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    outlineStyle: 'none',
  } as any,

  // Success step
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2ECC71',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  successCard: {
    flexDirection: 'row',
    gap: spacing['3'],
    backgroundColor: `${colors.accent.DEFAULT}10`,
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: `${colors.accent.DEFAULT}25`,
    padding: spacing['5'],
    width: '100%',
    alignItems: 'flex-start',
  },
  successCardText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
