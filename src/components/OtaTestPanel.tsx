import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  addOtaListener, cancelUpdate, getSdkInfo, inspectFirmware, OtaDevice,
  scanForOtaDevices, startUpdate,
} from 'somnara-ota';
import { colors, radii, spacing, typography } from '../theme';
import { useBleConnection } from '../ble/useBleConnection';
import {
  applyOtaEvent, approvedFirmwareFor, beginReconnection, BUNDLED_FIRMWARE as BUNDLED_FIRMWARE_RECORD,
  BUNDLED_FIRMWARE_SHA256, confirmVersionReadback, createDiagnosticReport, initialOtaSession,
  OtaSession, validateFirmware,
} from '../ota/OtaSession';

const BUNDLED_FIRMWARE_ASSET = require('../../assets/firmware/somnara_0_0_3_260901_71C6.ufw');

interface Props {
  visible: boolean;
  onClose: () => void;
}

function messageForError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  const known: Record<string, string> = {
    FIRMWARE_HASH_MISMATCH: 'The file checksum does not match. Choose the correct UFW file.',
    FIRMWARE_EXTENSION_INVALID: 'Choose a JieLi UFW firmware file.',
    FIRMWARE_EMPTY: 'The firmware file is empty.',
    EXPECTED_FIRMWARE_VERSION_MISSING: 'This file has no approved version record. Use a supplied Somnara UFW for a final version test.',
    FIRMWARE_VERSION_MISMATCH: 'The device did not report the expected firmware version.',
    BLUETOOTH_PERMISSION_REQUIRED: 'Allow Bluetooth access, then try again.',
  };
  return known[code] ?? code;
}

