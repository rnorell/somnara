import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { colors, typography, spacing, radii } from '../theme';
import { Alarm } from '../models/Alarm';
import { useSyncContext } from '../context/SyncContext';
import { SunriseDurationPicker } from './SunriseDurationPicker';
import { Toggle } from './Toggle';
import { alarmSubtitle, daysLabel, formatTime } from '../lib/alarmSchedule';
import { useDeviceAlarms } from './useDeviceAlarms';
import { MAX_DEVICE_ALARMS } from '../ble/deviceAlarm';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS = [1, 2, 3, 4, 5];

function AlarmCard({ alarm, busy, onToggle, onDelete, onSkip, onEdit }: {
  alarm: Alarm;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSkip: () => void;
  onEdit: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.alarmCard}
      onPress={onEdit}
      activeOpacity={0.8}
    >
      <View style={[styles.alarmCardLeft, !alarm.enabled && styles.alarmCardDim]}>
        <Text style={[styles.alarmTime, !alarm.enabled && styles.alarmTimeDim]}>
          {formatTime(alarm.hour, alarm.minute)}
        </Text>
        <Text style={styles.alarmDays}>{daysLabel(alarm.days)}</Text>
        <Text style={styles.alarmLabel}>{alarmSubtitle(alarm)}</Text>
        <TouchableOpacity onPress={onSkip} disabled={busy} accessibilityLabel={alarm.skipNext ? 'Clear skip' : 'Skip tomorrow'}>
          <Text style={styles.skipText}>{alarm.skipNext ? 'Clear skip' : 'Skip tomorrow'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.alarmCardRight}>
        <Toggle value={alarm.enabled} onToggle={busy ? () => undefined : onToggle} label="Alarm enabled" />
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onDelete} disabled={busy} hitSlop={12} style={styles.deleteBtn} accessibilityLabel="Delete alarm">
            <Feather name="trash-2" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
          <Feather name="chevron-right" size={20} color={colors.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
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
  const { alarms, preferences } = useSyncContext();
  const { ready, busy, error, save, toggle, remove, skip } = useDeviceAlarms();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formHour, setFormHour] = useState(7);
  const [formMinute, setFormMinute] = useState(0);
  const [formDays, setFormDays] = useState<number[]>(WEEKDAYS);
  const [formSunrise, setFormSunrise] = useState<15 | 30 | 45>(preferences.sunriseDuration);

  const toggleDay = (d: number) => {
    setFormDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormHour(7);
    setFormMinute(0);
    setFormDays(WEEKDAYS);
    setFormSunrise(preferences.sunriseDuration);
    setFormOpen(true);
  };

  const openEditForm = (alarm: Alarm) => {
    setEditingId(alarm.id);
    setFormHour(alarm.hour);
    setFormMinute(alarm.minute);
    setFormDays(alarm.days);
    setFormSunrise(alarm.sunriseDuration ?? preferences.sunriseDuration);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const saveAlarm = () => {
    if (formDays.length === 0 || busy) return;
    if (!editingId && alarms.length >= MAX_DEVICE_ALARMS) return;
    const existing = alarms.find(alarm => alarm.id === editingId);
    void save({
      id: existing?.id ?? Crypto.randomUUID(),
      hour: formHour,
      minute: formMinute,
      days: [...formDays].sort(),
      enabled: existing?.enabled ?? true,
      label: existing?.label ?? '',
      sunriseDuration: formSunrise,
      deviceSlot: existing?.deviceSlot,
      finalBrightness: existing?.finalBrightness,
      soundId: existing?.soundId,
      volume: existing?.volume,
      skipNext: existing?.skipNext,
    });
    closeForm();
  };

  const deleteAlarm = (id: string) => {
    const alarm = alarms.find(item => item.id === id);
    if (!alarm || busy) return;
    void remove(alarm);
    if (editingId === id) closeForm();
  };

  return (
    <View style={styles.container}>
      <View style={styles.notice}>
        <Feather name="info" size={14} color={colors.accent.dark} />
        <Text style={styles.noticeText}>
          {ready
            ? 'Changes are sent to your Somnara.'
            : 'Connect your Somnara to send these alarms to the clock.'}
        </Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Alarm list */}
      {alarms.map(alarm => (
        <AlarmCard
          key={alarm.id}
          alarm={alarm}
          busy={busy}
          onToggle={() => toggle(alarm)}
          onDelete={() => deleteAlarm(alarm.id)}
          onSkip={() => { void skip(alarm); }}
          onEdit={() => { if (!busy) openEditForm(alarm); }}
        />
      ))}

      {alarms.length === 0 && !formOpen && (
        <View style={styles.empty}>
          <Feather name="clock" size={32} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No alarms yet</Text>
        </View>
      )}

      {/* Add/edit alarm form */}
      {formOpen && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>{editingId ? 'EDIT ALARM' : 'NEW ALARM'}</Text>

          {/* Time picker */}
          <View style={styles.timePicker}>
            <TimeSpinner value={formHour} min={0} max={23} onChange={setFormHour} />
            <Text style={styles.colon}>:</Text>
            <TimeSpinner value={formMinute} min={0} max={59} onChange={setFormMinute} />
          </View>

          {/* Day selector */}
          <Text style={styles.daysTitle}>REPEAT</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => {
              const on = formDays.includes(i);
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

          {/* Sunrise duration */}
          <SunriseDurationPicker value={formSunrise} onChange={d => setFormSunrise(d as 15 | 30 | 45)} />

          {/* Actions */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={closeForm}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelFormText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, formDays.length === 0 && styles.saveBtnDisabled]}
              onPress={saveAlarm}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Save Alarm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add alarm button */}
      {!formOpen && (
        <TouchableOpacity
          style={[styles.addBtn, (busy || alarms.length >= MAX_DEVICE_ALARMS) && styles.saveBtnDisabled]}
          onPress={openAddForm}
          disabled={busy || alarms.length >= MAX_DEVICE_ALARMS}
          activeOpacity={0.8}
        >
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
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['5'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  alarmCardDim: {
    opacity: 0.55,
  },
  alarmCardLeft: {
    gap: 2,
  },
  alarmTime: {
    fontSize: 38,
    fontWeight: typography.weights.regular,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  alarmTimeDim: {
    color: colors.text.secondary,
  },
  alarmDays: {
    fontSize: typography.sizes.md,
    color: colors.accent.DEFAULT,
    fontWeight: typography.weights.semibold,
  },
  alarmLabel: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    marginTop: 2,
  },
  skipText: {
    fontSize: typography.sizes.sm,
    color: colors.accent.DEFAULT,
    marginTop: spacing['2'],
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: '#C0392B',
  },
  alarmCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
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
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2'],
    backgroundColor: colors.background.card,
    borderRadius: radii.md,
    padding: spacing['3'],
  },
  noticeText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.accent.dark,
    lineHeight: 17,
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
    borderRadius: radii.full,
    paddingVertical: spacing['5'],
  },
  addBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
    letterSpacing: typography.letterSpacing.wide,
  },
});
