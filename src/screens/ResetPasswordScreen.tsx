import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform, KeyboardAvoidingView,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { supabase } from '../lib/supabase';
import { SomnaraLogo } from '../components/SomnaraLogo';

interface Props {
  onDone: () => void;
}

export function ResetPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!supabase) { setError('Authentication service is not configured.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      onDone();
    } catch {
      setError('Could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF3E6', '#F5EBD8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SomnaraLogo />

            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>Choose a new password for your Somnara account</Text>

            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputPassword]}
                  placeholder="New password"
                  placeholderTextColor={colors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.text.tertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnLoading]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
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
});
