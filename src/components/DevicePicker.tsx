import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';

interface DeviceOption {
  id: string;
  name: string | null;
}

interface Props {
  devices: DeviceOption[];
  onSelect: (deviceId: string) => void;
}

export function DevicePicker({ devices, onSelect }: Props) {
  if (devices.length === 0) return null;

  return (
    <View style={styles.list}>
      {devices.map(device => (
        <TouchableOpacity
          key={device.id}
          style={styles.row}
          onPress={() => onSelect(device.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Connect to ${device.name ?? 'Somnara'}`}
        >
          <Feather name="bluetooth" size={16} color={colors.accent.DEFAULT} />
          <Text style={styles.name} numberOfLines={1}>{device.name ?? 'Somnara'}</Text>
          <Feather name="chevron-right" size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['2'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    backgroundColor: colors.background.elevated,
    borderRadius: radii.lg,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  name: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
});
