import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Modal } from 'react-native';
import { confirmAction, showMessage } from '../lib/dialog';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { DeviceIllustration } from '../components/DeviceIllustration';
import { ConnectionCard } from '../components/ConnectionCard';
import { Button } from '../components/Button';
import { NextAlarmCard } from '../components/NextAlarmCard';
import { AlarmsTab } from '../components/AlarmsTab';
import { SoundsTab } from '../components/SoundsTab';
import { DeviceReadout } from '../components/DeviceReadout';
import { SunriseDurationPicker } from '../components/SunriseDurationPicker';
import { DeviceOwnershipCard } from '../components/DeviceOwnershipCard';
import { SyncStatusCard } from '../components/SyncStatusCard';
import { ClockReliabilityWarning } from '../components/ClockReliabilityWarning';
import { useGreeting } from '../hooks/useGreeting';
import { useSharedBleConnection } from '../context/BleContext';
import { useSyncContext } from '../context/SyncContext';
import { HelpScreen } from './HelpScreen';
import { ClaimedDevice } from '../models/Device';
import { SomnaraLogo } from '../components/SomnaraLogo';
import { isOtaTestEnabled } from '../lib/env';
import { OtaTestPanel } from '../components/OtaTestPanel';
import { formatCountdown, nextAlarm } from '../lib/alarmSchedule';

type Tab = 'Home' | 'Alarms' | 'Sounds' | 'Settings';

const TABS: { id: Tab; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'Home', icon: 'home' },
  { id: 'Alarms', icon: 'clock' },
  { id: 'Sounds', icon: 'music' },
  { id: 'Settings', icon: 'sliders' },
];

interface WelcomeScreenProps {
  claimedDevice: ClaimedDevice;
  onDeviceReset: () => Promise<void>;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  userName?: string;
}

