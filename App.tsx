import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function App() {
  const [connected, setConnected] = useState(true);
  const [deviceOn, setDeviceOn] = useState(true);
  const [mode] = useState("Sunrise");

  return (
    <ScrollView contentContainerStyle={styles.app}>
      <StatusBar style="light" />
      <View style={styles.welcomeCard}>

        <View style={styles.brandMark}>
          <View style={styles.sunGlow} />
          <View style={styles.sunArch} />
          <View style={styles.horizon} />
        </View>

        <Text style={styles.title}>SOMNARA</Text>
        <Text style={styles.tagline}>Rise gently. Live fully.</Text>

        <View style={styles.deviceGlow}>
          <View style={styles.lamp}>
            <View style={[styles.lampLight, deviceOn && styles.lampLightOn]} />
            <View style={styles.lampBase}>
              <Text style={styles.lampTime}>07:00</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.label}>Bluetooth</Text>
              <Text style={styles.statusValue}>
                {connected ? "Connected" : "Not connected"}
              </Text>
            </View>
            <View style={[styles.pill, connected ? styles.pillOn : styles.pillOff]}>
              <Text style={styles.pillText}>
                {connected ? "Active" : "Offline"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusGrid}>
            <View style={styles.miniCard}>
              <Text style={styles.label}>Device</Text>
              <Text style={styles.miniValue}>{deviceOn ? "On" : "Off"}</Text>
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.label}>Mode</Text>
              <Text style={styles.miniValue}>{mode}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => setConnected(!connected)}
        >
          <Text style={styles.primaryBtnText}>
            {connected ? "Disconnect device" : "Connect Somnara"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setDeviceOn(!deviceOn)}
        >
          <Text style={styles.secondaryBtnText}>
            Turn device {deviceOn ? "off" : "on"}
          </Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const ORANGE = "#FF8C42";
const YELLOW = "#FFD166";
const BG = "#0B0C1A";
const CARD = "#13152A";
const BORDER = "#1E2140";
const MUTED = "#6B7090";

const styles = StyleSheet.create({
  app: {
    flexGrow: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: CARD,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 32,
    alignItems: "center",
  },

  // Brand mark
  brandMark: {
    width: 80,
    height: 50,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  sunGlow: {
    position: "absolute",
    top: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ORANGE,
    opacity: 0.15,
  },
  sunArch: {
    width: 50,
    height: 25,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: ORANGE,
    marginBottom: 4,
  },
  horizon: {
    width: 80,
    height: 2,
    backgroundColor: YELLOW,
    borderRadius: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 6,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 32,
    letterSpacing: 0.5,
  },

  // Lamp
  deviceGlow: {
    alignItems: "center",
    marginBottom: 32,
  },
  lamp: {
    alignItems: "center",
  },
  lampLight: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#1E2140",
    marginBottom: 8,
  },
  lampLightOn: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  lampBase: {
    backgroundColor: "#1A1D35",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  lampTime: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // Status panel
  statusPanel: {
    width: "100%",
    backgroundColor: "#0F1124",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillOn: {
    backgroundColor: "rgba(255, 140, 66, 0.15)",
  },
  pillOff: {
    backgroundColor: "rgba(107, 112, 144, 0.15)",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: ORANGE,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },
  statusGrid: {
    flexDirection: "row",
    gap: 12,
  },
  miniCard: {
    flex: 1,
    backgroundColor: "#13152A",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  miniValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Buttons
  primaryBtn: {
    width: "100%",
    backgroundColor: ORANGE,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: MUTED,
    fontSize: 16,
    fontWeight: "500",
  },
});
