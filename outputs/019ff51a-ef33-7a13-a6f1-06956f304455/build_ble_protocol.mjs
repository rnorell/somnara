import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = 'C:/Users/adver/OneDrive/Documents/somnara/outputs/019ff51a-ef33-7a13-a6f1-06956f304455';
const previewDir = `${outputDir}/previews`;
const outputPath = `${outputDir}/Somnara_BLE_Protocol_v0.9_for_review.xlsx`;
await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();
const navy = '#17324D', blue = '#2D6A8A', pale = '#EAF3F6', amber = '#FFF2CC';
const green = '#E2F0D9', red = '#FCE4D6', line = '#CBD5E1', ink = '#1F2937', white = '#FFFFFF';

function title(sheet, text, subtitle, cols = 8) {
  const end = String.fromCharCode(64 + cols);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${end}1`).merge();
  sheet.getRange('A1').values = [[text]];
  sheet.getRange(`A1:${end}1`).format = { fill: navy, font: { bold: true, color: white, size: 16 }, rowHeight: 30, verticalAlignment: 'center' };
  sheet.getRange(`A2:${end}2`).merge();
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange(`A2:${end}2`).format = { fill: pale, font: { color: ink, italic: true }, wrapText: true, rowHeight: 34, verticalAlignment: 'center' };
}

function header(range) {
  range.format = { fill: blue, font: { bold: true, color: white }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'all', style: 'thin', color: line } };
}

function body(range) {
  range.format = { font: { color: ink }, wrapText: true, verticalAlignment: 'top', borders: { preset: 'all', style: 'thin', color: line } };
}

function widths(sheet, values) {
  for (const [col, px] of Object.entries(values)) sheet.getRange(`${col}:${col}`).format.columnWidthPx = px;
}

const overview = wb.worksheets.add('Overview');
title(overview, 'Somnara BLE Protocol v0.9', 'PROPOSED FOR MANUFACTURER REVIEW — not approved for production until all items on Open Confirmations are closed.', 7);
overview.getRange('A4:B12').values = [
  ['Field', 'Value'],
  ['Product / advertising name', 'Somnara'],
  ['Protocol version', '0.9 review draft'],
  ['App release scope', 'One claimed device per account; protocol identity is future-ready for more devices'],
  ['Stored alarm capacity', '10 alarms'],
  ['Audio capacity', '25 supplied audio files plus Sound ID 0 = Off'],
  ['Security', 'BLE Secure Connections bonding with printed six-digit passkey'],
  ['Offline behavior', 'RTC and last committed alarm set must work without a connected phone'],
  ['OTA', 'Required before launch; supplier must complete the OTA sheet'],
];
header(overview.getRange('A4:B4')); body(overview.getRange('A5:B12'));
overview.getRange('D4:G4').merge(); overview.getRange('D4').values = [['Approval gate']]; header(overview.getRange('D4:G4'));
overview.getRange('D5:G10').merge(); overview.getRange('D5').values = [[
  'Firmware implementation must not begin from assumptions. Manufacturer must confirm frame rules, notification frames, error behavior, audio mapping, RTC persistence, bonding behavior, advertising data, and OTA. After written approval, freeze this document as protocol v1.0.'
]]; overview.getRange('D5:G10').format = { fill: amber, font: { bold: true, color: ink }, wrapText: true, verticalAlignment: 'center', borders: { preset: 'outside', style: 'medium', color: '#D6B656' } };
overview.getRange('A14:G17').merge(); overview.getRange('A14').values = [[
  'Source basis: manufacturer GATT UUID reply and BLE协议demo.xlsx, sheet APP下发协议. The demo supplies command patterns for power, brightness, RGB, CCT, clock, timers, LED count, and alarms. This draft narrows and extends that reference to the current Somnara product requirements.'
]]; overview.getRange('A14:G17').format = { fill: '#F8FAFC', wrapText: true, verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: line } };
widths(overview, { A: 190, B: 360, C: 20, D: 130, E: 130, F: 130, G: 130 });

const gatt = wb.worksheets.add('GATT and Discovery');
title(gatt, 'GATT Profile and Discovery', 'Use the service UUID for discovery. Do not identify devices by Bluetooth name or MAC address alone.', 7);
gatt.getRange('A4:G9').values = [
  ['Item', 'UUID / value', 'Properties', 'Security', 'Direction', 'Purpose', 'Status'],
  ['Somnara control service', '0000AE30-0000-1000-8000-00805F9B34FB', 'Primary service', 'Encrypted link', '—', 'Discovery and command transport', 'Manufacturer supplied'],
  ['Command characteristic', '0000AE01-0000-1000-8000-00805F9B34FB', 'Write without response', 'Encrypted + authenticated', 'App → device', 'Send framed commands', 'Manufacturer supplied'],
  ['Event characteristic', '0000AE02-0000-1000-8000-00805F9B34FB', 'Notify', 'Encrypted + authenticated', 'Device → app', 'ACK, errors, status, alarm records', 'Manufacturer supplied UUID; payload open'],
  ['Device Information Service', '0000180A-0000-1000-8000-00805F9B34FB', 'Read', 'Encrypted', 'Device → app', 'Serial, hardware and firmware revisions', 'Proposed standard service'],
  ['Advertising name', 'Somnara', 'Complete local name', 'Public', 'Device → app', 'Customer-visible product name', 'Approved product choice'],
];
header(gatt.getRange('A4:G4')); body(gatt.getRange('A5:G9')); gatt.getRange('G5:G9').format.fill = amber;
gatt.getRange('A12:G17').values = [
  ['Advertising service-data byte', 'Name', 'Type', 'Value', 'Meaning', 'Privacy', 'Status'],
  [0, 'Protocol major', 'uint8', 1, 'Major version after approval', 'Non-sensitive', 'Proposed'],
  [1, 'Product ID', 'uint8', 1, 'Somnara hardware family', 'Non-sensitive', 'Proposed'],
  [2, 'Flags', 'bitfield', 'bit0 pairing window; bit1 bonded; bits2–7 reserved', 'Connection state', 'Non-sensitive', 'Proposed'],
  ['3–6', 'Device ID', 'uint32 little-endian', 'Per-device random identifier', 'Distinguish nearby units; not a MAC address or serial', 'Rotate only after factory reset', 'Proposed'],
  ['7–15', 'Reserved', 'bytes', 0, 'Future use', '—', 'Proposed'],
];
header(gatt.getRange('A12:G12')); body(gatt.getRange('A13:G17')); gatt.getRange('G13:G17').format.fill = amber;
widths(gatt, { A: 160, B: 330, C: 160, D: 170, E: 150, F: 280, G: 180 });
gatt.freezePanes.freezeRows(4);

const frame = wb.worksheets.add('Frame Format');
title(frame, 'Common Command and Event Frame', 'All normal control frames must fit in a 20-byte ATT payload. Reserved bytes are 0x00.', 8);
frame.getRange('A4:H10').values = [
  ['Offset', 'Field', 'Size', 'Type', 'Required value', 'Rule', 'Example', 'Status'],
  [0, 'Header', 1, 'uint8', '0xFF', 'Start of every frame', 'FF', 'From demo'],
  [1, 'Length', 1, 'uint8', 'Full frame length', 'Includes header through checksum', '08', 'Proposed clarification'],
  [2, 'Sequence', 1, 'uint8', '0–254', 'Response copies request value; 255 reserved for unsolicited event', '01', 'Proposed clarification'],
  [3, 'Opcode', 1, 'uint8', 'Command/event code', 'See Commands and Notifications', '05', 'From demo'],
  [4, 'Payload', '0–15', 'bytes', 'Opcode-specific', 'Unused reserved bytes are 0', '01 00 00', 'Defined per command'],
  ['last', 'SUM8', 1, 'uint8', 'sum(bytes 0..last-1) mod 256', 'Reject frame if checksum does not match', '0E', 'Proposed clarification'],
];
header(frame.getRange('A4:H4')); body(frame.getRange('A5:H10')); frame.getRange('H5:H10').format.fill = amber;
frame.getRange('A13:H18').values = [
  ['Transport rule', 'Value', null, null, null, null, null, null],
  ['Write type', 'WRITE WITHOUT RESPONSE; protocol ACK is mandatory', null, null, null, null, null, null],
  ['Concurrency', 'One command in flight per device', null, null, null, null, null, null],
  ['Timeout / retry', '1 second; retry once with the same sequence', null, null, null, null, null, null],
  ['Duplicate command', 'Device returns the previous result and must not repeat a side effect', null, null, null, null, null, null],
  ['Byte order', 'Little-endian for all multi-byte integers', null, null, null, null, null, null],
];
frame.getRange('A13:H13').merge(true); header(frame.getRange('A13:H13')); frame.getRange('A14:H18').merge(true); body(frame.getRange('A14:H18'));
frame.getRange('A14:A18').values = [
  ['Write type — WRITE WITHOUT RESPONSE; protocol ACK is mandatory.'],
  ['Concurrency — One command in flight per device.'],
  ['Timeout / retry — 1 second; retry once with the same sequence.'],
  ['Duplicate command — Device returns the previous result and must not repeat a side effect.'],
  ['Byte order — Little-endian for all multi-byte integers.'],
];
widths(frame, { A: 90, B: 150, C: 90, D: 120, E: 210, F: 300, G: 160, H: 180 });

const commands = wb.worksheets.add('Commands');
title(commands, 'App → Device Commands', 'Opcode allocations marked Proposed require written manufacturer approval before protocol v1.0.', 8);
commands.getRange('A4:H18').values = [
  ['Opcode (hex)', 'Command', 'Payload bytes from offset 4', 'Length', 'Response', 'App mapping', 'Offline effect', 'Status'],
  ["'0x04", 'Set CCT', 'mode=1, index=3, W, WW, inverseBrightness', 10, 'ACK + status', 'Colour temperature', 'Persists current light state', 'Adapted from demo'],
  ["'0x05", 'Set power', 'state: 1=On, 2=Off', 6, 'ACK + status', 'Power button', 'Persists current power state', 'From demo'],
  ["'0x07", 'Set brightness', 'percent 0–100, inverse=round(255-percent×255/100)', 7, 'ACK + status', 'Brightness', 'Persists current brightness', '0–100% contract'],
  ["'0x08", 'Set volume', 'percent 0–100', 6, 'ACK + status', 'Alarm volume', 'Persists default preview volume', '0–100% contract'],
  ["'0x09", 'Audio control', 'action: 0=Stop, 1=Preview; soundId 0–25; volume 0–100', 8, 'ACK + audio state', 'Sound selection and preview', 'No alarm change', 'Proposed'],
  ["'0x13", 'Get status', 'queryToken 0–254, marker=0xAA', 7, 'Status event', 'Connection refresh', 'Read only', 'Adapted from demo'],
  ["'0x16", 'Set RTC', 'year-2000, month, day, hour, minute, second, weekday 1=Mon…7=Sun', 12, 'ACK + status', 'Clock sync on connection', 'Required for local alarms', 'From demo'],
  ["'0x17", 'Upsert alarm', 'See Alarm Record sheet', 18, 'ACK + alarm record', 'Save or enable alarm', 'Committed alarm runs locally', 'Redesigned for Somnara'],
  ["'0x18", 'Read alarms', 'queryToken, marker=0xAA', 7, '0x18 records + end event', 'Reconcile saved alarms', 'Read only', 'Replaces 104-byte demo response'],
  ["'0x19", 'Begin alarm sync', 'revision uint16, expectedCount 0–10', 8, 'ACK', 'Start atomic replacement', 'Old set remains active', 'Proposed'],
  ["'0x1A", 'Commit alarm sync', 'revision uint16, expectedCount 0–10', 8, 'ACK + alarm-list end', 'Finish atomic replacement', 'New set becomes active together', 'Proposed'],
  ["'0x1B", 'Delete alarm', 'index 0–9, marker=0xAA', 7, 'ACK', 'Delete alarm', 'Alarm is removed', 'Adapted from demo'],
  ["'0x1C", 'Skip next', 'index 0–9, skip: 0=Clear, 1=Skip', 7, 'ACK + alarm record', 'Skip next occurrence', 'Persists until used or cleared', 'Proposed'],
  ["'0x7F", 'Protocol ACK/error', 'Device-to-app only', 'Variable', '—', 'See Notifications', '—', 'Proposed'],
];
header(commands.getRange('A4:H4')); body(commands.getRange('A5:H18')); commands.getRange('H5:H18').format.fill = amber;
widths(commands, { A: 85, B: 150, C: 420, D: 70, E: 160, F: 220, G: 220, H: 190 }); commands.freezePanes.freezeRows(4);

const alarm = wb.worksheets.add('Alarm Record');
title(alarm, 'Alarm Record — 0x17', 'One record is 18 bytes including the frame. Alarm labels remain in the app/cloud and are not sent to firmware.', 8);
alarm.getRange('A4:H19').values = [
  ['Frame offset', 'Field', 'Size', 'Type', 'Allowed values', 'Meaning', 'Example', 'Status'],
  [0, 'Header', 1, 'uint8', '0xFF', 'Frame start', 'FF', 'Common'],
  [1, 'Length', 1, 'uint8', 18, 'Full frame length', '12', 'Proposed'],
  [2, 'Sequence', 1, 'uint8', '0–254', 'Request identifier', '01', 'Common'],
  [3, 'Opcode', 1, 'uint8', '0x17', 'Upsert alarm', '17', 'Allocated'],
  [4, 'Index', 1, 'uint8', '0–9', 'Stable firmware slot', '00', 'From demo'],
  [5, 'Flags', 1, 'bitfield', 'bit0 enabled; bit1 skipNext; bits2–7=0', 'Alarm state', '01', 'Proposed'],
  [6, 'Hour', 1, 'uint8', '0–23', 'Wake time hour', '06', 'Required'],
  [7, 'Minute', 1, 'uint8', '0–59', 'Wake time minute', '1E', 'Required'],
  [8, 'Weekday mask', 1, 'bitfield', 'bit0=Mon … bit6=Sun; 0 is invalid', 'Repeat days', '1F', 'Normalized from app'],
  [9, 'Sunrise minutes', 1, 'uint8', '15, 30, 45', 'Light begins this many minutes before wake time', '1E', 'Approved app values'],
  [10, 'Final brightness', 1, 'uint8', '0–100', 'Brightness at wake time', '50', '0–100% contract'],
  [11, 'Sound ID', 1, 'uint8', '0–25', '0=Off; 1–25 supplied audio files', '01', 'Updated requirement'],
  [12, 'Volume', 1, 'uint8', '0–100', 'Alarm audio volume', '32', '0–100% contract'],
  ['13–16', 'Reserved', 4, 'bytes', '0x00', 'Future fade/audio parameters', '00 00 00 00', 'Reserved'],
  [17, 'SUM8', 1, 'uint8', 'Calculated', 'Checksum', 'FC', 'Common'],
];
header(alarm.getRange('A4:H4')); body(alarm.getRange('A5:H19')); alarm.getRange('H5:H19').format.fill = amber;
alarm.getRange('A21:H24').values = [
  ['Rule', 'Value', null, null, null, null, null, null],
  ['Commit behavior', '0x17 outside a sync updates one slot atomically. During 0x19/0x1A sync, records are staged and become active only after a valid commit.', null, null, null, null, null, null],
  ['RTC invalid', 'Device must not silently discard alarms. It reports CLOCK_INVALID and keeps the stored alarm set until the app sets a valid RTC.', null, null, null, null, null, null],
  ['Disconnect', 'Alarms, sunrise, audio, volume, skip-next, and RTC continue locally after Bluetooth disconnect.', null, null, null, null, null, null],
];
alarm.getRange('A21:H21').merge(true); header(alarm.getRange('A21:H21')); alarm.getRange('A22:H24').merge(true); body(alarm.getRange('A22:H24'));
alarm.getRange('A22:A24').values = [
  ['Commit behavior — 0x17 outside a sync updates one slot atomically. During 0x19/0x1A sync, records are staged and become active only after a valid commit.'],
  ['RTC invalid — Device must not silently discard alarms. It reports CLOCK_INVALID and keeps the stored alarm set until the app sets a valid RTC.'],
  ['Disconnect — Alarms, sunrise, audio, volume, skip-next, and RTC continue locally after Bluetooth disconnect.'],
];
widths(alarm, { A: 100, B: 170, C: 75, D: 105, E: 220, F: 310, G: 150, H: 180 });

const audio = wb.worksheets.add('Audio Map');
title(audio, 'Audio File Map — 25 Supplied Files', 'Sound ID 0 is always Off. Manufacturer must map every supplied audio file to one stable ID and confirm the exact file identity.', 8);
const audioRows = [['Sound ID', 'App display name', 'Manufacturer filename', 'Duration (s)', 'Format / sample rate', 'SHA-256', 'Loop behavior', 'Confirmation status']];
audioRows.push([0, 'Off', 'No file', 0, '—', '—', 'Silent', 'Fixed']);
for (let i = 1; i <= 25; i++) audioRows.push([i, `Audio ${String(i).padStart(2, '0')} — name required`, '', null, '', '', 'Manufacturer to confirm', 'OPEN']);
audio.getRange(`A4:H${3 + audioRows.length}`).values = audioRows;
header(audio.getRange('A4:H4')); body(audio.getRange(`A5:H${3 + audioRows.length}`));
audio.getRange('H5:H30').conditionalFormats.add('containsText', { text: 'OPEN', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
audio.getRange('H5:H30').conditionalFormats.add('containsText', { text: 'Fixed', format: { fill: green, font: { bold: true, color: '#375623' } } });
audio.getRange('A5:A30').format.numberFormat = '0'; audio.getRange('D5:D30').format.numberFormat = '0.0';
audio.getRange('H6:H30').dataValidation = { rule: { type: 'list', values: ['OPEN', 'CONFIRMED', 'FILE MISMATCH'] } };
widths(audio, { A: 85, B: 240, C: 260, D: 100, E: 190, F: 390, G: 180, H: 160 }); audio.freezePanes.freezeRows(4);

const notify = wb.worksheets.add('Notifications');
title(notify, 'Device → App Notifications', 'The manufacturer did not supply these payloads. This proposed format must be confirmed and implemented.', 8);
notify.getRange('A4:H14').values = [
  ['Opcode (hex)', 'Event', 'Payload bytes from offset 4', 'Sequence', 'When sent', 'App action', 'Max length', 'Status'],
  ["'0x7F", 'ACK / error', 'requestOpcode, resultCode, detail', 'Copies request', 'For every valid or rejected command', 'Complete, retry, or show error', 8, 'Proposed'],
  ["'0x13", 'Status', 'power, brightness, cctW, cctWW, volume, activeSoundId, clockValid, alarmCount, flags', 'Request sequence or 0xFF', 'After query and state change', 'Update live device state', 15, 'Proposed'],
  ["'0x18", 'Alarm record', 'Same alarm payload as offsets 4–16 of 0x17', 'Read request sequence', 'One event per occupied slot', 'Build device alarm set', 18, 'Proposed'],
  ["'0x18", 'Alarm list end', 'recordType=0xFF, revision uint16, count, listChecksum', 'Read request sequence', 'After final record', 'Validate complete list', 10, 'Proposed'],
  ["'0x09", 'Audio state', 'state: stopped/playing; soundId; volume', 'Request or 0xFF', 'Audio starts, stops, or fails', 'Update preview UI', 8, 'Proposed'],
  ["'0x70", 'Alarm fired', 'index, phase: sunrise/sound/dismissed, timestamp', '0xFF', 'Alarm phase changes', 'Update UI if connected', 12, 'Proposed'],
  ["'0x71", 'Clock invalid', 'reason, lastValid timestamp if available', '0xFF', 'RTC is invalid', 'Set RTC and verify status', 12, 'Proposed'],
  ["'0x72", 'Device reset', 'reason, reset counter', '0xFF', 'Boot or factory reset', 'Refresh full state', 9, 'Proposed'],
  ["'0x73", 'OTA progress', 'state, percent, error', '0xFF', 'During OTA', 'Update OTA screen', 8, 'Open: align with bootloader'],
  ["'0x74", 'Button event', 'buttonId, action', '0xFF', 'Physical control changes state', 'Refresh affected state', 7, 'Optional / open'],
];
header(notify.getRange('A4:H4')); body(notify.getRange('A5:H14')); notify.getRange('H5:H14').format.fill = amber;
widths(notify, { A: 80, B: 150, C: 390, D: 160, E: 240, F: 240, G: 90, H: 200 });

const errors = wb.worksheets.add('Error Codes');
title(errors, 'Protocol Result Codes', 'Result code 0 is success. Other values reject the command without a partial state change.', 6);
errors.getRange('A4:F18').values = [
  ['Code', 'Name', 'Meaning', 'Retry?', 'App response', 'Status'],
  [0, 'OK', 'Command completed', 'No', 'Apply confirmed state', 'Proposed'],
  [1, 'INVALID_LENGTH', 'Length does not match frame', 'No', 'Log protocol mismatch', 'Proposed'],
  [2, 'INVALID_CHECKSUM', 'SUM8 failed', 'Once', 'Retry same sequence once', 'Proposed'],
  [3, 'UNKNOWN_OPCODE', 'Opcode is not supported', 'No', 'Block feature for this firmware', 'Proposed'],
  [4, 'INVALID_VALUE', 'Payload value is outside allowed range', 'No', 'Reject local change', 'Proposed'],
  [5, 'NOT_BONDED', 'Command requires authenticated bond', 'No', 'Start secure setup', 'Proposed'],
  [6, 'BUSY', 'Device cannot process command now', 'Yes', 'Retry with backoff', 'Proposed'],
  [7, 'CLOCK_INVALID', 'RTC is not valid', 'After RTC sync', 'Set RTC, then retry', 'Proposed'],
  [8, 'ALARM_LIMIT', 'More than 10 alarms', 'No', 'Show alarm limit', 'Proposed'],
  [9, 'AUDIO_NOT_FOUND', 'Sound ID has no installed file', 'No', 'Show sound unavailable', 'Proposed'],
  [10, 'SYNC_CONFLICT', 'Revision or count does not match', 'After full read', 'Read and reconcile alarms', 'Proposed'],
  [11, 'OTA_INVALID_IMAGE', 'Firmware image failed validation', 'No', 'Stop OTA and keep current bank', 'Proposed'],
  [12, 'OTA_WRONG_HARDWARE', 'Image is not for this hardware', 'No', 'Block update', 'Proposed'],
  [13, 'INTERNAL_ERROR', 'Firmware could not complete command', 'Once', 'Retry then report diagnostics', 'Proposed'],
];
header(errors.getRange('A4:F4')); body(errors.getRange('A5:F18')); errors.getRange('F5:F18').format.fill = amber;
widths(errors, { A: 80, B: 200, C: 330, D: 110, E: 280, F: 150 });

const security = wb.worksheets.add('Security and Pairing');
title(security, 'Pairing, Bonding, and Ownership', 'BLE transport security protects commands. The cloud activation code and BLE passkey are separate credentials.', 6);
security.getRange('A4:F14').values = [
  ['Stage', 'Device behavior', 'App behavior', 'Required control', 'Failure behavior', 'Status'],
  ['Factory state', 'Advertise Somnara service; control characteristics locked', 'Scan by service UUID', 'No control before secure setup', 'Ignore unauthenticated commands', 'Proposed'],
  ['Pairing window', 'Two-second rear-button hold opens window for two minutes', 'Show nearby eligible device IDs', 'Physical presence', 'Window closes automatically', 'Proposed'],
  ['Passkey', 'Use printed six-digit passkey', 'User enters or scans passkey', 'LE Secure Connections authenticated pairing', 'Rate-limit failed attempts', 'Approved choice / firmware open'],
  ['Bonded use', 'Allow encrypted authenticated GATT access', 'Reconnect with stored bond', 'No plaintext control', 'Prompt secure re-pair', 'Proposed'],
  ['Wrong account', 'BLE bond does not change cloud ownership', 'Cloud claim remains required', 'Activation code stays separate', 'Do not expose account data over BLE', 'Proposed'],
  ['Bond removal', 'Rear-button factory reset clears bonds and settings after confirmation gesture', 'Unlink does not claim physical reset', 'Prevent remote ownership takeover', 'Device enters setup state', 'Proposed'],
  ['Multiple devices nearby', 'Advertise unique random Device ID', 'Show one claimed device in v1; preserve ID for future selection', 'Do not depend on MAC address', 'Ask user to press the target device button', 'Proposed'],
  ['Logging', 'Do not notify passkey or activation code', 'Redact identifiers and credentials', 'No secrets in analytics', 'Store only diagnostic codes', 'Proposed'],
  ['Key storage', 'Store bond keys in protected non-volatile storage', 'Use OS BLE bond store', 'No app-exported BLE keys', 'Clear on factory reset', 'Manufacturer to confirm'],
  ['Attack limits', 'Delay repeated failed pairing attempts', 'Show clear retry timing', 'Manufacturer defines threshold', 'Do not weaken security automatically', 'Manufacturer to confirm'],
];
header(security.getRange('A4:F4')); body(security.getRange('A5:F14')); security.getRange('F5:F14').format.fill = amber;
widths(security, { A: 150, B: 320, C: 280, D: 260, E: 260, F: 190 });

const features = wb.worksheets.add('Feature Review');
title(features, 'Hardware Capability and Future Feature Review', 'This sheet checks what the current hardware can support. “Future option” does not add the function to protocol v1.0.', 7);
features.getRange('A4:G23').values = [
  ['Feature', 'Priority', 'Required behavior or question', 'Why it matters', 'Manufacturer capability', 'Required firmware change', 'Somnara decision'],
  ['Brightness percentage', 'Launch contract', 'Accept and report integer values from 0–100%; implement any internal hardware conversion without changing the BLE value', 'App and device use one stable scale', '', '', 'IN v1.0'],
  ['Volume percentage', 'Launch contract', 'Accept and report integer values from 0–100%; implement any internal hardware conversion without changing the BLE value', 'App and device use one stable scale', '', '', 'IN v1.0'],
  ['Brightness curve', 'Manufacturer detail', 'Document the physical LED output curve used behind the fixed 0–100% protocol value', 'Supports product tuning without changing the protocol', '', '', 'OPEN'],
  ['Volume curve', 'Manufacturer detail', 'Document the physical speaker curve used behind the fixed 0–100% protocol value', 'Supports product tuning without changing the protocol', '', '', 'OPEN'],
  ['Alarm dismiss', 'Launch required', 'Physical button and app command stop the active sunrise and sound', 'User must stop an alarm without the phone', '', '', 'OPEN'],
  ['Snooze', 'Recommended v1', 'Confirm hardware support, duration range, repeat limit, and physical-button action', 'Common alarm-clock expectation', '', '', 'OPEN'],
  ['Gradual sound ramp', 'Recommended v1', 'Confirm whether audio volume can rise over time and which ramp parameters are possible', 'Prevents an abrupt wake sound', '', '', 'OPEN'],
  ['Sunrise curve', 'Launch required', 'Confirm supported colour-temperature and brightness curve, update interval, and final state', 'Defines the core wake experience', '', '', 'OPEN'],
  ['Sunset / wind-down', 'Future option', 'Confirm reverse light fade, duration, final level, and optional audio', 'Supports a bedtime routine', '', '', 'OPEN'],
  ['Reading / night light', 'Future option', 'Confirm manual CCT/brightness presets and persistence', 'Adds useful bedside lighting', '', '', 'OPEN'],
  ['Sleep timer', 'Future option', 'Confirm delayed light/audio stop and maximum duration', 'Lets sound or light stop after sleep', '', '', 'OPEN'],
  ['Audio loop and fade', 'Launch required', 'Confirm loop points, gaps, fade-in, fade-out, and maximum continuous play time for all 25 files', 'Avoid clicks, silence gaps, and abrupt stops', '', '', 'OPEN'],
  ['Physical controls', 'Launch blocker', 'List every button/gesture and its behavior in setup, idle, sunrise, alarm, audio, and OTA states', 'App state must match local control', '', '', 'OPEN'],
  ['Power-loss recovery', 'Launch blocker', 'Confirm RTC, alarms, bonds, settings, and active-state behavior after power loss', 'Alarm must remain reliable', '', '', 'OPEN'],
  ['Time zone / DST', 'Launch required', 'Confirm device stores local time only; app resynchronizes after time-zone or daylight-saving changes', 'Prevents alarms at the wrong local time', '', '', 'OPEN'],
  ['Factory reset', 'Launch blocker', 'Confirm physical gesture, duration, confirmation feedback, and data cleared', 'Required for recovery and ownership transfer', '', '', 'OPEN'],
  ['Diagnostics', 'Recommended v1', 'Confirm available speaker, LED, storage, RTC, reset-reason, and temperature diagnostics', 'Speeds support and fault isolation', '', '', 'OPEN'],
  ['OTA recovery mode', 'Launch blocker', 'Confirm physical recovery entry and behavior when normal firmware cannot boot', 'Prevents an unrecoverable device', '', '', 'OPEN'],
  ['Future capacity', 'Planning', 'Confirm free flash/RAM, remaining opcode space, maximum audio storage, and expected firmware growth limit', 'Avoids a protocol that blocks later features', '', '', 'OPEN'],
];
header(features.getRange('A4:G4')); body(features.getRange('A5:G23'));
features.getRange('E5:E23').dataValidation = { rule: { type: 'list', values: ['SUPPORTED NOW', 'POSSIBLE', 'NOT AVAILABLE', 'NEEDS INVESTIGATION'] } };
features.getRange('G5:G23').dataValidation = { rule: { type: 'list', values: ['OPEN', 'IN v1.0', 'FUTURE', 'EXCLUDED'] } };
features.getRange('G5:G23').conditionalFormats.add('containsText', { text: 'OPEN', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
widths(features, { A: 190, B: 125, C: 470, D: 310, E: 180, F: 280, G: 130 }); features.freezePanes.freezeRows(4);

const ota = wb.worksheets.add('OTA Requirements');
title(ota, 'BLE OTA — Launch Requirement', 'Manufacturer must complete every OPEN value. Do not infer OTA details from “dual backup” alone.', 6);
ota.getRange('A4:F20').values = [
  ['Requirement', 'Required result', 'Manufacturer value', 'Evidence / test', 'Release gate', 'Status'],
  ['OTA service UUID', 'Dedicated service or documented reuse', '', 'GATT capture', 'Required', 'OPEN'],
  ['OTA characteristic UUIDs', 'Control, data, status roles', '', 'GATT capture', 'Required', 'OPEN'],
  ['Image format', 'Header, version, size, hardware ID, signature', '', 'Signed sample image', 'Required', 'OPEN'],
  ['Authenticity', 'Cryptographic signature verified before activation', '', 'Invalid-signature test', 'Required', 'OPEN'],
  ['Integrity', 'Whole-image SHA-256 or stronger', '', 'Corrupt-image test', 'Required', 'OPEN'],
  ['Anti-rollback', 'Reject vulnerable or incompatible downgrade unless service-authorized', '', 'Downgrade test', 'Required', 'OPEN'],
  ['Chunk transport', 'MTU, payload size, offset, ACK, retry, resume', '', 'Interrupted transfer test', 'Required', 'OPEN'],
  ['Dual-bank behavior', 'Current image remains bootable during download', '', 'Power-loss test', 'Required', 'OPEN'],
  ['Activation', 'Verify, mark candidate, reboot, self-test, confirm', '', 'Successful update test', 'Required', 'OPEN'],
  ['Rollback', 'Automatic return to last known-good bank after failed boot/self-test', '', 'Forced boot failure', 'Required', 'OPEN'],
  ['Low power', 'Reject or pause update below safe threshold', '', 'Low-power test', 'Required', 'OPEN'],
  ['Progress', 'State, percentage, and stable error codes', '', 'App progress capture', 'Required', 'OPEN'],
  ['Recovery', 'Document recovery if both banks fail', '', 'Recovery procedure', 'Required', 'OPEN'],
  ['Version read', 'App reads firmware and hardware revisions before and after OTA', '', 'Device Information Service', 'Required', 'OPEN'],
  ['Test package', 'Firmware files, release notes, expected hashes, and rollback image', '', 'Supplier delivery', 'Required', 'OPEN'],
  ['Reference implementation', 'Demo app, SDK, source sample, or protocol trace', '', 'Supplier delivery', 'Required', 'OPEN'],
];
header(ota.getRange('A4:F4')); body(ota.getRange('A5:F20')); ota.getRange('F5:F20').conditionalFormats.add('containsText', { text: 'OPEN', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
widths(ota, { A: 190, B: 390, C: 300, D: 250, E: 110, F: 110 }); ota.freezePanes.freezeRows(4);

const tests = wb.worksheets.add('Conformance Tests');
title(tests, 'Manufacturer and App Conformance Tests', 'Run against a physical production-equivalent device on iOS and Android. Record firmware version and hardware revision.', 7);
tests.getRange('A4:G22').values = [
  ['ID', 'Area', 'Test', 'Expected result', 'Owner', 'Evidence', 'Status'],
  ['T01', 'Discovery', 'Two Somnara devices are nearby', 'Both found by service UUID and shown with different Device IDs', 'Both', '', 'NOT RUN'],
  ['T02', 'Security', 'Use wrong passkey repeatedly', 'Pairing fails, attempts are rate-limited, control stays locked', 'Firmware', '', 'NOT RUN'],
  ['T03', 'Security', 'Complete correct secure bond', 'Encrypted authenticated control works after reconnect', 'Both', '', 'NOT RUN'],
  ['T04', 'Frame', 'Send valid command and checksum', 'One ACK with copied sequence', 'Firmware', '', 'NOT RUN'],
  ['T05', 'Frame', 'Repeat same sequence after lost ACK', 'Prior result returns; side effect is not repeated', 'Firmware', '', 'NOT RUN'],
  ['T06', 'Frame', 'Send invalid checksum and invalid value', 'Specific error; no partial state change', 'Firmware', '', 'NOT RUN'],
  ['T07', 'Light', 'Set brightness to 0, 1, 50, 99, and 100%', 'Device accepts and reports the same integer percentage', 'Both', '', 'NOT RUN'],
  ['T08', 'Audio', 'Preview IDs 1–25 and ID 0', 'Each ID matches Audio Map; ID 0 is silent', 'Both', '', 'NOT RUN'],
  ['T09', 'Audio', 'Set volume to 0, 1, 50, 99, and 100%', 'Device accepts and reports the same integer percentage', 'Both', '', 'NOT RUN'],
  ['T10', 'Alarm', 'Store 10 alarms with different profiles', 'All records read back exactly', 'Both', '', 'NOT RUN'],
  ['T11', 'Alarm', 'Attempt an 11th alarm', 'ALARM_LIMIT; existing alarms unchanged', 'Firmware', '', 'NOT RUN'],
  ['T12', 'Alarm', 'Disconnect phone before sunrise', 'Sunrise and sound run from local settings', 'Firmware', '', 'NOT RUN'],
  ['T13', 'Alarm', 'Set skip-next and reconnect', 'One occurrence is skipped, then flag clears', 'Firmware', '', 'NOT RUN'],
  ['T14', 'RTC', 'Power-cycle after valid time sync', 'RTC remains valid within agreed drift limit', 'Firmware', '', 'NOT RUN'],
  ['T15', 'RTC', 'Start with invalid RTC', 'CLOCK_INVALID reports; stored alarms are retained', 'Firmware', '', 'NOT RUN'],
  ['T16', 'Sync', 'Disconnect during staged alarm replacement', 'Old committed set stays active', 'Firmware', '', 'NOT RUN'],
  ['T17', 'OTA', 'Install valid signed update', 'New version boots and is readable', 'Both', '', 'NOT RUN'],
  ['T18', 'OTA', 'Interrupt, corrupt, or use wrong-hardware image', 'Safe stop or resume; current firmware remains bootable', 'Both', '', 'NOT RUN'],
];
header(tests.getRange('A4:G4')); body(tests.getRange('A5:G22')); tests.getRange('G5:G22').dataValidation = { rule: { type: 'list', values: ['NOT RUN', 'PASS', 'FAIL', 'BLOCKED'] } };
tests.getRange('G5:G22').conditionalFormats.add('containsText', { text: 'PASS', format: { fill: green, font: { bold: true, color: '#375623' } } });
tests.getRange('G5:G22').conditionalFormats.add('containsText', { text: 'FAIL', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
widths(tests, { A: 60, B: 100, C: 300, D: 390, E: 100, F: 250, G: 110 }); tests.freezePanes.freezeRows(4);

const open = wb.worksheets.add('Open Confirmations');
title(open, 'Open Confirmations Before Protocol v1.0', 'Manufacturer must answer each item in writing. Somnara will review and freeze the approved values.', 6);
open.getRange('A4:F21').values = [
  ['ID', 'Confirmation required', 'Why it matters', 'Manufacturer response', 'Somnara decision', 'Status'],
  ['C01', 'Confirm common frame length, sequence, SUM8 range, timeout, duplicate handling, and maximum payload', 'Reliable command transport', '', '', 'OPEN'],
  ['C02', 'Confirm every command opcode and exact byte layout', 'Prevents app/firmware mismatch', '', '', 'OPEN'],
  ['C03', 'Confirm all notification frames, ACK, errors, and unsolicited events', 'App cannot parse device state without this', '', '', 'OPEN'],
  ['C04', 'Confirm maximum 10 alarms and atomic staged synchronization', 'Offline alarm safety', '', '', 'OPEN'],
  ['C05', 'Confirm RTC retention, drift specification, power-loss behavior, and invalid-clock behavior', 'Alarm reliability without phone', '', '', 'OPEN'],
  ['C06', 'Map all 25 supplied audio files to Sound IDs 1–25 with names and SHA-256', 'Stable app-to-firmware audio mapping', '', '', 'OPEN'],
  ['C07', 'Confirm audio format, sample rate, volume curve, loop behavior, and simultaneous light/audio behavior', 'Consistent wake experience', '', '', 'OPEN'],
  ['C08', 'Confirm advertising service data and unique Device ID generation', 'Reliable discovery near several devices', '', '', 'OPEN'],
  ['C09', 'Confirm LE Secure Connections passkey support, pairing window, rate limit, key storage, and factory reset', 'Prevents unauthorized control', '', '', 'OPEN'],
  ['C10', 'Provide serial, hardware revision, and firmware revision reads', 'Support and OTA compatibility', '', '', 'OPEN'],
  ['C11', 'Complete every OTA requirement and provide test firmware', 'OTA is required before launch', '', '', 'OPEN'],
  ['C12', 'Provide reference app, SDK/sample code, protocol traces, or test utility', 'Reduces interpretation risk', '', '', 'OPEN'],
  ['C13', 'Provide at least two development units with production-equivalent BLE firmware', 'Multi-device and platform testing', '', '', 'OPEN'],
  ['C14', 'Confirm physical button behavior for pairing and factory reset', 'Customer recovery and ownership transfer', '', '', 'OPEN'],
  ['C15', 'Return this workbook with tracked responses and named firmware owner', 'Clear approval responsibility', '', '', 'OPEN'],
  ['C16', 'Confirm no known iOS/Android BLE chipset issues after physical testing', 'Platform release readiness', '', '', 'OPEN'],
  ['C17', 'Complete Feature Review, especially dismiss, snooze, physical controls, power recovery, diagnostics, and future capacity; brightness and volume stay fixed at 0–100%', 'Client requirement from Ric voice note dated 2026-08-13', '', '', 'OPEN'],
];
header(open.getRange('A4:F4')); body(open.getRange('A5:F21')); open.getRange('F5:F21').dataValidation = { rule: { type: 'list', values: ['OPEN', 'CONFIRMED', 'REJECTED', 'NEEDS CHANGE'] } };
open.getRange('F5:F21').conditionalFormats.add('containsText', { text: 'OPEN', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
open.getRange('F5:F21').conditionalFormats.add('containsText', { text: 'CONFIRMED', format: { fill: green, font: { bold: true, color: '#375623' } } });
widths(open, { A: 60, B: 430, C: 330, D: 360, E: 300, F: 140 }); open.freezePanes.freezeRows(4);

const check = await wb.inspect({ kind: 'table', sheetId: 'Audio Map', range: 'A4:H30', include: 'values,formulas', tableMaxRows: 30, tableMaxCols: 8, maxChars: 9000 });
console.log(check.ndjson);
const errorsScan = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' });
console.log(errorsScan.ndjson);

for (const sheet of wb.worksheets.items) {
  const preview = await wb.render({ sheetName: sheet.name, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${sheet.name.replace(/[^A-Za-z0-9]+/g, '_')}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(outputPath);
console.log(`OUTPUT=${outputPath}`);
