import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { useSyncContext, SyncStatus } from '../context/SyncContext';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const COPY: Record<SyncStatus, { label: string; sub?: string; color: string }> = {
  loading: { label: 'Loading…', color: colors.text.tertiary },
  local: { label: 'Saved in this app', color: colors.text.tertiary },
  syncing: { label: 'Syncing…', color: colors.accent.DEFAULT },
  synced: { label: 'Synced', color: colors.success },
  offline: { label: 'Offline', sub: 'Changes are saved locally and will sync automatically.', color: colors.text.tertiary },
  failed: { label: 'Sync failed', sub: 'Your changes are saved locally.', color: '#C0392B' },
};

export function SyncStatusCard() {
  const { status, lastError, lastSyncedAt, retry } = useSyncContext();
  const copy = COPY[status];
  const canRetry = status === 'offline' || status === 'failed';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${copy.color}18` }]}>
          {status === 'loading' || status === 'syncing'
            ? <ActivityIndicator size="small" color={copy.color} />
            : <Feather name={ICONS[status]} size={16} color={copy.color} />}
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: copy.color }]}>{copy.label}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {status === 'failed' && lastError
              ? lastError
              : status === 'synced' && lastSyncedAt
              ? `Last synced ${timeAgo(lastSyncedAt)}`
              : copy.sub}
          </Text>
        </View>
        {canRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={14} color={colors.accent.DEFAULT} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ICONS: Record<SyncStatus, React.ComponentProps<typeof Feather>['name']> = {
  loading: 'loader',
  local: 'hard-drive',
  syncing: 'refresh-cw',
  synced: 'check-circle',
  offline: 'wifi-off',
  failed: 'alert-circle',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: spacing['4'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1 },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  sub: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  retryText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.accent.DEFAULT,
  },
});
