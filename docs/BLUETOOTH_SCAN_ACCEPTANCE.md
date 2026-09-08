# Bluetooth scan fix acceptance

Build a new Android APK from this branch. JavaScript reloads alone do not update
Android permissions or the native OTA scanner.

## Physical checks still required

1. Install on Android 12 or newer with Bluetooth permissions initially denied.
   Open the firmware update panel and tap Scan for Somnara. Confirm Nearby Devices
   permission is requested. Grant it and confirm the scan runs.
2. Repeat after denying permission. Confirm a permission error, not a successful
   empty scan. Grant access in Android Settings and retry.
3. Run the diagnostic scan with Bluetooth off, then on. Confirm failures are
   reported as failures and a successful scan reports nearby device counts.
4. Repeat normal setup with Find My Somnara immediately after a cold launch.
   Confirm transient Bluetooth initialization does not produce Bluetooth-off.
5. On Android 11 or earlier, grant location permission and enable Location.
6. Confirm discovery against actual manufacturer firmware. Control discovery uses
   AE30; OTA uses AE00. Use the diagnostic report to inspect both service matches.
   Do not substitute names or arbitrary nearby devices for service matching.
7. Repeat on iOS, including first-time permission and cold launch.

## Onboarding and home acceptance

8. Connect to real firmware and accept any bonding prompt. Continue must remain
   unavailable until a valid 0x13 status report arrives. The manufacturer defines
   an automatic status after notifications are enabled; malformed notifications
   and ACKs alone must not unlock setup.
9. Withhold status: after 20 seconds confirm a useful error and working retry.
10. Complete onboarding. Confirm the same Bluetooth connection remains active and
    the home screen shows device-reported status. Disconnect/reconnect from Home.
11. Open OTA scanning. Confirm the shared control connection is released before
    OTA takes over. Reconnect and verify after the firmware restarts.
12. Sign out or unlink the device. Confirm the shared connection is destroyed.

Readiness here means a valid status exchange, not production bonding/security
acceptance. Power commands and alarm transfer remain unimplemented. Home no
longer uses fake Connect/Power buttons or a simulated bedtime routine. Alarm
preferences are still app-side settings and must not be treated as device writes.

No physical device, firmware transfer, or successful operation-page test was
performed in the coding environment. Record those results before sending the APK
as hardware-tested. A new APK is required for the native permission/scan changes.
