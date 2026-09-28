import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { useSyncContext } from '../context/SyncContext';
import { alarmSubtitle, daysLabel, formatTime, nextAlarm } from '../lib/alarmSchedule';
import { Toggle } from './Toggle';

interface Props {
  onPress: () => void;
}

export function NextAlarmCard({ onPress }: Props) {
  const { alarms, setAlarms } = useSyncContext();
  const upcoming = nextAlarm(alarms);
  // Fall back to the first alarm so a disabled one can be re-enabled from Home.
  const alarm = upcoming?.alarm ?? alarms[0];

  const toggle = () => {
    if (!alarm) return;
    setAlarms(alarms.map(a => a.id === alarm.id ? { ...a, enabled: !a.enabled } : a));
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.shadow}>
      <LinearGradient colors={['#FBF4EA', '#F3E6D4']} style={styles.card}>
        {/* Soft layered hills */}
        <View style={[styles.hill, styles.hillBack]} />
        <View style={[styles.hill, styles.hillFront]} />

        <View style={styles.topRow}>
          <Text style={styles.label}>NEXT ALARM</Text>
          {alarm ? <Toggle value={alarm.enabled} onToggle={toggle} label="Alarm enabled" /> : null}
        </View>

        {alarm ? (
          <View style={[styles.body, !alarm.enabled && styles.dim]}>
            <Text style={styles.time}>{formatTime(alarm.hour, alarm.minute)}</Text>
            <View style={styles.bottomRow}>
              <View>
                <Text style={styles.days}>{daysLabel(alarm.days)}</Text>
                <Text style={styles.sub}>{alarmSubtitle(alarm)}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.text.secondary} />
            </View>
          </View>
        ) : (
          <View style={styles.bottomRow}>
            <Text style={styles.empty}>No alarms yet — tap to add one</Text>
            <Feather name="chevron-right" size={20} color={colors.text.secondary} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii['2xl'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  card: {
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['4'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFFAA',
  },
  hill: {
    position: 'absolute',
    borderRadius: 400,
  },
  hillBack: {
    width: 420, height: 220, right: -160, bottom: -170,
    backgroundColor: '#EAD8C0',
    opacity: 0.55,
  },
  hillFront: {
    width: 460, height: 200, left: -120, bottom: -165,
    backgroundColor: '#E6D1B6',
    opacity: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.secondary,
  },
  body: {},
  dim: { opacity: 0.5 },
  time: {
    fontSize: 40,
    fontWeight: typography.weights.regular,
    color: colors.text.primary,
    letterSpacing: -1,
    marginTop: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing['1'],
  },
  days: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  sub: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  empty: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    marginTop: spacing['4'],
  },
});
