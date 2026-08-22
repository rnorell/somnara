import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = 'C:/Users/adver/OneDrive/Documents/somnara/outputs/019ff51a-ef33-7a13-a6f1-06956f304455/Somnara_BLE_Protocol_v0.9_for_review.xlsx';
const outputDir = 'C:/Users/adver/OneDrive/Documents/somnara/outputs/01a02475-9c29-79b1-ab21-4fc2167901e0';
const previewDir = `${outputDir}/v011_previews`;
const outputPath = `${outputDir}/Somnara_BLE_Protocol_v0.11_for_final_confirmation.xlsx`;
await fs.mkdir(previewDir, { recursive: true });

const navy = '#17324D';
const blue = '#2D6A8A';
const pale = '#EAF3F6';
const amber = '#FFF2CC';
const green = '#E2F0D9';
const red = '#FCE4D6';
const line = '#CBD5E1';
const ink = '#1F2937';
const white = '#FFFFFF';

const source = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(source);

function setCell(sheet, address, value) {
  sheet.getRange(address).values = [[value]];
}

function header(range) {
  range.format = {
    fill: blue,
    font: { bold: true, color: white },
    wrapText: true,
    verticalAlignment: 'center',
    borders: { preset: 'all', style: 'thin', color: line },
  };
}

function body(range) {
  range.format = {
    font: { color: ink },
    wrapText: true,
    verticalAlignment: 'top',
    borders: { preset: 'all', style: 'thin', color: line },
  };
}

function setWidths(sheet, widths) {
  for (const [column, pixels] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidthPx = pixels;
  }
}

// Overview: make the shared baseline and approval state explicit.
const overview = workbook.worksheets.getItem('Overview');
setCell(overview, 'A1', 'Somnara BLE Protocol v0.11');
setCell(overview, 'A2', 'FINAL CONFIRMATION DRAFT — updated from the v0.9 workbook that Jesse reviewed. Green means confirmed. Yellow means Somnara proposal. Red means manufacturer action.');
setCell(overview, 'B6', '0.11 final confirmation draft; replaces v0.9 for this review');
setCell(overview, 'B10', 'BLE bonding is supported. Somnara proposes a unique six-digit PIN per device. Jesse must confirm the exact supported method.');
setCell(overview, 'B11', 'Saved alarms run without a phone while the device clock is valid. RTC backup after power loss is approximately 1–2 days. After a longer loss, the app must reconnect and set the clock.');
setCell(overview, 'B12', 'AC695N, RCSP enabled, dual-bank OTA, UFW file, authentication required. Mobile integration details remain open.');
setCell(overview, 'D5', 'Jesse confirmed bonding support, seven configurable buttons, audio fade up to 65 seconds, MP3 rules, 32 MB audio storage, AC695N dual-bank RCSP OTA, UFW, authentication, failed-update recovery, and 1–2 day RTC backup. The final uplink frames and integration files are still required before protocol v1.0.');
setCell(overview, 'A14', 'Source basis: Somnara BLE Protocol v0.9, the manufacturer BLE demo workbook, and Jesse’s written answers received on 21 August 2026. Proposed values remain proposals until the final manufacturer workbook confirms the byte format.');
overview.getRange('D5:G10').format.fill = green;
overview.getRange('D5:G10').format.font = { bold: true, color: ink };
overview.getRange('D5:G10').format.wrapText = true;
overview.getRange('A2:G2').format = { fill: pale, font: { color: ink, italic: true }, wrapText: true, rowHeight: 38, verticalAlignment: 'center' };

// GATT and command sheets: retain the v0.9 proposals and state what is still missing.
const gatt = workbook.worksheets.getItem('GATT and Discovery');
setCell(gatt, 'G7', 'UUID confirmed; final uplink payload required');
setCell(gatt, 'D6', 'Encrypted + authenticated after bonding method confirmation');
setCell(gatt, 'D7', 'Encrypted + authenticated after bonding method confirmation');

const frame = workbook.worksheets.getItem('Frame Format');
setCell(frame, 'A2', 'Somnara proposal from v0.9. Jesse’s updated workbook must confirm length, checksum, sequence, timeout, retry, duplicate handling, and maximum payload.');

