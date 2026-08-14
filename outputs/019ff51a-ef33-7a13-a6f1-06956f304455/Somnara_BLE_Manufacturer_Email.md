Subject: Somnara BLE protocol v0.9 — confirmation and OTA details required

Hi Jesse,

Thank you for the GATT UUIDs and the BLE protocol demo.

We have mapped the Somnara app requirements into the attached BLE protocol v0.9 workbook. This is a review draft. Please ask your firmware engineer to complete the open confirmation fields and return the workbook before implementation starts.

The first release must support:

- Secure BLE bonding with a six-digit passkey printed on the device.
- Discovery through the Somnara service UUID.
- Power, brightness, colour temperature, and device status.
- Real-time clock synchronization and clock-validity reporting.
- Up to 10 alarms stored and executed by the device without a connected phone.
- A separate sunrise duration, final brightness, sound, and volume for each alarm.
- 25 audio files. Please map the supplied files to stable Sound IDs 1–25. Sound ID 0 must remain Off.
- Firmware version and hardware revision reads.
- Safe BLE OTA with signed firmware, integrity checks, dual-bank rollback, interruption recovery, and progress reporting.

Please confirm these important points:

1. The complete device-to-app notification format, including acknowledgements, status, errors, alarm records, and unsolicited events.
2. The exact frame length rule, SUM8 checksum range, sequence handling, timeouts, retries, and duplicate-command behavior.
3. RTC retention, expected clock drift, power-loss behavior, and the exact result when the RTC is invalid.
4. The filename, customer-facing name, duration, format, sample rate, loop behavior, and SHA-256 checksum for each of the 25 supplied audio files.
5. Secure Connections passkey support, pairing-window behavior, failed-attempt limits, bond storage, and factory reset.
6. The complete OTA service, packet flow, image format, signature method, rollback process, and recovery process. “Dual backup” alone is not enough for app integration.
7. Availability of a reference app, SDK or sample code, protocol traces, and at least two production-equivalent development units.

Brightness and volume use integer values from `0–100%` in the BLE protocol. Please keep this external scale unchanged. The firmware can convert these values to its native hardware range internally. Device status must return the same `0–100%` value used by the app.

Please also complete the Hardware Capability and Future Feature Review sheet. This includes alarm dismiss, snooze, gradual sound ramp, sunrise curve, sunset or wind-down mode, reading or night-light presets, sleep timer, audio loop and fade behavior, physical controls, power-loss recovery, time-zone changes, diagnostics, OTA recovery, and future memory capacity. Marking a feature as possible does not add it to protocol v1.0. It helps us avoid a protocol design that blocks later product improvements.

Please mark any proposed opcode or byte layout that your chipset cannot support. Do not change values silently. Add your alternative in the manufacturer-response column.

After we agree all open items, we will issue protocol v1.0 as the implementation baseline.

Best regards,

Somnara team
