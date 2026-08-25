# Somnara protocol audit — 25 August 2026

## Result

The new manufacturer workbook is internally consistent for the ACK, `0x13` status, and fixed `0x18` alarm-list frames. It closes the main device-to-app data gap. Protocol v1.0 is not ready because the final app-to-device frames, production security, unique identity, audio behavior, OTA integration material, and hardware test evidence are still open.

## Confirmed

- AE02 carries ACK, status, and alarm-list notifications.
- ACK is 8 bytes with opcode `0x7F`, copied sequence/request opcode, result code, detail, and SUM8.
- Status `0x13` is 24 bytes and supports query responses plus automatic sequence `0xFF` status after notifications are enabled.
- Current values are protocol `0.11`, Product ID `1`, hardware revision `0`, firmware `0.0.2`, Build `0`.
- Alarm list `0x18` is 104 bytes with ten fixed 9-byte slots, list checksum, frame checksum, and ATT MTU at least 107.

## Discrepancies and risks

- The new ACK list omits Skip Next `0x1C`, which appeared in the earlier command plan and ACK matrix.
- No separate Audio State frame is defined. The workbook only defines ACK plus general status.
- The status Flags byte is fixed at zero, so it does not confirm production bonding or security state.
- The alarm list requires one 104-byte notification. Passing Android and iOS MTU evidence is still required.
- Status supplies hardware and firmware versions but no serial number or stable unique device identity.
- The earlier v0.11 draft proposed chunked alarm readback. Current firmware instead defines one fixed 104-byte report. The app must follow the current firmware document after hardware validation.

## Current app status

The AE02 dispatch gap is fixed locally. The app now routes `0x7F` to the ACK controller, parses `0x13` into typed device status, and recognizes `0x18` without treating it as an ACK. Automatic status with sequence `0xFF` no longer creates `invalid_ack_opcode`. The native transport still does not request or verify the Android MTU required for the 104-byte alarm list.

## Validation

- Source workbook structure and byte positions reviewed.
- Frame lengths and checksum positions reconciled.
- Current ACK result codes match `0–13` in the app core.
- Fifteen test suites and 94 tests pass after the status-dispatch implementation.
- TypeScript and `git diff --check` pass.
