import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { DeviceIllustration } from '../components/DeviceIllustration';
import { StatusCard } from '../components/StatusCard';
import { Button } from '../components/Button';
import { NextAlarmCard } from '../components/NextAlarmCard';
import { AlarmsTab } from '../components/AlarmsTab';
import { SleepTonightButton } from '../components/SleepTonightButton';
import { SunriseDurationPicker } from '../components/SunriseDurationPicker';
import { DeviceOwnershipCard } from '../components/DeviceOwnershipCard';
import { useGreeting } from '../hooks/useGreeting';
import { useDeviceStore } from '../state/deviceStore';
import { useSyncContext } from '../context/SyncContext';
import { HelpScreen } from './HelpScreen';
import { PairedDevice } from '../models/Device';
import { SomnaraLogo } from '../components/SomnaraLogo';

type Tab = 'Home' | 'Alarms' | 'Sounds' | 'Settings';

const TABS: { id: Tab; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'Home', icon: 'home' },
  { id: 'Alarms', icon: 'clock' },
  { id: 'Sounds', icon: 'music' },
  { id: 'Settings', icon: 'sliders' },
];

import React from 'react';

interface WelcomeScreenProps {
  pairedDevice: PairedDevice;
  onDeviceReset: () => Promise<void>;
  onSignOut: () => void;
}

export function WelcomeScreen({ pairedDevice, onDeviceReset, onSignOut }: WelcomeScreenProps) {
  const greeting = useGreeting();
  const { device, connect, disconnect, togglePower } = useDeviceStore();
  const { preferences, setPreferences } = useSyncContext();
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [showHelp, setShowHelp] = useState(false);

  return (
    <LinearGradient
      colors={['#FDF8F0', '#FAF3E6', '#F5EBD8']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <SomnaraLogo />
          </View>

          <View style={styles.illustration}>
            <DeviceIllustration isOn={device.isOn} />
          </View>

          <Text style={styles.greeting}>{greeting}</Text>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={tab.icon}
                    size={16}
                    color={active ? colors.accent.DEFAULT : colors.text.tertiary}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.id}
                  </Text>
                  {active && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab content */}
          {activeTab === 'Home' && (
            <View style={styles.content}>
              <StatusCard device={device} />
              <NextAlarmCard />
              <SleepTonightButton />
              <View style={styles.buttons}>
                <Button
                  label={device.isConnected ? 'Disconnect' : 'Connect Device'}
                  onPress={device.isConnected ? disconnect : connect}
                  variant="primary"
                />
                <Button
                  label={device.isOn ? 'Turn Off' : 'Turn On'}
                  onPress={togglePower}
                  variant="secondary"
                  style={styles.secondaryBtn}
                />
              </View>
            </View>
          )}

          {activeTab === 'Alarms' && <AlarmsTab />}

          {activeTab === 'Sounds' && (
            <View style={styles.placeholder}>
              <Feather name="music" size={36} color={colors.text.tertiary} />
              <Text style={styles.placeholderText}>Sounds coming soon</Text>
            </View>
          )}

          {activeTab === 'Settings' && (
            <View style={styles.settingsContent}>
              <SunriseDurationPicker
                value={preferences.sunriseDuration}
                onChange={d => setPreferences({ sunriseDuration: d as 15 | 30 | 45 })}
              />
              <Text style={[styles.settingsSection, { marginTop: spacing['6'] }]}>MY DEVICE</Text>
              <DeviceOwnershipCard
                device={pairedDevice}
                onReset={onDeviceReset}
              />
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
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet">
        <HelpScreen pairedDevice={pairedDevice} onClose={() => setShowHelp(false)} />
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing['12'],
  },
  header: {
    paddingTop: spacing['6'],
    paddingBottom: 0,
    alignItems: 'center',
  },
  greeting: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.light,
    color: colors.accent.DEFAULT,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
    marginBottom: spacing['5'],
  },
  illustration: {
    alignItems: 'center',
    paddingTop: spacing['3'],
    paddingBottom: 0,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.elevated,
    marginHorizontal: spacing['6'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    marginBottom: spacing['5'],
    shadowColor: '#C49A6C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing['4'],
    gap: spacing['1'],
    position: 'relative',
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.tertiary,
    letterSpacing: typography.letterSpacing.wide,
  },
  tabLabelActive: {
    color: colors.accent.DEFAULT,
    fontWeight: typography.weights.semibold,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent.DEFAULT,
  },
  content: {
    gap: spacing['5'],
    paddingHorizontal: spacing['6'],
  },
  buttons: {
    gap: spacing['3'],
    marginTop: spacing['2'],
  },
  secondaryBtn: {
    marginTop: spacing['1'],
  },
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
});
