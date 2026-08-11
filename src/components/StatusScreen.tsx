import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';
import { Button } from './Button';

interface Props {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'danger';
}

// One reusable full-screen state: config errors, backend outages, and the
// error boundary's crash fallback all render through this rather than each
// having their own bespoke screen.
export function StatusScreen({ icon, title, message, actionLabel, onAction, tone = 'neutral' }: Props) {
  const iconColor = tone === 'danger' ? '#C0392B' : colors.accent.DEFAULT;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
          <Feather name={icon} size={28} color={iconColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction ? (
          <Button label={actionLabel} onPress={onAction} style={styles.action} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background.primary },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['8'],
    gap: spacing['3'],
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing['2'],
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: spacing['5'],
  },
});
