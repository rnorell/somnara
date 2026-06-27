import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../theme';
import { DeviceStatus, ModeLabels } from '../models/Device';

interface Props {
  device: DeviceStatus;
}

function StatusRow({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {active !== undefined && (
          <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />
        )}
        <Text style={[styles.rowValue, active === false && styles.rowValueMuted]}>{value}</Text>
      </View>
    </View>
  );
}

export function StatusCard({ device }: Props) {
  return (
    <View style={styles.card}>
      <StatusRow
        label="Somnara"
        value={device.isConnected ? 'Connected' : 'Searching…'}
        active={device.isConnected}
      />
      <View style={styles.divider} />
      <StatusRow
        label="Device"
        value={device.isOn ? 'On' : 'Off'}
        active={device.isOn}
      />
      <View style={styles.divider} />
      <StatusRow
        label="Mode"
        value={ModeLabels[device.mode]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['4'],
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing['4'],
  },
  rowLabel: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    fontWeight: typography.weights.regular,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
  },
  dotActive: {
    backgroundColor: colors.success,
  },
  dotInactive: {
    backgroundColor: colors.text.tertiary,
  },
  rowValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  rowValueMuted: {
    color: colors.text.tertiary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
  },
});