const commands = workbook.worksheets.getItem('Commands');
setCell(commands, 'A2', 'Required app behavior from v0.9. Do not implement customer commands until Jesse provides the final opcode and byte tables.');
setCell(commands, 'H17', 'Deferred; not in release 1');

const alarm = workbook.worksheets.getItem('Alarm Record');
setCell(alarm, 'A2', 'Required alarm profile: slot 0–9, sunrise 15/30/45 minutes, final brightness 0–100, Sound ID 0–25, and volume 0–100. Final bytes and readback frames are still required.');
setCell(alarm, 'E10', 'bit0 enabled; bits1–7 reserved');
setCell(alarm, 'F10', 'Alarm enabled state');
setCell(alarm, 'H10', 'Release 1 requirement');
setCell(alarm, 'F18', 'Reserved. Do not assign fade bytes until Jesse confirms the final record.');
setCell(alarm, 'H18', 'Deferred');
setCell(alarm, 'A24', 'Disconnect — Alarms, sunrise, audio, volume, and RTC continue locally after Bluetooth disconnect.');

// Audio: record confirmed limits and make Jesse’s remaining work small.
const audio = workbook.worksheets.getItem('Audio Map');
setCell(audio, 'A2', 'CONFIRMED RULES — MP3; 8/11.025/12/16/22.05/24/32/44.1/48 kHz; 32 MB total; FAT-safe names. Jesse only needs to provide the stable ID-to-file map and loop behavior.');
for (let row = 6; row <= 30; row += 1) {
  setCell(audio, `B${row}`, 'Somnara will define after file review');
  setCell(audio, `C${row}`, '');
  setCell(audio, `D${row}`, null);
  setCell(audio, `E${row}`, 'MP3; use one confirmed sample rate');
  setCell(audio, `F${row}`, 'Somnara will calculate');
  setCell(audio, `G${row}`, 'Please confirm');
  setCell(audio, `H${row}`, 'Jesse: filename + loop');
}
audio.getRange('H6:H30').dataValidation = { rule: { type: 'list', values: ['Jesse: filename + loop', 'Confirmed by manufacturer', 'File mismatch'] } };
audio.getRange('H6:H30').conditionalFormats.deleteAll();
audio.getRange('H6:H30').conditionalFormats.add('containsText', { text: 'Jesse:', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
audio.getRange('H6:H30').conditionalFormats.add('containsText', { text: 'Confirmed', format: { fill: green, font: { bold: true, color: '#375623' } } });

const notifications = workbook.worksheets.getItem('Notifications');
setCell(notifications, 'A2', 'Jesse confirmed that the firmware and workbook are being updated. The final ACK, error, status, clock, alarm, audio, OTA, and unsolicited-event frames are still required.');
setCell(notifications, 'H14', 'Proposed; final button map required');

const errors = workbook.worksheets.getItem('Error Codes');
setCell(errors, 'A2', 'Somnara labels from v0.9. Jesse’s final uplink table must confirm the numeric result codes and device behavior.');

// Security: separate the confirmed capability from the proposed PIN policy.
const security = workbook.worksheets.getItem('Security and Pairing');
setCell(security, 'A1', 'Pairing, Bonding, and Ownership');
setCell(security, 'A2', 'CONFIRMED — bonding can be implemented. SOMNARA PROPOSAL — use one unique six-digit PIN per device. Jesse must confirm the supported method and reset behavior.');
security.getRange('A4:F14').values = [
  ['Stage', 'Confirmed or proposed device behavior', 'App behavior', 'Required control', 'Remaining question', 'Status'],
  ['Factory state', 'Control stays locked until secure setup', 'Scan by service UUID', 'No customer command before secure setup', 'Confirm default advertising and access state', 'JESSE ACTION'],
  ['Pairing entry', 'Seven buttons are available and firmware behavior can change', 'Guide the customer after the button map is approved', 'Physical pairing action', 'Send button labels/order and supported press types', 'JESSE ACTION'],
  ['PIN method', 'Bonding is supported', 'Enter or scan the device PIN', 'Somnara proposes a unique six-digit PIN per device', 'Confirm support or recommend the safest supported method', 'PARTIAL'],
  ['PIN location', 'Somnara proposal: label and QR code on the device or packaging', 'Scan QR or enter six digits', 'No shared production PIN', 'Confirm manufacturing and firmware support', 'JESSE ACTION'],
  ['Bond storage', 'Store bond keys in protected non-volatile memory', 'Use the OS bond store', 'Bond survives normal restart', 'Confirm capacity and persistence', 'JESSE ACTION'],
  ['Failed attempts', 'Delay repeated failed attempts', 'Show retry time', 'Do not reduce security automatically', 'Confirm threshold and delay', 'JESSE ACTION'],
  ['Factory reset', 'Clear bonds and settings after a confirmed physical action', 'Require a new secure setup', 'Prevent remote ownership takeover', 'Confirm gesture, feedback, and cleared data', 'JESSE ACTION'],
  ['Cloud ownership', 'BLE bonding does not change account ownership', 'Cloud claim remains separate', 'Activation code and BLE PIN stay separate', 'No manufacturer action', 'SOMNARA RULE'],
  ['Logging', 'Do not expose the PIN or activation code', 'Redact credentials', 'No secrets in logs', 'Confirm firmware logs do not expose the PIN', 'JESSE ACTION'],
  ['Approval', 'Do not freeze the PIN flow until the method is confirmed', 'Production cannot fake device verification', 'Physical BLE test is required', 'Return the confirmed method in the workbook', 'JESSE ACTION'],
];
header(security.getRange('A4:F4'));
body(security.getRange('A5:F14'));
security.getRange('F5:F14').dataValidation = { rule: { type: 'list', values: ['CONFIRMED', 'PARTIAL', 'JESSE ACTION', 'SOMNARA RULE'] } };
security.getRange('F5:F14').conditionalFormats.deleteAll();
security.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'CONFIRMED', format: { fill: green, font: { bold: true, color: '#375623' } } });
security.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'PARTIAL', format: { fill: amber, font: { bold: true, color: '#7F6000' } } });
security.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'JESSE ACTION', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
security.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'SOMNARA RULE', format: { fill: pale, font: { bold: true, color: navy } } });
setWidths(security, { A: 145, B: 320, C: 270, D: 290, E: 310, F: 125 });

