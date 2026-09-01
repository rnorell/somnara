import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, Platform, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { ClaimedDevice } from '../models/Device';
import { useSyncContext } from '../context/SyncContext';

interface Props {
  claimedDevice: ClaimedDevice;
  onClose: () => void;
}

// ─── Troubleshooting data ────────────────────────────────────────────────────

interface Step {
  title: string;
  body: string;
}

const GUIDES: Record<string, {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  steps: Step[];
}> = {
  connection: {
    label: "Can't connect",
    icon: 'wifi-off',
    steps: [
      {
        title: 'Check the device is powered on',
        body: 'Confirm that Somnara is connected to power.',
      },
      {
        title: 'Enable Bluetooth on your phone',
        body: 'Open your phone Settings → Bluetooth and confirm it is switched on.',
      },
      {
        title: 'Move closer to the device',
        body: 'Keep your phone within 1 metre of the Somnara during pairing.',
      },
      {
        title: 'Force-quit and reopen the app',
        body: 'Close the Somnara app fully, reopen it, then tap Connect Device on the Home tab.',
      },
      {
        title: 'Try the connection again',
        body: 'Return to Bluetooth setup and start a new search.',
      },
    ],
  },
  light: {
    label: 'Light not working',
    icon: 'sun',
    steps: [
      {
        title: 'Check the device is on',
        body: 'Tap Turn On in the app Home tab. The lamp should glow amber.',
      },
      {
        title: 'Confirm sunrise mode is active',
        body: 'Go to Settings → Sunrise Duration and make sure a duration is selected.',
      },
      {
        title: 'Check brightness',
        body: 'The device gradually brightens during the sunrise window — if it has only just started it may be very dim. Wait a minute and check again.',
      },
      {
        title: 'Reconnect the device',
        body: 'Tap Disconnect in the Home tab, wait 5 seconds, then tap Connect Device.',
      },
      {
        title: 'Reconnect your Somnara',
        body: 'Open Bluetooth setup and connect again before you test the light.',
      },
    ],
  },
  alarm: {
    label: "Alarm didn't go off",
    icon: 'bell-off',
    steps: [
      {
        title: 'Check the alarm is enabled',
        body: 'Open the Alarms tab and confirm the toggle next to your alarm is on (amber).',
      },
      {
        title: 'Confirm the correct days are selected',
        body: 'Tap the alarm to check which days it repeats. Make sure today is included.',
      },
      {
        title: 'Confirm the alarm was saved',
        body: 'Saved alarms run on Somnara. Your phone does not need to stay connected overnight.',
      },
      {
        title: 'Reconnect after a long power cut',
        body: 'Reconnect the app before you rely on alarms after Somnara has been without power for an extended period.',
      },
      {
        title: 'Delete and recreate the alarm',
        body: 'In the Alarms tab, swipe to delete the alarm, then add it again with the Add Alarm button.',
      },
    ],
  },
  app: {
    label: 'App issues',
    icon: 'smartphone',
    steps: [
      {
        title: 'Force-quit and reopen',
        body: 'Close the app completely and reopen it. This resolves most temporary glitches.',
      },
      {
        title: 'Check for app updates',
        body: 'Visit the App Store or Google Play and update Somnara to the latest version.',
      },
      {
        title: 'Check your internet connection',
        body: 'Account sync requires an internet connection. Your settings are also saved locally so the app works offline.',
      },
      {
        title: 'Sign out and sign back in',
        body: 'Go to Settings → Account → Sign Out, then sign in again. Your saved data will reload from your account.',
      },
      {
        title: 'Reinstall the app',
        body: 'Delete the app, reinstall from the store, and sign in. All your settings are stored in your account and will restore automatically.',
      },
    ],
  },
  reset: {
    label: 'Reset device',
    icon: 'refresh-cw',
    steps: [
      {
        title: 'Unlink from your account',
        body: 'Open Settings and choose Unlink Device. This does not reset the physical Somnara.',
      },
      {
        title: 'Start the recovery reset',
        body: 'Switch the power off and on five times. Keep each power-on period under 10 seconds. This reset deletes the saved Bluetooth bond.',
      },
      {
        title: 'Connect and accept bonding',
        body: 'Claim the device again and connect. The phone bonding prompt starts after Notify is enabled or after the first data packet. Accept the prompt to complete setup.',
      },
    ],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function HelpScreen({ claimedDevice, onClose }: Props) {
  const { preferences, alarms } = useSyncContext();
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [resolved, setResolved] = useState(false);

  function openGuide(key: string) {
    setActiveGuide(key);
    setStepIndex(0);
    setResolved(false);
  }

  function nextStep() {
    const guide = GUIDES[activeGuide!];
    if (stepIndex < guide.steps.length - 1) setStepIndex(i => i + 1);
  }

  function contactEmail() {
    const serial = claimedDevice.serial;
    const subject = encodeURIComponent(`Help with my Somnara — ${serial}`);
    const body = encodeURIComponent(
      `Hi Somnara Support,\n\nI need help with my device.\n\n` +
      `--- Device Info ---\n` +
      `Serial: ${serial}\n` +
      `Device name: ${claimedDevice.name}\n` +
      `Claimed: ${new Date(claimedDevice.claimedAt).toLocaleDateString()}\n` +
      `Timezone: ${preferences.timezone}\n` +
      `Alarms set: ${alarms.length}\n` +
      `Sunrise duration: ${preferences.sunriseDuration} min\n\n` +
      `--- Issue ---\n[Please describe your issue here]\n`
    );
    Linking.openURL(`mailto:support@somnara.com?subject=${subject}&body=${body}`);
  }

  function openFAQ() {
    Linking.openURL('https://faq.somnara.com');
  }

  const guide = activeGuide ? GUIDES[activeGuide] : null;
  const currentStep = guide?.steps[stepIndex];
  const isLastStep = guide && stepIndex === guide.steps.length - 1;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={activeGuide ? () => setActiveGuide(null) : onClose} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {guide ? guide.label : 'Help & Support'}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Feather name="x" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {!activeGuide && (
          <>
            {/* Problem picker */}
            <Text style={styles.sectionLabel}>WHAT CAN WE HELP WITH?</Text>
            <View style={styles.guideGrid}>
              {Object.entries(GUIDES).map(([key, g]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.guideCard}
                  onPress={() => openGuide(key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.guideIcon}>
                    <Feather name={g.icon} size={20} color={colors.accent.DEFAULT} />
                  </View>
                  <Text style={styles.guideLabel}>{g.label}</Text>
                  <Feather name="chevron-right" size={14} color={colors.text.tertiary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Device diagnostics */}
            <Text style={[styles.sectionLabel, { marginTop: spacing['6'] }]}>DEVICE DIAGNOSTICS</Text>
            <View style={styles.diagCard}>
              <DiagRow icon="cpu" label="Device name" value={claimedDevice.name} />
              <DiagRow icon="hash" label="Serial" value={claimedDevice.serial} />
              <DiagRow icon="calendar" label="Claimed on" value={new Date(claimedDevice.claimedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
              <DiagRow icon="clock" label="Timezone" value={preferences.timezone} />
              <DiagRow icon="sun" label="Sunrise duration" value={`${preferences.sunriseDuration} min`} />
              <DiagRow icon="bell" label="Alarms" value={`${alarms.length} schedule${alarms.length !== 1 ? 's' : ''}`} />
              <DiagRow icon="smartphone" label="Platform" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} last />
            </View>

            {/* Contact support */}
            <Text style={[styles.sectionLabel, { marginTop: spacing['6'] }]}>CONTACT SUPPORT</Text>
            <View style={styles.supportCard}>
              <TouchableOpacity style={styles.supportRow} onPress={contactEmail} activeOpacity={0.7}>
                <View style={styles.supportIcon}>
                  <Feather name="mail" size={18} color={colors.accent.DEFAULT} />
                </View>
                <View style={styles.supportText}>
                  <Text style={styles.supportTitle}>Email support</Text>
                  <Text style={styles.supportSub}>support@somnara.com · reply within 24 h</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>

              <View style={styles.supportDivider} />

              <TouchableOpacity style={styles.supportRow} onPress={openFAQ} activeOpacity={0.7}>
                <View style={styles.supportIcon}>
                  <Feather name="book-open" size={18} color={colors.accent.DEFAULT} />
                </View>
                <View style={styles.supportText}>
                  <Text style={styles.supportTitle}>Help centre</Text>
                  <Text style={styles.supportSub}>faq.somnara.com</Text>
                </View>
                <Feather name="external-link" size={14} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Troubleshooting wizard ── */}
        {guide && !resolved && (
          <View style={styles.wizardWrap}>
            {/* Progress */}
            <View style={styles.progressRow}>
              {guide.steps.map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]}
                />
              ))}
            </View>
            <Text style={styles.stepCount}>Step {stepIndex + 1} of {guide.steps.length}</Text>

            {/* Step card */}
            <View style={styles.stepCard}>
              <View style={styles.stepNumBadge}>
                <Text style={styles.stepNum}>{stepIndex + 1}</Text>
              </View>
              <Text style={styles.stepTitle}>{currentStep!.title}</Text>
              <Text style={styles.stepBody}>{currentStep!.body}</Text>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={styles.fixedBtn}
              onPress={() => setResolved(true)}
              activeOpacity={0.85}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.fixedBtnText}>This fixed it</Text>
            </TouchableOpacity>

            {!isLastStep ? (
              <TouchableOpacity style={styles.nextBtn} onPress={nextStep} activeOpacity={0.7}>
                <Text style={styles.nextBtnText}>Still not working — next step</Text>
                <Feather name="arrow-right" size={16} color={colors.accent.DEFAULT} />
              </TouchableOpacity>
            ) : (
              <View style={styles.escalateBox}>
                <Text style={styles.escalateTitle}>Still having trouble?</Text>
                <Text style={styles.escalateSub}>Our support team can help. We'll attach your device info automatically.</Text>
                <TouchableOpacity style={styles.emailBtn} onPress={contactEmail} activeOpacity={0.85}>
                  <Feather name="mail" size={16} color="#fff" />
                  <Text style={styles.emailBtnText}>Email Support</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Resolved ── */}
        {guide && resolved && (
          <View style={styles.resolvedWrap}>
            <View style={styles.resolvedIcon}>
              <Feather name="check-circle" size={40} color="#2ECC71" />
            </View>
            <Text style={styles.resolvedTitle}>Great, glad that helped!</Text>
            <Text style={styles.resolvedSub}>
              If the issue comes back, tap the guide again or contact our support team.
            </Text>
            <TouchableOpacity
              style={styles.fixedBtn}
              onPress={() => setActiveGuide(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.fixedBtnText}>Back to Help</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function DiagRow({ icon, label, value, last }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <>
      <View style={styles.diagRow}>
        <Feather name={icon} size={14} color={colors.text.tertiary} style={{ width: 18 }} />
        <Text style={styles.diagLabel}>{label}</Text>
        <Text style={styles.diagValue} numberOfLines={1}>{value}</Text>
      </View>
      {!last && <View style={styles.diagDivider} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF3E6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['5'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['4'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.DEFAULT,
    backgroundColor: '#FDF8F0',
  },
  backBtn: { marginRight: spacing['3'] },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  scroll: {
    padding: spacing['6'],
    paddingBottom: spacing['12'],
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    marginBottom: spacing['3'],
  },

  // Guide grid
  guideGrid: { gap: spacing['2'] },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['4'],
    gap: spacing['3'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  guideIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${colors.accent.DEFAULT}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  guideLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    flex: 1,
  },

  // Diagnostics
  diagCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['2'],
    overflow: 'hidden',
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['3'],
    gap: spacing['3'],
  },
  diagLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    flex: 1,
  },
  diagValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  diagDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
  },

  // Support
  supportCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    overflow: 'hidden',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['5'],
    paddingVertical: spacing['4'],
    gap: spacing['3'],
  },
  supportIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${colors.accent.DEFAULT}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  supportText: { flex: 1 },
  supportTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  supportSub: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  supportDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.DEFAULT,
    marginLeft: spacing['5'] + 36 + spacing['3'],
  },

  // Wizard
  wizardWrap: { gap: spacing['5'] },
  progressRow: {
    flexDirection: 'row',
    gap: spacing['2'],
    alignSelf: 'center',
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.border.strong,
  },
  progressDotActive: {
    backgroundColor: colors.accent.DEFAULT,
    width: 20,
  },
  stepCount: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.wide,
  },
  stepCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: spacing['6'],
    gap: spacing['3'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  stepNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${colors.accent.DEFAULT}18`,
    borderWidth: 1, borderColor: `${colors.accent.DEFAULT}30`,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  stepNum: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent.DEFAULT,
  },
  stepTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  stepBody: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  fixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xl,
    paddingVertical: spacing['5'],
    shadowColor: colors.accent.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  fixedBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    paddingVertical: spacing['4'],
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  nextBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.accent.DEFAULT,
  },
  escalateBox: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: spacing['5'],
    gap: spacing['3'],
    alignItems: 'center',
  },
  escalateTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  escalateSub: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.xl,
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['5'],
    marginTop: spacing['1'],
  },
  emailBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },

  // Resolved
  resolvedWrap: {
    alignItems: 'center',
    gap: spacing['4'],
    paddingTop: spacing['8'],
  },
  resolvedIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2ECC7110',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#2ECC7130',
  },
  resolvedTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  resolvedSub: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing['4'],
  },
});
