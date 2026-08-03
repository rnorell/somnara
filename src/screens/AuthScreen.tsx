import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform, KeyboardAvoidingView,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { colors, typography, spacing, radii } from '../theme';
import { toAppUser, User } from '../state/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface Props {
  onAuth: (user: User) => void;
}

function SocialButton({
  icon, label, onPress, style,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity style={[styles.socialBtn, style]} onPress={onPress} activeOpacity={0.8}>
      {icon}
      <Text style={styles.socialBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleApple() {
    if (Platform.OS !== 'ios') {
      setError('Apple Sign In is available on iPhone and iPad.');
      return;
    }
    try {
      if (!supabase) throw new Error('Authentication service is not configured');
      const AppleAuth = await import('expo-apple-authentication');
      const nonce = Crypto.randomUUID();
      const state = Crypto.randomUUID();
      const credential = await AppleAuth.signInAsync({
        nonce,
        state,
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken || credential.state !== state) {
        throw new Error('Apple authentication response could not be verified');
      }
      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce,
      });
      if (authError || !data.user) throw authError ?? new Error('Missing authenticated user');

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
      onAuth(toAppUser(data.user));
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple Sign In failed. Please try again.');
      }
    }
  }

  function handleGoogle() {
    setError('');
    setError('Google sign-in is disabled until its verified Supabase OAuth callback is configured.');
  }

  async function handleEmail() {
    setError('');
    setNotice('');
    if (!isSupabaseConfigured || !supabase) { setError('Authentication service is not configured.'); return; }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('Please enter a valid email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: name.trim().slice(0, 100) } },
        });
        if (authError) throw authError;
        if (data.session && data.user) onAuth(toAppUser(data.user));
        else setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (authError || !data.user) throw authError ?? new Error('Missing authenticated user');
        onAuth(toAppUser(data.user));
      }
    } catch {
      setError(mode === 'signin'
        ? 'Sign-in failed. Check your details and try again.'
        : 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF3E6', '#F5EBD8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Heading */}
            <Text style={styles.title}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? 'Sign in to your Somnara account'
                : 'Set up your personal sunrise profile'}
            </Text>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <SocialButton
                icon={<AppleIcon />}
                label="Apple"
                onPress={handleApple}
                style={styles.appleBtn}
              />
              <SocialButton
                icon={<GoogleIcon />}
                label="Google"
                onPress={handleGoogle}
                style={styles.googleBtn}
              />
            </View>

            <Divider />

            {/* Email form */}
            <View style={styles.form}>
              {mode === 'signup' && (
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full name"
                    placeholderTextColor={colors.text.tertiary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              )}

              <View style={styles.inputWrapper}>
                <Feather name="mail" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputPassword]}
                  placeholder="Password"
                  placeholderTextColor={colors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleEmail}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={16}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnLoading]}
                onPress={handleEmail}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Toggle mode */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}>
                <Text style={styles.toggleLink}>
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.legal}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function AppleIcon() {
  return (
    <View style={styles.appleIconWrap}>
      <Text style={styles.appleIconText}></Text>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIconWrap}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing['6'],
    paddingBottom: spacing['10'],
    alignItems: 'center',
  },
  logo: {
    width: 280,
    height: 160,
    marginBottom: -80,
    marginTop: spacing['4'],
    tintColor: colors.accent.DEFAULT,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing['1'],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing['8'],
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing['3'],
    width: '100%',
    marginBottom: spacing['6'],
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    borderWidth: 1.5,
  },
  appleBtn: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  googleBtn: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.DEFAULT,
  },
  socialBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  appleIconWrap: { width: 18, alignItems: 'center' },
  appleIconText: { fontSize: 17, color: '#fff', lineHeight: 20 },
  googleIconWrap: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#ddd',
  },
  googleG: {
    fontSize: 11, fontWeight: '700', color: '#4285F4', lineHeight: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing['6'],
    gap: spacing['3'],
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
  },
  dividerText: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    letterSpacing: typography.letterSpacing.wide,
  },
  form: { width: '100%', gap: spacing['3'] },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['4'],
    gap: spacing['3'],
  },
  inputIcon: { opacity: 0.6 },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text.primary,
    outlineStyle: 'none',
  } as any,
  inputPassword: { paddingRight: spacing['2'] },
  errorText: {
    fontSize: typography.sizes.xs,
    color: '#C0392B',
    textAlign: 'center',
    marginTop: -spacing['1'],
  },
  noticeText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xl,
    paddingVertical: spacing['5'],
    alignItems: 'center',
    marginTop: spacing['2'],
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnLoading: { opacity: 0.75 },
  submitBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#fff',
    letterSpacing: typography.letterSpacing.wide,
  },
  toggleRow: {
    flexDirection: 'row',
    marginTop: spacing['6'],
    alignItems: 'center',
  },
  toggleText: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  toggleLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.accent.DEFAULT,
  },
  legal: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing['5'],
    lineHeight: 18,
    opacity: 0.7,
    paddingHorizontal: spacing['4'],
  },
});