// Feature review: place the new confirmations in the relevant rows.
const features = workbook.worksheets.getItem('Feature Review');
setCell(features, 'A2', 'Updated with Jesse’s answers. Confirmed capability does not define the final byte field or button gesture.');
setCell(features, 'C11', 'Audio fade-in and fade-out are supported. Maximum duration is 65 seconds. Confirm minimum, step, scope, and whether both directions are set separately.');
setCell(features, 'E11', 'SUPPORTED NOW — maximum 65 seconds');
setCell(features, 'F11', 'Final parameters and byte fields required');
setCell(features, 'G11', 'PARTIAL');
setCell(features, 'C16', 'MP3 and storage rules are confirmed. Provide the final 25-file map, loop behavior, and fade behavior.');
setCell(features, 'E16', 'SUPPORTED NOW — MP3, 32 MB total, fade up to 65 seconds');
setCell(features, 'F16', 'File map and final audio-state frames required');
setCell(features, 'G16', 'PARTIAL');
setCell(features, 'C17', 'Seven buttons are available. Somnara can define each function. Send the button labels/order and supported short, long, and combination press types.');
setCell(features, 'E17', 'SUPPORTED NOW — seven configurable buttons');
setCell(features, 'F17', 'Somnara will return the final mapping after the hardware reference');
setCell(features, 'G17', 'SOMNARA ACTION');
setCell(features, 'C18', 'RTC backup is approximately 1–2 days after main power loss. After a longer loss, the app must reconnect and set the clock.');
setCell(features, 'E18', 'CONFIRMED — 1–2 day RTC backup');
setCell(features, 'F18', 'Clock-valid status and invalid-clock behavior still required');
setCell(features, 'G18', 'PARTIAL');
setCell(features, 'G7', 'DEFERRED');
setCell(features, 'G8', 'DEFERRED');
setCell(features, 'G9', 'COVERED BY FINAL SHEET');
setCell(features, 'G10', 'COVERED BY FINAL SHEET');
setCell(features, 'G12', 'COVERED BY FINAL SHEET');
setCell(features, 'G13', 'DEFERRED');
setCell(features, 'G14', 'DEFERRED');
setCell(features, 'G15', 'DEFERRED');
setCell(features, 'G19', 'COVERED BY FINAL SHEET');
setCell(features, 'G20', 'COVERED BY FINAL SHEET');
setCell(features, 'G21', 'COVERED BY FINAL SHEET');
setCell(features, 'G22', 'COVERED BY FINAL SHEET');
setCell(features, 'G23', 'DEFERRED');
features.getRange('G5:G23').dataValidation = { rule: { type: 'list', values: ['CONFIRMED', 'PARTIAL', 'SOMNARA ACTION', 'IN v1.0', 'COVERED BY FINAL SHEET', 'DEFERRED'] } };

