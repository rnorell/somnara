import {
  applyOtaEvent,
  approvedFirmwareFor,
  beginReconnection,
  canUseOta,
  confirmVersionReadback,
  initialOtaSession,
  validateFirmware,
} from './OtaSession';

const firmware = { uri: 'file:///update.ufw', name: 'update.ufw', sizeBytes: 10, sha256: 'ABCD', imageVersion: null, hardwareId: null };

describe('OTA session', () => {
  it('rejects a wrong checksum', () => expect(() => validateFirmware(firmware, 'DCBA')).toThrow('FIRMWARE_HASH_MISMATCH'));
  it('keeps progress monotonic and records cancellation', () => {
    const transferring = applyOtaEvent(initialOtaSession, { phase: 'transferring', progress: 50, timestamp: '2026-01-01T00:00:00Z' });
    const cancelled = applyOtaEvent(transferring, { phase: 'cancelled', progress: 40, timestamp: '2026-01-01T00:01:00Z' });
    expect(cancelled.progress).toBe(50);
    expect(cancelled.finishedAt).toBe('2026-01-01T00:01:00Z');
  });
  it('requires reconnection and version readback before completion', () => {
    const restarting = applyOtaEvent(initialOtaSession, { phase: 'restarting', progress: 100, timestamp: '2026-01-01T00:00:00Z' });
    const complete = confirmVersionReadback(beginReconnection({ ...restarting, expectedVersion: '0.0.3' }), '0.0.3+4');
    expect(complete.phase).toBe('complete');
    expect(complete.finalVersion).toBe('0.0.3+4');
  });
  it('rejects a stale or unknown version readback', () => {
    const restarting = applyOtaEvent(initialOtaSession, { phase: 'restarting', progress: 100, timestamp: '2026-01-01T00:00:00Z' });
    expect(() => confirmVersionReadback(beginReconnection({ ...restarting, expectedVersion: '0.0.3' }), '0.0.2+0'))
      .toThrow('FIRMWARE_VERSION_MISMATCH');
    expect(() => confirmVersionReadback(beginReconnection(restarting), '0.0.3+0'))
      .toThrow('EXPECTED_FIRMWARE_VERSION_MISSING');
  });
  it('maps the supplier firmware hashes to their declared versions', () => {
    expect(approvedFirmwareFor({
      ...firmware,
      name: 'somnara_0_0_3_260901_71C6.ufw',
      sha256: 'C1E4B92BC7656EC8F4AC7F2C19E12B07A82E1D708912B88B82A4450D94FA59BD',
    })?.version).toBe('0.0.3');
    expect(approvedFirmwareFor(firmware)).toBeNull();
  });
  it('never enables OTA in production', () => {
    expect(canUseOta(true, true)).toBe(false);
    expect(canUseOta(true, false)).toBe(true);
  });
});
