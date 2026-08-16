import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { colors, typography, spacing, radii } from '../theme';
import { Alarm } from '../models/Alarm';
import { useSyncContext } from '../context/SyncContext';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS = [1, 2, 3, 4, 5];

function formatTime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function daysLabel(days: number[]) {
  if (days.length === 7) return 'Every day';
  if (JSON.stringify([...days].sort()) === JSON.stringify(WEEKDAYS)) return 'Weekdays';
  if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6])) return 'Weekends';
  return days.map(d => DAY_LABELS[d]).join('  ');
}

function AlarmToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const progress = useSharedValue(value ? 1 : 0);

  const TOGGLE_W = 46, TOGGLE_H = 26, THUMB = 20, TRAVEL = 46 - 20 - 8;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.border.strong, colors.accent.DEFAULT]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  const handle = () => {
    progress.value = withTiming(value ? 0 : 1, { duration: 260 });
    onToggle();
  };

  return (
    <TouchableOpacity onPress={handle} activeOpacity={0.85} hitSlop={10}>
      <Animated.View style={[styles.track, { width: TOGGLE_W, height: TOGGLE_H, borderRadius: TOGGLE_H / 2 }, trackStyle]}>
        <Animated.View style={[styles.thumb, { width: THUMB, height: THUMB, borderRadius: THUMB / 2 }, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function AlarmCard({ alarm, onToggle, onDelete }: {
  alarm: Alarm;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDim]}>
      <View style={styles.alarmCardLeft}>
        <Text style={[styles.alarmTime, !alarm.enabled && styles.alarmTimeDim]}>
          {formatTime(alarm.hour, alarm.minute)}
        </Text>
        <Text style={styles.alarmDays}>{daysLabel(alarm.days)}</Text>
        {alarm.label ? <Text style={styles.alarmLabel}>{alarm.label}</Text> : null}
      </View>
      <View style={styles.alarmCardRight}>
        <AlarmToggle value={alarm.enabled} onToggle={onToggle} />
        <TouchableOpacity onPress={onDelete} hitSlop={12} style={styles.deleteBtn}>
          <Feather name="trash-2" size={14} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TimeSpinner({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const inc = () => onChange(value >= max ? min : value + 1);
  const dec = () => onChange(value <= min ? max : value - 1);

  return (
    <View style={styles.spinner}>
      <TouchableOpacity onPress={inc} style={styles.spinnerBtn} activeOpacity={0.6}>
        <Feather name="chevron-up" size={22} color={colors.accent.DEFAULT} />
      </TouchableOpacity>
      <Text style={styles.spinnerValue}>{String(value).padStart(2, '0')}</Text>
      <TouchableOpacity onPress={dec} style={styles.spinnerBtn} activeOpacity={0.6}>
        <Feather name="chevron-down" size={22} color={colors.accent.DEFAULT} />
      </TouchableOpacity>
    </View>
  );
}

export function AlarmsTab() {
  const { alarms, setAlarms } = useSyncContext();
  const [adding, setAdding] = useState(false);
  const [newHour, setNewHour] = useState(7);
  const [newMinute, setNewMinute] = useState(0);
  const [newDays, setNewDays] = useState<number[]>(WEEKDAYS);

  const toggleDay = (d: number) => {
    setNewDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const saveAlarm = () => {
    if (newDays.length === 0) return;
    setAlarms([...alarms, {
      id: Crypto.randomUUID(),
      hour: newHour,
      minute: newMinute,
      days: [...newDays].sort(),
      enabled: true,
      label: '',
    }]);
    setAdding(false);
    setNewHour(7);
    setNewMinute(0);
    setNewDays(WEEKDAYS);
  };

  const toggleAlarm = (id: string) => {
    setAlarms(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAlarm = (id: string) => {
    setAlarms(alarms.filter(a => a.id !== id));
  };

  return (
    <View style={styles.container}>
      {/* Alarm list */}
      {alarms.map(alarm => (
        <AlarmCard
          key={alarm.id}
          alarm={alarm}
          onToggle={() => toggleAlarm(alarm.id)}
          onDelete={() => deleteAlarm(alarm.id)}
        />
      ))}

      {alarms.length === 0 && !adding && (
        <View style={styles.empty}>
          <Feather name="clock" size={32} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No alarms yet</Text>
        </View>
      )}

      {/* Add alarm form */}
      {adding && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>NEW ALARM</Text>

          {/* Time picker */}
          <View style={styles.timePicker}>
            <TimeSpinner value={newHour} min={0} max={23} onChange={setNewHour} />
            <Text style={styles.colon}>:</Text>
            <TimeSpinner value={newMinute} min={0} max={59} onChange={setNewMinute} />
          </View>

          {/* Day selector */}
          <Text style={styles.daysTitle}>REPEAT</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => {
              const on = newDays.includes(i);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, on && styles.dayChipActive]}
                  onPress={() => toggleDay(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayChipLabel, on && styles.dayChipLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => setAdding(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelFormText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, newDays.length === 0 && styles.saveBtnDisabled]}
              onPress={saveAlarm}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Save Alarm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add alarm button */}
      {!adding && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)} activeOpacity={0.8}>
          <Feather name="plus" size={18} color={colors.text.inverse} />
          <Text style={styles.addBtnText}>Add Alarm</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['4'],
    gap: spacing['4'],
  },

  // Alarm card
  alarmCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['5'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  alarmCardDim: {
    opacity: 0.55,
  },
  alarmCardLeft: {
    gap: 2,
  },
  alarmTime: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  alarmTimeDim: {
    color: colors.text.secondary,
  },
  alarmDays: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.regular,
    letterSpacing: typography.letterSpacing.wide,
  },
  alarmLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  alarmCardRight: {
    alignItems: 'center',
    gap: spacing['3'],
  },
  track: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  thumb: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteBtn: {
    padding: 4,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['12'],
    gap: spacing['3'],
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.text.tertiary,
  },

  // Add form
  addForm: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: spacing['6'],
    gap: spacing['5'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
  },
  spinner: {
    alignItems: 'center',
    gap: spacing['1'],
  },
  spinnerBtn: {
    padding: spacing['2'],
  },
  spinnerValue: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: -1,
    minWidth: 80,
    textAlign: 'center',
  },
  colon: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.light,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  daysTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
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
  dayChipActive: {
    backgroundColor: colors.accent.DEFAULT,
    borderColor: colors.accent.DEFAULT,
  },
  dayChipLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  dayChipLabelActive: {
    color: colors.text.inverse,
    fontWeight: typography.weights.semibold,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing['3'],
    marginTop: spacing['2'],
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  cancelFormText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    alignItems: 'center',
    backgroundColor: colors.accent.DEFAULT,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
  },

  // Add button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xl,
    paddingVertical: spacing['5'],
  },
  addBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
    letterSpacing: typography.letterSpacing.wide,
  },
});
