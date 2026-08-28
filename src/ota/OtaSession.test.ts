import { applyOtaEvent, beginReconnection, canUseOta, confirmVersionReadback, initialOtaSession, validateFirmware } from './OtaSession';

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
    const complete = confirmVersionReadback(beginReconnection(restarting), '1.2.3+4');
    expect(complete.phase).toBe('complete');
    expect(complete.finalVersion).toBe('1.2.3+4');
  });
  it('never enables OTA in production', () => {
    expect(canUseOta(true, true)).toBe(false);
    expect(canUseOta(true, false)).toBe(true);
  });
});
