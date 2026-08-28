# Somnara OTA Manufacturer Test

## Test package

- Android internal APK: `Somnara_OTA_Internal_Android_2026-08-28.apk`
- Android APK SHA-256: `12CF382399F45CF44535DBCD2869EC4A4D647A950D710446AFD5BD6E1F9913BF`
- Android signing: internal debug certificate. Do not use this APK for production.
- iPhone internal build: supply after the test iPhone UDID is registered with EAS.
- Bundled firmware: `somnara_V1_260828_5C00.ufw`
- File size: `866112` bytes
- SHA-256: `8E6BEE05A9F7D55AF9B6AD7FCAD7742E5A05F9A22A551128E93F03104084B66D`
- Android JL OTA SDK: `1.11.0`
- iOS JL OTA SDK: `2.5.0`

Expo Go cannot run this test. Use the supplied internal build.

## Before each test

1. Connect Somnara to stable power.
2. Keep the phone within 1 metre of Somnara.
3. Turn on Bluetooth and allow the requested Bluetooth permissions.
4. Open **Settings > Update Somnara**.
5. Tap **Use Bundled Firmware**, or tap **Choose Firmware File** for a later UFW.
6. Tap **Scan for Somnara**.
7. Select the device with the correct Flash UUID and MAC bytes.

The phone can show its bonding prompt after Notify is enabled or after the first data packet. Accept the prompt.

## Standard update test

1. Tap **Start Update**.
2. Confirm the update.
3. Keep Somnara powered. Keep the app open and the phone close.
4. Check these stages: connecting, authenticating, transferring, verifying, and restarting.
5. After Somnara restarts, tap **Reconnect and Verify**.
6. Confirm that the app reads the new firmware version.
7. Test alarms, saved settings, bonding, light, and audio.
8. Tap **Share Test Report** and send the report with the test result.

The update is not complete when the SDK reports success. It is complete only after the app reconnects and reads the new firmware version.

## Required fault tests

Run each case on Android and iPhone. Share one report for each run.

- Turn Bluetooth off during transfer, then retry.
- Close the app during transfer, then reopen it and retry.
- Remove device power during transfer, restore power, then retry.
- Select a corrupt UFW.
- Select a UFW for the wrong hardware.
- Retry after each safe failure.
- Test both the bundled UFW and a file selected with the picker.

Do not remove power during a normal update. Use the power-loss case only as a controlled recovery test.

## Recovery reset

If the device cannot recover, switch its power off and on five times. Keep each power-on period under 10 seconds. We call this a recovery reset. Deletion of stored Bluetooth bonds is not yet confirmed.

## Acceptance rule

Production OTA stays disabled until all required Android and iPhone tests pass. A same-version UFW can prove connection and file recognition. It cannot prove a version-to-version update.
