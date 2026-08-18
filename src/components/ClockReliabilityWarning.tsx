import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme';

export function ClockReliabilityWarning() {
  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Feather name="alert-triangle" size={22} color="#9C2F25" />
      <View style={styles.copy}>
        <Text style={styles.title}>Reconnect now to protect your alarms</Text>
        <Text style={styles.body}>Somnara lost its time. Open the connection and keep the app near the device while the clock resets.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing['3'],
    padding: spacing['4'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#E3A49E',
    backgroundColor: '#FFF0EE',
  },
  copy: { flex: 1 },
  title: {
    color: '#7D211A',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing['1'],
  },
  body: {
    color: colors.text.primary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
});