export function WelcomeScreen({ claimedDevice, onDeviceReset, onSignOut, onDeleteAccount, userName }: WelcomeScreenProps) {
  const greeting = useGreeting();
  const { deviceStatus: device, state, error, connect, disconnect } = useSharedBleConnection();
  const busy = state === 'scanning' || state === 'connecting' || state === 'connected_unverified';
  const { preferences, setPreferences, alarms } = useSyncContext();
  const [activeTab, setActiveTabState] = useState<Tab>('Home');
  const scrollRef = useRef<ScrollView>(null);
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const [showHelp, setShowHelp] = useState(false);
  const [showOta, setShowOta] = useState(false);

  async function handleDeleteAccount() {
    const confirmed = await confirmAction({
      title: 'Delete Account',
      message: 'This permanently deletes your account, claimed device, alarms, and preferences. This cannot be undone.',
      confirmLabel: 'Delete Account',
      destructive: true,
    });
    if (!confirmed) return;
    await onDeleteAccount().catch(() => {
      showMessage('Unable to delete account', 'Please try again.');
    });
  }

  const statusText = state === 'ready' ? 'Connected'
    : state === 'scanning' ? 'Looking for Somnara…'
    : state === 'connecting' ? 'Connecting…'
    : state === 'connected_unverified' ? 'Waiting for device status…'
    : 'Disconnected';
  const onConnectionPress = () => { void (busy || device.isConnected ? disconnect() : connect()); };
  const rawFirst = userName?.trim().split(/\s+/)[0];
  const firstName = rawFirst ? rawFirst[0].toUpperCase() + rawFirst.slice(1) : undefined;
  const upcoming = nextAlarm(alarms);
  const comingSoon = (feature: string) => showMessage(feature, 'This control is coming soon to the Somnara app.');

  return (
    <LinearGradient colors={['#FDF8F0', '#FAF3E6', '#F5EBD8']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <SomnaraLogo width={130} style={styles.logo} />
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => setActiveTab('Settings')}
              activeOpacity={0.8}
              accessibilityLabel="Account and settings"
            >
              <Feather name="user" size={18} color={colors.accent.DEFAULT} />
            </TouchableOpacity>
          </View>

          {activeTab === 'Home' && (
            <View style={styles.content}>
              <View style={styles.hero}>
                <View style={styles.heroText}>
                  <Text style={styles.heroGreeting}>{greeting.replace(/!$/, ',')}</Text>
                  {firstName ? <Text style={styles.heroName} numberOfLines={1}>{firstName}</Text> : null}
                  <Text style={styles.heroTagline}>A brighter day starts here.</Text>
                </View>
                <View style={styles.heroDevice}>
                  <DeviceIllustration isOn={device.isConnected && device.isOn} size={160} />
                </View>
              </View>

              {device.clockValidity === 'invalid' && <ClockReliabilityWarning />}

              <ConnectionCard
                deviceName={device.isConnected && device.firmwareVersion
                  ? `${claimedDevice.name} · v${device.firmwareVersion}`
                  : claimedDevice.name}
                isConnected={device.isConnected}
                busy={busy}
                statusText={statusText}
                error={error}
                onPress={onConnectionPress}
              />

              <NextAlarmCard onPress={() => setActiveTab('Alarms')} />

              <View style={styles.grid}>
                <QuickTile icon="sunrise" title="Light" sub="Adjust brightness" onPress={() => comingSoon('Light')} />
                <QuickTile icon="music" title="Sounds" sub="Preview sounds" onPress={() => setActiveTab('Sounds')} />
                <QuickTile icon="moon" title="Sleep Mode" sub="Wind down" onPress={() => comingSoon('Sleep Mode')} />
                <QuickTile icon="bar-chart-2" title="Routines" sub="Build habits" onPress={() => comingSoon('Routines')} />
              </View>

              <View style={styles.promo}>
                <Feather name="sun" size={28} color={colors.accent.DEFAULT} />
                <View style={styles.promoText}>
                  <Text style={styles.promoTitle}>Better mornings start tonight.</Text>
                  <Text style={styles.promoSub}>Set your sleep routine</Text>
                </View>
                <TouchableOpacity style={styles.promoBtn} onPress={() => setActiveTab('Alarms')} activeOpacity={0.8}>
                  <Text style={styles.promoBtnText}>Get Started</Text>
                  <Feather name="chevron-right" size={16} color={colors.text.inverse} />
                </TouchableOpacity>
              </View>

              <Text style={styles.footnote}>Device status is live. Power controls and alarm transfer are not available yet.</Text>
            </View>
          )}

          {activeTab === 'Alarms' && (
            <View>
              <View style={styles.alarmsHero}>
                <DeviceIllustration isOn={device.isConnected && device.isOn} size={300} />
                <Text style={styles.greeting}>{greeting}</Text>
                <Text style={styles.nextIn}>
                  {upcoming ? `Next alarm in ${formatCountdown(upcoming.minutes)}` : 'No alarms scheduled'}
                </Text>
              </View>
              <AlarmsTab />
            </View>
          )}

          {activeTab === 'Sounds' && <SoundsTab />}

          {activeTab === 'Settings' && (
            <View style={styles.settingsContent}>
              <Text style={styles.settingsSection}>SYNC</Text>
              <SyncStatusCard />
              <View style={{ marginTop: spacing['6'] }} />
              <SunriseDurationPicker
                value={preferences.sunriseDuration}
                onChange={d => setPreferences({ sunriseDuration: d as 15 | 30 | 45 })}
              />
              <Text style={[styles.settingsSection, { marginTop: spacing['6'] }]}>MY DEVICE</Text>
              <DeviceOwnershipCard
                device={claimedDevice}
                onReset={onDeviceReset}
              />
              <Text style={[styles.settingsSection, { marginTop: spacing['6'] }]}>DEVICE READOUT</Text>
              <DeviceReadout />
              {isOtaTestEnabled && (
                <TouchableOpacity style={[styles.helpRow, { marginTop: spacing['3'] }]} onPress={() => setShowOta(true)} activeOpacity={0.8}>
                  <View style={styles.helpIcon}>
                    <Feather name="upload-cloud" size={18} color={colors.accent.DEFAULT} />
                  </View>
                  <View style={styles.helpText}>
                    <Text style={styles.helpTitle}>Update Somnara</Text>
                    <Text style={styles.helpSub}>Install and verify test firmware</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.settingsSection, { marginTop: spacing['6'] }]}>SUPPORT</Text>
              <TouchableOpacity style={styles.helpRow} onPress={() => setShowHelp(true)} activeOpacity={0.8}>
                <View style={styles.helpIcon}>
                  <Feather name="life-buoy" size={18} color={colors.accent.DEFAULT} />
                </View>
                <View style={styles.helpText}>
                  <Text style={styles.helpTitle}>Help with my device</Text>
                  <Text style={styles.helpSub}>Troubleshooting · diagnostics · contact support</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
              <Button
                label="Sign Out"
                onPress={onSignOut}
                variant="secondary"
                style={{ marginTop: spacing['4'] }}
              />
              <TouchableOpacity
                style={[styles.helpRow, styles.dangerRow]}
                onPress={() => { void handleDeleteAccount(); }}
                activeOpacity={0.8}
              >
                <View style={[styles.helpIcon, styles.dangerIcon]}>
                  <Feather name="alert-triangle" size={18} color="#C0392B" />
                </View>
                <View style={styles.helpText}>
                  <Text style={[styles.helpTitle, styles.dangerText]}>Delete Account</Text>
                  <Text style={styles.helpSub}>Permanently deletes your account and data</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Bottom tab bar */}
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Feather name={tab.icon} size={22} color={active ? colors.accent.DEFAULT : colors.text.secondary} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.id}</Text>
                <View style={[styles.tabDot, active && styles.tabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet">
        <HelpScreen claimedDevice={claimedDevice} onClose={() => setShowHelp(false)} />
      </Modal>
      {isOtaTestEnabled && <OtaTestPanel visible={showOta} onClose={() => setShowOta(false)} />}
    </LinearGradient>
  );
}

function QuickTile({ icon, title, sub, onPress }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.tileIcon}>
        <Feather name={icon} size={18} color={colors.accent.DEFAULT} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}

const cardShadow = {
  shadowColor: '#C49A6C',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 2,
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing['8'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['2'],
    paddingBottom: 0,
  },
  logo: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },

  // Home
  content: {
    gap: spacing['3'],
    paddingHorizontal: spacing['4'],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 130,
  },
  heroText: {
    flex: 1,
    paddingLeft: spacing['1'],
    zIndex: 1,
  },
  heroGreeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.regular,
    color: colors.accent.DEFAULT,
    letterSpacing: typography.letterSpacing.tight,
  },
  heroName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.accent.DEFAULT,
    letterSpacing: typography.letterSpacing.tight,
  },
  heroTagline: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    marginTop: spacing['2'],
    lineHeight: 21,
  },
  heroDevice: {
    marginRight: -spacing['4'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing['3'],
  },
  tile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    paddingLeft: spacing['3'], paddingRight: spacing['2'],
    paddingVertical: spacing['3'],
    ...cardShadow,
  },
  tileIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  tileText: { flex: 1 },
  tileTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  tileSub: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    backgroundColor: colors.background.elevated,
    borderRadius: radii.xl,
    padding: spacing['4'],
    ...cardShadow,
  },
  promoText: { flex: 1 },
  promoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  promoSub: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radii.full,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  promoBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.inverse,
  },
  footnote: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // Alarms
  alarmsHero: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.regular,
    color: colors.accent.DEFAULT,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
    marginTop: spacing['2'],
  },
  nextIn: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    marginTop: spacing['2'],
  },

  // Bottom tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.elevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing['2'],
    paddingBottom: spacing['2'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: colors.accent.DEFAULT,
    fontWeight: typography.weights.semibold,
  },
  tabDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
  tabDotActive: {
    backgroundColor: colors.accent.DEFAULT,
  },

  // Sounds / Settings
  settingsContent: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['4'],
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['4'],
    paddingVertical: spacing['20'],
  },
  placeholderText: {
    fontSize: typography.sizes.base,
    color: colors.text.tertiary,
    fontWeight: typography.weights.regular,
  },
  settingsSection: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.text.tertiary,
    marginBottom: spacing['3'],
  },
  helpRow: {
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
  helpIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: `${colors.accent.DEFAULT}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  helpText: { flex: 1 },
  helpTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  helpSub: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  dangerRow: {
    marginTop: spacing['3'],
  },
  dangerIcon: {
    backgroundColor: '#C0392B12',
  },
  dangerText: {
    color: '#C0392B',
  },
});
