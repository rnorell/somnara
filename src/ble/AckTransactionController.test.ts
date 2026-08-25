import { ACK_RESULT_CODES, createAckFrame } from './AckFrame';
import { AckTransactionController, retryRequirement } from './AckTransactionController';
import { MockBleTransport } from './MockBleTransport';

const requestFrame = (sequence: number, opcode = 0x05) => new Uint8Array([0xFF, 0x04, sequence, opcode]);

async function connectedMock(): Promise<MockBleTransport> {
  const transport = new MockBleTransport();
  await transport.connect(transport.candidate.id);
  return transport;
}

describe('ACK transaction controller', () => {
  it('correlates ACKs by sequence and request opcode', async () => {
    const transport = await connectedMock();
    const errors: Error[] = [];
    const controller = new AckTransactionController(bytes => transport.writeRaw(bytes), { onProtocolError: error => errors.push(error) });
    transport.subscribe(bytes => controller.handleNotification(bytes), () => undefined);
    const pending = controller.execute(0x05, sequence => requestFrame(sequence));
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x04, resultCode: 0, detail: 0 }));
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 }));
    await expect(pending).resolves.toMatchObject({ ok: true, requestOpcode: 0x05 });
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 }));
    expect(errors).toHaveLength(2);
  });

  it.each([ACK_RESULT_CODES.INVALID_CHECKSUM, ACK_RESULT_CODES.INTERNAL_ERROR])(
    'retries result code %i once without changing its bytes',
    async resultCode => {
    const transport = await connectedMock();
    const controller = new AckTransactionController(bytes => transport.writeRaw(bytes));
    transport.subscribe(bytes => controller.handleNotification(bytes), () => undefined);
    const pending = controller.execute(0x05, sequence => requestFrame(sequence));
    await Promise.resolve();
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode, detail: 0 }));
    await Promise.resolve();
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 }));
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(transport.writtenFrames).toHaveLength(2);
    expect(transport.writtenFrames[1]).toEqual(transport.writtenFrames[0]);
  });

  it('waits before retrying BUSY and does not auto-retry future-dependent errors', async () => {
    jest.useFakeTimers();
    const transport = await connectedMock();
    const controller = new AckTransactionController(bytes => transport.writeRaw(bytes), { busyRetryDelayMs: 250 });
    transport.subscribe(bytes => controller.handleNotification(bytes), () => undefined);
    const busy = controller.execute(0x05, sequence => requestFrame(sequence));
    await Promise.resolve();
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: ACK_RESULT_CODES.BUSY, detail: 0 }));
    expect(transport.writtenFrames).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(250);
    expect(transport.writtenFrames).toHaveLength(2);
    transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: 0x05, resultCode: 0, detail: 0 }));
    await expect(busy).resolves.toMatchObject({ ok: true });
    expect(retryRequirement(ACK_RESULT_CODES.CLOCK_INVALID)).toBe('clock_sync');
    expect(retryRequirement(ACK_RESULT_CODES.SYNC_CONFLICT)).toBe('alarm_readback');
    const clockInvalid = controller.execute(0x05, sequence => requestFrame(sequence));
    transport.emitNotification(createAckFrame({ sequence: 1, requestOpcode: 0x05, resultCode: ACK_RESULT_CODES.CLOCK_INVALID, detail: 0 }));
    await expect(clockInvalid).resolves.toMatchObject({ ok: false, resultCode: ACK_RESULT_CODES.CLOCK_INVALID });
    expect(transport.writtenFrames).toHaveLength(3);
    jest.useRealTimers();
  });

  it('rejects a timeout and leaves no state to apply', async () => {
    jest.useFakeTimers();
    const transport = await connectedMock();
    const controller = new AckTransactionController(bytes => transport.writeRaw(bytes), { timeoutMs: 100 });
    const pending = controller.execute(0x05, sequence => requestFrame(sequence));
    const expectedTimeout = expect(pending).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(100);
    await expectedTimeout;
    jest.useRealTimers();
  });
});
