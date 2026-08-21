import { MockBleTransport } from './MockBleTransport';

describe('MockBleTransport', () => {
  it('follows the deterministic scan and connection flow', async () => {
    const transport = new MockBleTransport();
    expect(await transport.requestPermissions()).toBe(true);
    const candidate = await transport.scan();
    expect(candidate.id).toBe('mock-somnara-001');
    await transport.connect(candidate.id);
    expect(() => transport.subscribe(() => undefined, () => undefined)).not.toThrow();
    await expect(transport.writeRaw(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    await transport.disconnect();
    await expect(transport.writeRaw(new Uint8Array([1]))).rejects.toThrow('not connected');
  });

  it('rejects work after destroy', async () => {
    const transport = new MockBleTransport();
    await transport.destroy();
    await expect(transport.scan()).rejects.toThrow('closed');
  });
});