export function OtaTestPanel({ visible, onClose }: Props) {
  const [session, setSession] = useState<OtaSession>(initialOtaSession);
  const [devices, setDevices] = useState<OtaDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const normalBle = useBleConnection();

  useEffect(() => {
    const subscription = addOtaListener(event => {
      const safeEvent = event.phase === 'complete'
        ? { ...event, phase: 'restarting' as const, code: 'AWAITING_VERSION_READBACK' }
        : event;
      setSession(current => applyOtaEvent(current, safeEvent));
      if (event.phase === 'restarting' || event.phase === 'failed' || event.phase === 'cancelled') {
        deactivateKeepAwake('somnara-ota');
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!normalBle.latestStatus || session.phase !== 'reconnecting') return;
    const status = normalBle.latestStatus;
    const version = `${status.firmwareMajor}.${status.firmwareMinor}.${status.firmwarePatch}+${status.firmwareBuild}`;
    setSession(current => {
      try {
        return confirmVersionReadback(current, version);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'FIRMWARE_VERSION_READBACK_FAILED';
        return applyOtaEvent(current, {
          phase: 'failed',
          progress: current.progress,
          code,
          message: messageForError(error),
          recoverable: true,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }, [normalBle.latestStatus, session.phase]);

  const report = useMemo(
    () => createDiagnosticReport(session, Platform.OS, Platform.Version),
    [session],
  );

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert('OTA test stopped', messageForError(error));
    } finally {
      setBusy(false);
    }
  }

  function loadBundledFirmware() {
    return run(async () => {
      const asset = Asset.fromModule(BUNDLED_FIRMWARE_ASSET);
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The bundled firmware is not available on this phone.');
      const inspection = await inspectFirmware(asset.localUri);
      validateFirmware(inspection, BUNDLED_FIRMWARE_SHA256);
      setSession(current => ({
        ...current,
        firmware: inspection,
        expectedVersion: BUNDLED_FIRMWARE_RECORD.version,
        phase: 'ready',
        errorCode: null,
      }));
    });
  }

  function chooseFirmware() {
    return run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'application/octet-stream' });
      if (result.canceled) return;
      const inspection = await inspectFirmware(result.assets[0].uri);
      validateFirmware(inspection);
      const approved = approvedFirmwareFor(inspection);
      setSession(current => ({
        ...current,
        firmware: inspection,
        expectedVersion: approved?.version ?? null,
        phase: 'ready',
        errorCode: null,
      }));
    });
  }

  function scan() {
    return run(async () => {
      const sdk = await getSdkInfo();
      const found = await scanForOtaDevices();
      setDevices(found);
      setSession(current => ({ ...current, sdk, target: found.length === 1 ? found[0] : current.target }));
      if (found.length === 0) Alert.alert('No Somnara found', 'Power the device and keep the phone within 1 metre.');
    });
  }

  function confirmStart() {
    if (!session.firmware || !session.target) {
      Alert.alert('Select the test inputs', 'Choose a UFW file and select the correct Somnara.');
      return;
    }
    Alert.alert(
      'Start firmware update?',
      'Keep Somnara powered. Keep this phone close until the app verifies the new version.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Start Update', onPress: () => void beginUpdate() },
      ],
    );
  }

  async function beginUpdate() {
    await run(async () => {
      if (!session.firmware || !session.target) return;
      validateFirmware(session.firmware, session.firmware.sha256);
      await normalBle.disconnect();
      await activateKeepAwakeAsync('somnara-ota');
      const startedAt = new Date().toISOString();
      setSession(current => ({ ...current, startedAt, finishedAt: null, finalVersion: null, errorCode: null, recoverableError: null, log: [] }));
      try {
        await startUpdate({
          deviceId: session.target.id,
          firmwareUri: session.firmware.uri,
          expectedSha256: session.firmware.sha256,
        });
      } catch (error) {
        deactivateKeepAwake('somnara-ota');
        throw error;
      }
    });
  }

  function reconnectAndVerify() {
    return run(async () => {
      setSession(current => beginReconnection(current));
      await normalBle.connect();
    });
  }

  function cancel() {
    return run(async () => {
      const safe = await cancelUpdate();
      if (!safe) Alert.alert('Update cannot stop now', 'Keep Somnara powered until this stage ends.');
    });
  }

  function shareReport() {
    return Share.share({ title: 'Somnara OTA Test Report', message: report });
  }

  const active = ['connecting', 'authenticating', 'transferring', 'verifying'].includes(session.phase);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close firmware update"><Feather name="x" size={24} color={colors.text.primary} /></TouchableOpacity>
          <Text style={styles.title}>Update Somnara</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>Install firmware 0.0.3. Confirm the new version before release.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Firmware file</Text>
            <Text style={styles.value}>{session.firmware?.name ?? 'No file selected'}</Text>
            {session.firmware && <Text style={styles.meta}>{session.firmware.sizeBytes.toLocaleString()} bytes{`\n`}{session.firmware.sha256}{`\n`}Expected version: {session.expectedVersion ?? 'Not declared'}</Text>}
            <Action label="Use 0.0.3 Firmware" icon="package" onPress={loadBundledFirmware} disabled={busy || active} />
            <Action label="Choose Firmware File" icon="folder" onPress={chooseFirmware} disabled={busy || active} secondary />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Target device</Text>
            <Action label="Scan for Somnara" icon="bluetooth" onPress={scan} disabled={busy || active} />
            {devices.map(device => (
              <TouchableOpacity key={device.id} accessibilityRole="button" accessibilityState={{ selected: session.target?.id === device.id }} style={[styles.device, session.target?.id === device.id && styles.deviceSelected]} onPress={() => setSession(current => ({ ...current, target: device }))}>
                <Text style={styles.value}>{device.name ?? 'Somnara'}</Text>
                <Text style={styles.meta}>{device.flashUuid ?? device.id}{device.macAddress ? `\nMAC bytes: ${device.macAddress}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Test status</Text>
            <Text style={styles.phase}>{session.phase.replace('_', ' ').toUpperCase()}</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${session.progress}%` }]} /></View>
            <Text style={styles.meta}>{session.progress}% · SDK {session.sdk?.sdkVersion ?? 'not checked'}</Text>
            {session.errorCode && <Text style={styles.error}>{session.errorCode}{session.recoverableError ? `: ${session.recoverableError}` : ''}</Text>}
            {normalBle.error && <Text style={styles.error}>{normalBle.error}</Text>}
          </View>

          {!active && session.phase !== 'restarting' && session.phase !== 'reconnecting' && (
            <Action label="Start Update" icon="upload-cloud" onPress={confirmStart} disabled={busy || !session.firmware || !session.target} />
          )}
          {active && <Action label="Stop When Safe" icon="square" onPress={cancel} disabled={busy} secondary />}
          {session.phase === 'restarting' && <Action label="Reconnect and Verify" icon="check-circle" onPress={reconnectAndVerify} disabled={busy} />}
          {session.phase === 'reconnecting' && <Text style={styles.notice}>Waiting for the device firmware version…</Text>}
          {session.phase === 'failed' && session.recoverableError && <Text style={styles.notice}>Power Somnara off, then on. Retry the update.</Text>}
          <Action label="Share Test Report" icon="share-2" onPress={shareReport} disabled={session.log.length === 0} secondary />
          <Text style={styles.warning}>Keep Somnara powered during transfer. A successful SDK callback is not final. The test passes only after reconnection and firmware version readback.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Action({ label, icon, onPress, disabled, secondary }: { label: string; icon: React.ComponentProps<typeof Feather>['name']; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      <Feather name={icon} size={17} color={secondary ? colors.accent.DEFAULT : '#fff'} />
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3E6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing['5'], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.DEFAULT },
  title: { flex: 1, textAlign: 'center', fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary },
  headerSpacer: { width: 24 },
  content: { padding: spacing['6'], gap: spacing['4'], paddingBottom: spacing['12'] },
  lead: { fontSize: typography.sizes.base, color: colors.text.secondary, lineHeight: 23 },
  card: { backgroundColor: colors.background.elevated, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: spacing['5'], gap: spacing['3'] },
  cardTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text.primary },
  value: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text.primary },
  meta: { fontSize: typography.sizes.xs, color: colors.text.tertiary, lineHeight: 18 },
  device: { padding: spacing['3'], borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radii.lg },
  deviceSelected: { borderColor: colors.accent.DEFAULT, backgroundColor: `${colors.accent.DEFAULT}0D` },
  phase: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.accent.DEFAULT },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border.DEFAULT },
  fill: { height: 8, backgroundColor: colors.accent.DEFAULT },
  error: { color: '#A93226', fontSize: typography.sizes.sm, lineHeight: 20 },
  notice: { textAlign: 'center', color: colors.text.secondary, fontSize: typography.sizes.sm },
  warning: { fontSize: typography.sizes.xs, color: colors.text.tertiary, lineHeight: 19 },
  action: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing['2'], paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], backgroundColor: colors.accent.DEFAULT, borderRadius: radii.xl },
  actionSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent.DEFAULT },
  actionText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  actionTextSecondary: { color: colors.accent.DEFAULT },
  disabled: { opacity: 0.4 },
});
