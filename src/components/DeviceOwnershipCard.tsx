import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { ClaimedDevice } from '../models/Device';

interface Props {
  device: ClaimedDevice;
  onReset: () => Promise<void>;
}

function maskSerial(serial: string) {
  const parts = serial.split('-');
  if (parts.length < 3) return serial;
  return `${parts[0]}-****-${parts[parts.length - 1]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function DeviceOwnershipCard({ device, onReset }: Props) {
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  function handleTransferConfirm() {
    if (!transferEmail.includes('@')) {
      setTransferError('Please enter a valid email address.');
      return;
    }
    setTransferLoading(false);
    setTransferError('Secure ownership transfer invitations are not configured yet. No changes were made.');
  }

  function handleReset() {
    Alert.alert(
      'Unlink Device',
      `This will remove "${device.name}" from your account. It does not factory-reset the physical device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink Device',
          style: 'destructive',
          onPress: () => {
            void onReset().catch(() => {
              Alert.alert('Unable to unlink', 'The secure device service rejected the request. No changes were made.');
            });
          },
        },
      ],
    );
  }

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBadge}>
              <Feather name="cpu" size={16} color={colors.accent.DEFAULT} />
            </View>
            <View>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceSerial}>{maskSerial(device.serial)}</Text>
            </View>
          </View>
          <View style={styles.pairedBadge}>
            <View style={styles.pairedDot} />
            <Text style={styles.pairedText}>Claimed</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Details */}
        <View style={styles.detailRow}>
          <Feather name="calendar" size={14} color={colors.text.tertiary} />
          <Text style={styles.detailLabel}>Activated</Text>
          <Text style={styles.detailValue}>{formatDate(device.claimedAt)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="user" size={14} color={colors.text.tertiary} />
          <Text style={styles.detailLabel}>Owner</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{device.ownerEmail}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="tag" size={14} color={colors.text.tertiary} />
          <Text style={styles.detailLabel}>Model</Text>
          <Text style={styles.detailValue}>Somnara Pro</Text>
        </View>

        <View style={styles.divider} />

        {/* Actions */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setShowTransfer(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <Feather name="send" size={16} color={colors.accent.DEFAULT} />
            <View>
              <Text style={styles.actionTitle}>Transfer Ownership</Text>
              <Text style={styles.actionSub}>Give this device to another account</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleReset}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <Feather name="alert-triangle" size={16} color="#C0392B" />
            <View>
              <Text style={[styles.actionTitle, styles.actionDanger]}>Unlink Device</Text>
              <Text style={styles.actionSub}>Remove this device from your account</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Transfer ownership modal */}
      <Modal
        visible={showTransfer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransfer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Ownership</Text>
              <TouchableOpacity onPress={() => { setShowTransfer(false); setTransferEmail(''); setTransferError(''); }} hitSlop={12}>
                <Feather name="x" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter the email address of the new owner. They will receive an invitation to claim the device.
            </Text>

            <View style={styles.transferWarning}>
              <Feather name="info" size={14} color={colors.accent.DEFAULT} />
              <Text style={styles.transferWarningText}>
                You will lose access to <Text style={{ fontWeight: '700' }}>{device.name}</Text> once the transfer is accepted.
              </Text>
            </View>

            <TextInput
              style={[styles.modalInput, transferError ? styles.modalInputError : null]}
              placeholder="New owner's email"
              placeholderTextColor={colors.text.tertiary}
              value={transferEmail}
              onChangeText={t => { setTransferEmail(t); setTransferError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={handleTransferConfirm}
            />
            {transferError ? <Text style={styles.errorText}>{transferError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowTransfer(false); setTransferEmail(''); setTransferError(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, transferLoading && { opacity: 0.7 }]}
                onPress={handleTransferConfirm}
                activeOpacity={0.85}
                disabled={transferLoading}
              >
                {transferLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Send Transfer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    overflow: 'hidden',
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing['5'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${colors.accent.DEFAULT}15`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${colors.accent.DEFAULT}25`,
  },
  deviceName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  deviceSerial: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    letterSpacing: 1,
    marginTop: 2,
  },
  pairedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2ECC7115',
    borderRadius: radii.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2ECC7130',
  },
  pairedDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#2ECC71',
  },
  pairedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#2ECC71',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['3'],
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    flex: 1,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['4'],
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginBottom: 1,
  },
  actionDanger: { color: '#C0392B' },
  actionSub: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['6'],
  },
  modalCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    padding: spacing['6'],
    width: '100%',
    gap: spacing['4'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  transferWarning: {
    flexDirection: 'row',
    gap: spacing['2'],
    backgroundColor: `${colors.accent.DEFAULT}10`,
    borderRadius: radii.md,
    padding: spacing['3'],
    alignItems: 'flex-start',
  },
  transferWarningText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: colors.background.card,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['4'],
    fontSize: typography.sizes.base,
    color: colors.text.primary,
    outlineStyle: 'none',
  } as any,
  modalInputError: { borderColor: '#C0392B' },
  errorText: {
    fontSize: typography.sizes.xs,
    color: '#C0392B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing['3'],
    marginTop: spacing['2'],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  cancelBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    alignItems: 'center',
    backgroundColor: colors.accent.DEFAULT,
  },
  confirmBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
});
