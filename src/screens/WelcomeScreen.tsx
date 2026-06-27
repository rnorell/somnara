import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii } from '../theme';
import { DeviceIllustration } from '../components/DeviceIllustration';
import { StatusCard } from '../components/StatusCard';
import { Button } from '../components/Button';
import { useGreeting } from '../hooks/useGreeting';
import { useDeviceStore } from '../state/deviceStore';

export function WelcomeScreen() {
  const greeting = useGreeting();
  const { device, connect, disconnect, togglePower } = useDeviceStore();

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
            <Text style={styles.brand}>SOMNARA</Text>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>

          <View style={styles.illustration}>
            <DeviceIllustration isOn={device.isOn} />
          </View>

          <View style={styles.content}>
            <StatusCard device={device} />

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
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: spacing['6'],
    paddingBottom: spacing['12'],
  },
  header: {
    paddingTop: spacing['10'],
    paddingBottom: spacing['6'],
    alignItems: 'center',
  },
  brand: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.widest,
    color: colors.accent.DEFAULT,
    marginBottom: spacing['3'],
  },
  greeting: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.light,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  illustration: {
    alignItems: 'center',
    paddingVertical: spacing['8'],
  },
  content: {
    gap: spacing['5'],
  },
  buttons: {
    gap: spacing['3'],
    marginTop: spacing['2'],
  },
  secondaryBtn: {
    marginTop: spacing['1'],
  },
});
