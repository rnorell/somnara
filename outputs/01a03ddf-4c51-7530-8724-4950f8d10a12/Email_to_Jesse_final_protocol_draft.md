Subject: Somnara protocol — final files and device test

Hi Jesse,

Thank you. Your reply confirms the remaining firmware behavior.

We have updated the Somnara app for Skip Next `0x1C`. We also recorded `0x13` as the audio follow-up notification.

Please send one final versioned bundle with:

- The authoritative APP-to-device protocol table and ACK table that you referenced.
- The UFW test package.
- The tested JieLi OTA APK or SDK version, OTA UUIDs, authentication, and signing details.
- The advertising byte layout and byte order for the MAC address and 16-byte flash UUID. Please confirm that the flash UUID does not change after bonding, power loss, OTA, or factory reset.
- Android and iOS test records for bonding, the negotiated MTU, `0x13`, the complete 104-byte `0x18` frame, Skip Next ACK and readback, the five-cycle reset, identity advertising, and OTA failure recovery.

For device identity, Somnara will use the 16-byte flash UUID as the stable device ID. The MAC address is diagnostic data.

For sound files, Sound ID `0` is Off. We will provide the final assets and manifest for IDs `1–25`. The manifest will include the filename, SHA-256, duration, sample rate, and loop rule. Until we send that package, please do not assign temporary files to these IDs.

Please use the attached updated workbook as the completion checklist.

Once we receive and test this bundle, we can freeze Protocol v1.0.

Best,

Alex
