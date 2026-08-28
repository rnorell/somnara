import { FirmwareInspection, OtaDevice, OtaEvent, OtaSdkInfo } from 'somnara-ota';

export const BUNDLED_FIRMWARE_SHA256 = '8E6BEE05A9F7D55AF9B6AD7FCAD7742E5A05F9A22A551128E93F03104084B66D';

export type OtaSessionPhase = 'idle' | 'ready' | OtaEvent['phase'] | 'reconnecting';

export interface OtaLogEntry extends OtaEvent {}

export interface OtaSession {
  phase: OtaSessionPhase;
  progress: number;
  sdk: OtaSdkInfo | null;
  firmware: FirmwareInspection | null;
  target: OtaDevice | null;
  startedAt: string | null;
  finishedAt: string | null;
  finalVersion: string | null;
  errorCode: string | null;
  recoverableError: string | null;
  log: OtaLogEntry[];
}

export const initialOtaSession: OtaSession = {
  phase: 'idle', progress: 0, sdk: null, firmware: null, target: null,
  startedAt: null, finishedAt: null, finalVersion: null,
  errorCode: null, recoverableError: null, log: [],
};

export function validateFirmware(inspection: FirmwareInspection, expectedSha256?: string): void {
  if (!inspection.name.toLowerCase().endsWith('.ufw')) throw new Error('FIRMWARE_EXTENSION_INVALID');
  if (inspection.sizeBytes <= 0) throw new Error('FIRMWARE_EMPTY');
  if (expectedSha256 && inspection.sha256.toUpperCase() !== expectedSha256.toUpperCase()) {
    throw new Error('FIRMWARE_HASH_MISMATCH');
  }
}

export function applyOtaEvent(session: OtaSession, event: OtaEvent): OtaSession {
  const progress = Math.max(session.progress, Math.min(100, Math.max(0, event.progress)));
  const failed = event.phase === 'failed';
  return {
    ...session,
    phase: event.phase,
    progress,
    finishedAt: failed || event.phase === 'cancelled' ? event.timestamp : session.finishedAt,
    errorCode: failed ? event.code ?? 'OTA_FAILED' : null,
    recoverableError: failed && event.recoverable ? event.message ?? event.code ?? 'OTA_FAILED' : null,
    log: [...session.log, event],
  };
}

export function beginReconnection(session: OtaSession): OtaSession {
  if (session.phase !== 'restarting') throw new Error('OTA_NOT_READY_FOR_RECONNECTION');
  return { ...session, phase: 'reconnecting' };
}

export function confirmVersionReadback(session: OtaSession, version: string, timestamp = new Date().toISOString()): OtaSession {
  if (session.phase !== 'reconnecting') throw new Error('OTA_RECONNECTION_NOT_ACTIVE');
  if (!version.trim()) throw new Error('FIRMWARE_VERSION_MISSING');
  const complete: OtaEvent = { phase: 'complete', progress: 100, finalVersion: version, timestamp };
  return { ...session, phase: 'complete', progress: 100, finalVersion: version, finishedAt: timestamp, log: [...session.log, complete] };
}

export function canUseOta(enabled: boolean, production: boolean): boolean {
  return enabled && !production;
}

export function createDiagnosticReport(session: OtaSession, osName: string, osVersion: string | number): string {
  return [
    'Somnara OTA Test Report',
    `Platform: ${osName} ${osVersion}`,
    `JL OTA SDK: ${session.sdk?.sdkVersion ?? 'unknown'}`,
    `Device ID: ${session.target?.id ?? 'unknown'}`,
    `Device name: ${session.target?.name ?? 'unknown'}`,
    `Flash UUID: ${session.target?.flashUuid ?? 'unavailable'}`,
    `MAC bytes: ${session.target?.macAddress ?? 'unavailable'}`,
    `Raw identity: ${session.target?.rawIdentity ?? 'unavailable'}`,
    `Firmware: ${session.firmware?.name ?? 'unknown'}`,
    `Firmware size: ${session.firmware?.sizeBytes ?? 'unknown'}`,
    `Firmware SHA-256: ${session.firmware?.sha256 ?? 'unknown'}`,
    `Started: ${session.startedAt ?? 'not started'}`,
    `Finished: ${session.finishedAt ?? 'not finished'}`,
    `Result: ${session.phase}`,
    `Result code: ${session.errorCode ?? 'none'}`,
    `Final firmware version: ${session.finalVersion ?? 'not verified'}`,
    '',
    'Event log:',
    ...session.log.map(entry => `${entry.timestamp} | ${entry.phase} | ${entry.progress}% | ${entry.code ?? 'OK'}${entry.message ? ` | ${entry.message}` : ''}`),
  ].join('\n');
}