// OTA: record all confirmed facts and isolate the integration package that is still needed.
const ota = workbook.worksheets.getItem('OTA Requirements');
setCell(ota, 'A1', 'BLE OTA — Final Integration Confirmation');
setCell(ota, 'A2', 'CONFIRMED — AC695N, RCSP enabled, dual-bank, UFW, authentication required. Jesse must provide the exact mobile integration and test package.');
ota.getRange('A4:F20').values = [
  ['Requirement', 'Required result', 'Manufacturer value', 'Evidence / file', 'Release gate', 'Status'],
  ['Chip model', 'Production OTA target', 'JieLi AC695N', 'Jesse reply, 21 August 2026', 'Required', 'CONFIRMED'],
  ['RCSP support', 'Enabled in production firmware', 'Yes', 'Jesse reply', 'Required', 'CONFIRMED'],
  ['OTA mode', 'Safe update mode', 'Dual-bank', 'Jesse reply', 'Required', 'CONFIRMED'],
  ['Firmware file', 'App update input', 'UFW', 'Jesse reply', 'Required', 'CONFIRMED'],
  ['SDK support', 'Provide one tested mobile package and exact version', 'Jesse stated that all versions are supported', 'RCSP SDK package + version', 'Required', 'JESSE ACTION'],
  ['OTA GATT', 'Service and characteristic UUIDs with roles', '', 'GATT capture or protocol table', 'Required', 'JESSE ACTION'],
  ['Mobile example', 'iOS and Android integration reference', '', 'Demo app, source sample, or trace', 'Required', 'JESSE ACTION'],
  ['Authentication', 'State the exact authentication method and credentials', 'Authentication is required', 'Method, credential source, and failure codes', 'Required', 'PARTIAL'],
  ['Image signing', 'State signature check, signing tool, and key owner', '', 'Signed and invalid sample UFW files', 'Required', 'JESSE ACTION'],
  ['Transfer rules', 'MTU, chunk size, offset, ACK, retry, resume, and timeout', '', 'Protocol table and interrupted test', 'Required', 'JESSE ACTION'],
  ['Progress and errors', 'Stable states, percentage, and result codes', '', 'Notification frames', 'Required', 'JESSE ACTION'],
  ['Compatibility reads', 'Read hardware and firmware versions before update', '', 'GATT values or command frames', 'Required', 'JESSE ACTION'],
  ['Failed update', 'Current device use remains safe; retry is possible', 'A failed upgrade does not affect normal use. Power-cycle the device, then retry later.', 'Jesse reply; physical test still required', 'Required', 'PARTIAL'],
  ['Post-update connection', 'Define reboot, bond retention, and app state', 'Jesse stated that reconnection is not required with dual-bank OTA', 'Clarify the exact app and BLE sequence', 'Required', 'PARTIAL'],
  ['Test package', 'Provide sample UFW, expected hash, release notes, and rollback test image', '', 'Supplier delivery', 'Required', 'JESSE ACTION'],
  ['Recovery evidence', 'Show successful, interrupted, corrupt-image, and power-loss results', '', 'Test report or trace', 'Required', 'JESSE ACTION'],
];
header(ota.getRange('A4:F4'));
body(ota.getRange('A5:F20'));
ota.getRange('F5:F20').dataValidation = { rule: { type: 'list', values: ['CONFIRMED', 'PARTIAL', 'JESSE ACTION'] } };
ota.getRange('F5:F20').conditionalFormats.deleteAll();
ota.getRange('F5:F20').conditionalFormats.add('containsText', { text: 'CONFIRMED', format: { fill: green, font: { bold: true, color: '#375623' } } });
ota.getRange('F5:F20').conditionalFormats.add('containsText', { text: 'PARTIAL', format: { fill: amber, font: { bold: true, color: '#7F6000' } } });
ota.getRange('F5:F20').conditionalFormats.add('containsText', { text: 'JESSE ACTION', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
setWidths(ota, { A: 180, B: 360, C: 330, D: 300, E: 105, F: 125 });

// Conformance tests remain tests, not confirmations.
const tests = workbook.worksheets.getItem('Conformance Tests');
setCell(tests, 'A2', 'Run after the final workbook and firmware are available. A written answer is not physical BLE proof.');
setCell(tests, 'C17', 'Skip-next is deferred');
setCell(tests, 'D17', 'Not in release 1; no firmware or app test in this phase');

// Final action sheet: reduce Jesse’s work to twelve precise items.
const open = workbook.worksheets.getItem('Open Confirmations');
setCell(open, 'A1', 'Final Confirmations Before Protocol v1.0');
setCell(open, 'A2', 'Please edit only the Manufacturer response and Status columns. Confirmed answers are already entered in the related sheets.');
open.getRange('A4:F21').clear({ applyTo: 'contents' });
open.getRange('A4:F16').values = [
  ['ID', 'Final item', 'What Somnara already knows', 'Manufacturer response', 'Somnara decision', 'Status'],
  ['F01', 'Provide the final MCU-to-app frames for ACK, errors, device status, clock validity, alarm records, audio state, OTA progress, and unsolicited events.', 'Firmware and workbook update are in progress. Jesse expected completion on Tuesday or Wednesday.', '', 'Wait for the updated manufacturer workbook.', 'AWAITING WORKBOOK'],
  ['F02', 'Confirm the common frame rules: length, sequence, checksum range, byte order, timeout, retry, duplicate handling, and maximum payload.', 'v0.9 contains Somnara proposals.', '', 'Use the manufacturer values in the parser.', 'JESSE ACTION'],
  ['F03', 'Confirm every final command opcode and alarm-record byte, including readback and commit behavior.', 'App profile: slots 0–9; sunrise 15/30/45; brightness 0–100; Sound ID 0–25; volume 0–100.', '', 'Do not send customer commands until readback is available.', 'JESSE ACTION'],
  ['F04', 'Confirm the bonding method. Somnara proposes one unique six-digit PIN per device, shown on a label and QR code. Confirm bond storage, failed-attempt limits, and factory-reset bond removal.', 'Bonding can be implemented.', '', 'Proposal only until Jesse confirms support.', 'PARTIAL'],
  ['F05', 'Send a labeled photo or list of the seven button positions. State whether short, long, and combination presses are supported.', 'All seven button functions can be defined by Somnara.', '', 'Somnara will return the final button map. Do not select functions yet.', 'SOMNARA ACTION'],
  ['F06', 'Confirm fade details: minimum time, time step, independent fade-in/fade-out, per-alarm or global setting, and which audio modes use fade.', 'Audio fade-in and fade-out are supported. Maximum duration is 65 seconds.', '', 'Reserve byte fields until the final answer.', 'PARTIAL'],
  ['F07', 'Provide the final 25-file package or a stable Sound ID-to-filename map. Confirm loop behavior for each file.', 'MP3 rates, FAT-safe names, and 32 MB total storage are confirmed. Somnara will calculate hashes and define customer names.', '', 'Sound ID 0 remains No sound.', 'JESSE ACTION'],
  ['F08', 'Provide clock-valid and clock-invalid frames, RTC drift specification, and exact device behavior when the clock is invalid.', 'RTC backup after power loss is approximately 1–2 days. The app must reconnect and set the clock after a longer loss.', '', 'The app will warn the customer. It will not claim device alarm save without readback.', 'JESSE ACTION'],
  ['F09', 'Provide the tested RCSP mobile SDK package/version, OTA UUIDs, transfer rules, progress/error frames, and a sample UFW file.', 'AC695N, RCSP enabled, dual-bank, UFW, and authentication are confirmed.', '', 'OTA stays disabled in production until physical validation passes.', 'JESSE ACTION'],
  ['F10', 'Explain OTA authentication and signing. State the signing tool, key owner, invalid-image result, and recovery sequence.', 'Authentication is required. Failed OTA does not affect normal use; power-cycle and retry are possible.', '', 'Do not infer security from dual-bank mode.', 'PARTIAL'],
  ['F11', 'Clarify “reconnection is not required.” Confirm reboot behavior, bond retention, notification resubscription, and how the app verifies the new version.', 'Jesse stated that reconnection is not required with dual-bank OTA.', '', 'The app will verify hardware and firmware versions after OTA.', 'PARTIAL'],
  ['F12', 'Provide serial number, hardware revision, firmware revision, unique advertising identity, and a named firmware contact for final review.', 'AE30 service, AE01 write, and AE02 notify are the current transport identifiers.', '', 'Required for support, compatibility, and physical tests.', 'JESSE ACTION'],
];
header(open.getRange('A4:F4'));
body(open.getRange('A5:F16'));
open.getRange('A17:F21').format.fill = '#FFFFFF';
open.getRange('A17:F21').format.borders = { preset: 'none' };
open.getRange('F5:F16').dataValidation = { rule: { type: 'list', values: ['CONFIRMED', 'PARTIAL', 'JESSE ACTION', 'SOMNARA ACTION', 'AWAITING WORKBOOK'] } };
open.getRange('F5:F16').conditionalFormats.deleteAll();
open.getRange('F5:F16').conditionalFormats.add('containsText', { text: 'CONFIRMED', format: { fill: green, font: { bold: true, color: '#375623' } } });
open.getRange('F5:F16').conditionalFormats.add('containsText', { text: 'PARTIAL', format: { fill: amber, font: { bold: true, color: '#7F6000' } } });
open.getRange('F5:F16').conditionalFormats.add('containsText', { text: 'JESSE ACTION', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
open.getRange('F5:F16').conditionalFormats.add('containsText', { text: 'SOMNARA ACTION', format: { fill: pale, font: { bold: true, color: navy } } });
open.getRange('F5:F16').conditionalFormats.add('containsText', { text: 'AWAITING', format: { fill: red, font: { bold: true, color: '#9C0006' } } });
open.getRange('F17:F21').dataValidation = null;
setWidths(open, { A: 55, B: 440, C: 360, D: 380, E: 330, F: 145 });
open.freezePanes.freezeRows(4);

// Keep the source style and improve row heights only where the new copy wraps.
for (const sheet of workbook.worksheets.items) {
  sheet.showGridLines = false;
  const used = sheet.getUsedRange();
  used.format.wrapText = true;
  used.format.autofitRows();
}
overview.getRange('D5:G10').format.rowHeight = 28;
overview.getRange('A10:B10').format.rowHeight = 58;
overview.getRange('A11:B11').format.rowHeight = 74;
open.getRange('A5:F16').format.rowHeight = 72;
open.getRange('A17:F21').format.rowHeight = 3;
ota.getRange('A5:F20').format.rowHeight = 50;
security.getRange('A5:F14').format.rowHeight = 54;
audio.getRange('A6:H30').format.rowHeight = 34;

const keyCheck = await workbook.inspect({
  kind: 'table',
  sheetId: 'Open Confirmations',
  range: 'A4:F16',
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 6,
  maxChars: 16000,
});
console.log(keyCheck.ndjson);

const otaCheck = await workbook.inspect({
  kind: 'table',
  sheetId: 'OTA Requirements',
  range: 'A4:F20',
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 6,
  maxChars: 12000,
});
console.log(otaCheck.ndjson);

const errorScan = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'formula error scan',
});
console.log(errorScan.ndjson);

for (const sheet of workbook.worksheets.items) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: 'all', scale: 1, format: 'png' });
  const safeName = sheet.name.replace(/[^A-Za-z0-9]+/g, '_');
  await fs.writeFile(`${previewDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);
