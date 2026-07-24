import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii } from '../theme';

const OPTIONS = [
  {
    duration: 15,
    label: 'Quick',
    sublabel: 'Sunrise',
    description: 'Sharp, energising start',
    gradient: ['#FAD98A', '#F5C060'] as const,
    iconSize: 32,
    iconTint: '#C88A30',
  },
  {
    duration: 30,
    label: 'Balanced',
    sublabel: 'Sunrise',
    description: 'Gentle and natural',
    gradient: ['#F5C87A', '#EDAA48'] as const,
    iconSize: 42,
    iconTint: '#B87830',
  },
  {
    duration: 45,
    label: 'Slow',
    sublabel: 'Sunrise',
    description: 'Deeply gradual awakening',
    gradient: ['#EDBA6A', '#E09838'] as const,
    iconSize: 52,
    iconTint: '#A06828',
  },
] as const;

interface Props {
  value?: number;
  onChange?: (duration: number) => void;
}

export function SunriseDurationPicker({ value = 30, onChange }: Props) {
  const [selected, setSelected] = useState(value);

  const handleSelect = (duration: number) => {
    setSelected(duration);
    onChange?.(duration);
  };

  return (
    <View>
      <Text style={styles.sectionLabel}>SUNRISE DURATION</Text>
      <View style={styles.row}>
        {OPTIONS.map(opt => {
          const active = selected === opt.duration;
          return (
            <TouchableOpacity
              key={opt.duration}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => handleSelect(opt.duration)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={opt.gradient}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                {/* Sun icon — larger = slower/more gradual */}
                <Image
                  source={require('../../assets/logo-icon.png')}
                  style={[styles.icon, { width: opt.iconSize, height: opt.iconSize, tintColor: opt.iconTint }]}
                  resizeMode="contain"
                />
              </LinearGradient>

              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.cardDuration, active && styles.cardDurationActive]}>
                  {opt.duration} min
                </Text>
                <Text style={styles.cardDesc}>{opt.description}</Text>
              </View>

              {active && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    marginBottom: spacing['4'],
  },
  row: {
    flexDirection: 'row',
    gap: spacing['3'],
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.background.elevated,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardActive: {
    borderColor: colors.accent.DEFAULT,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  cardGradient: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing['3'],
  },
  icon: {
    // width/height set inline per option
  },
  cardBody: {
    padding: spacing['3'],
    gap: 2,
  },
  cardLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  cardLabelActive: {
    color: colors.accent.DEFAULT,
  },
  cardDuration: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  cardDurationActive: {
    color: colors.text.primary,
  },
  cardDesc: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing['1'],
    lineHeight: 15,
  },
  activeBar: {
    height: 3,
    backgroundColor: colors.accent.DEFAULT,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
});
