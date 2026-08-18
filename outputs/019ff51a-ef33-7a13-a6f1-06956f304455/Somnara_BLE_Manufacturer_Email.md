Subject: Somnara BLE protocol v0.10 — values required from firmware team

Hi Jesse,

Thank you for the clarification. We have updated the Somnara protocol document.

Somnara defines the required product behavior. Your firmware engineer can confirm and implement the final byte layouts.

Please note these fixed product requirements:

- Brightness and volume use 0–100% in the app.
- For brightness, the reference table also uses an internal 0–255 byte. Please confirm the exact conversion and rounding rule.
- The device stores up to 10 alarms and runs them without a connected phone.
- The RTC must remain valid after normal power loss. Stored alarms must continue without an app connection.
- Sound ID 0 is Off. The 25 supplied audio files use stable Sound IDs 1–25.
- Secure BLE bonding is required. A printed passkey is not mandatory. Please confirm the secure method supported by the hardware.
- BLE OTA is required in release 1.

Please answer these points in the attached workbook:

1. Confirm the final brightness bytes and rounding rule.
2. Provide the complete MCU uplink protocol for ACKs, errors, status, alarms and unsolicited events.
3. Confirm that your firmware engineer will produce and approve the final byte table from the Somnara behavior specification.
4. Confirm the supported BLE bonding method, bond storage, failed-attempt handling and factory-reset bond removal.
5. State how long the RTC remains valid after power loss and whether the hardware has an RTC backup source.
6. State the required hardware or firmware change that will keep stored alarms working without the app.
7. List every condition that makes the clock invalid.
8. Provide the complete OTA service UUIDs, characteristics, image format, packet flow, integrity and authenticity checks, resume behavior, dual-bank activation, rollback, progress and errors.
9. After you store the 25 files, return the completed Sound ID table with filename, duration, format, sample rate, loop behavior and SHA-256 checksum.
10. Confirm continuous playback, gapless loop, fade behavior and separate per-alarm volume.
11. Provide a reference app, test utility, protocol trace or development firmware for commands, reports and OTA.

The status “Manufacturer value required” means that we need your technical value. It does not mean that the function is unavailable.

Please return the completed workbook with the name of the firmware owner.
