import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { useSharedBleConnection } from '../context/BleContext';
import { AlarmListReport, DeviceStatusReport } from '../ble/UplinkFrame';
import { BleConnectionState } from '../ble/types';

const MAX_LOG = 10;

interface LogEntry {
  at: string;
  text: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function hex(n: number) {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function readoutRows(
  state: BleConnectionState,
  status: DeviceStatusReport | null,
  alarmList: AlarmListReport | null,
  playingSoundId: number | null,
): [string, string][] {
  const rows: [string, string][] = [['Connection', state]];
  if (!status) {
    rows.push(['Status report', 'None received yet']);
  } else {
    rows.push(
      ['Firmware', `${status.firmwareMajor}.${status.firmwareMinor}.${status.firmwarePatch} (build ${status.firmwareBuild})`],
      ['Hardware revision', String(status.hardwareRevision)],
      ['Protocol', `${status.protocolMajor}.${status.protocolMinor}`],
      ['Product ID', String(status.productId)],
      ['Power', status.power ? 'On' : 'Off'],
      ['Brightness', `${status.brightnessPercent}%`],
      ['CCT (W / WW)', `${status.cctW} / ${status.cctWw}`],
      ['Selected sound ID', String(status.soundId)],
      ['Volume', `${status.volumePercent}%`],
      ['Clock valid', status.clockValid ? 'Yes' : 'No'],
      ['Alarms on device', String(status.alarmCount)],
      ['Device state', String(status.deviceState)],
      ['Flags', hex(status.flags)],
    );
  }
  rows.push(['App playing sound', playingSoundId === null ? 'None' : String(playingSoundId)]);
  if (alarmList) {
    const occupied = alarmList.slots.filter(slot => slot.occupied);
    rows.push(['Alarm list revision', String(alarmList.revision)]);
    for (const slot of occupied) {
      rows.push([
        `Device alarm slot ${slot.index}`,
        `${pad(slot.hour ?? 0)}:${pad(slot.minute ?? 0)} · days ${hex(slot.weekdayMask ?? 0)} · sound ${slot.soundId} · ${slot.enabled ? 'on' : 'off'}${slot.skipNext ? ' · skip next' : ''}`,
      ]);
    }
  }
  return rows;
}

/** Live view of exactly what the connected device reports, for hardware testing. */
export function DeviceReadout() {
  const { state, error, protocolError, latestStatus, latestAlarmList, playingSoundId } = useSharedBleConnection();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Protocol errors clear on the next good status report, so keep our own history.
  useEffect(() => {
    if (protocolError) addLog(`Protocol: ${protocolError.code} — ${protocolError.message}`);
  }, [protocolError]);
  useEffect(() => {
    if (error) addLog(`Connection: ${error}`);
  }, [error]);

  function addLog(text: string) {
    const now = new Date();
    const at = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    setLog(previous => [{ at, text }, ...previous].slice(0, MAX_LOG));
  }

  const rows = readoutRows(state, latestStatus, latestAlarmList, playingSoundId);

  async function share() {
    const text = [
      `Somnara device readout — ${new Date().toISOString()}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      'Recent errors:',
      ...(log.length ? log.map(entry => `${entry.at} ${entry.text}`) : ['None']),
    ].join('\n');
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // Sharing was cancelled or the clipboard is unavailable; nothing to do.
    }
  }

  return (
    <View style={styles.card}>
      {rows.map(([label, value], index) => (
        <View key={label} style={[styles.row, index > 0 && styles.rowBorder]}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} selectable>{value}</Text>
        </View>
      ))}

      <Text style={styles.logTitle}>RECENT ERRORS</Text>
      {log.length === 0 ? (
        <Text style={styles.logEmpty}>None</Text>
      ) : (
        log.map((entry, index) => (
          <Text key={`${entry.at}-${index}`} style={styles.logEntry} selectable>
            {entry.at}  {entry.text}
          </Text>
        ))
      )}

      <TouchableOpacity style={styles.shareBtn} onPress={() => void share()} activeOpacity={0.8}>
        <Feather name={Platform.OS === 'web' ? 'copy' : 'share'} size={16} color={colors.accent.DEFAULT} />
        <Text style={styles.shareText}>
          {copied ? 'Copied' : Platform.OS === 'web' ? 'Copy readout' : 'Share readout'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing['3'],
    paddingVertical: spacing['2'],
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.DEFAULT,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  value: {
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    textAlign: 'right',
  },
  logTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    marginTop: spacing['4'],
    marginBottom: spacing['2'],
  },
  logEmpty: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  logEntry: {
    fontSize: typography.sizes.xs,
    color: '#C0392B',
    marginBottom: spacing['1'],
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    marginTop: spacing['4'],
    paddingVertical: spacing['3'],
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  shareText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.accent.DEFAULT,
  },
});
