import {
  ACK_RESULT_CODES,
  ACK_FRAME_LENGTH,
  BleProtocolError,
  createAckFrame,
  parseAckFrame,
} from './AckFrame';

describe('ACK frame protocol', () => {
  it.each(Object.entries(ACK_RESULT_CODES))('parses %s (%i)', (resultName, resultCode) => {
    const result = parseAckFrame(createAckFrame({
      sequence: 42,
      requestOpcode: 0x13,
      resultCode,
      detail: 0,
    }));
    expect(result).toMatchObject({ sequence: 42, requestOpcode: 0x13, resultCode, resultName });
    expect(result.ok).toBe(resultCode === ACK_RESULT_CODES.OK);
  });

  it('creates a complete valid eight-byte ACK', () => {
    const frame = createAckFrame({ sequence: 42, requestOpcode: 0x05, resultCode: 0, detail: 0 });
    expect(frame).toHaveLength(ACK_FRAME_LENGTH);
    expect([...frame]).toEqual([0xFF, 0x08, 0x2A, 0x7F, 0x05, 0x00, 0x00, 0xB5]);
  });

  it.each([
    ['wrong length', new Uint8Array([0xFF])],
    ['wrong header', new Uint8Array([0x00, 0x08, 1, 0x7F, 5, 0, 0, 0])],
    ['unsolicited sequence', createAckFrame({ sequence: 0xFF, requestOpcode: 5, resultCode: 0, detail: 0 })],
    ['wrong opcode', new Uint8Array([0xFF, 0x08, 1, 0x13, 5, 0, 0, 0])],
    ['unknown result', createAckFrame({ sequence: 1, requestOpcode: 5, resultCode: 14, detail: 0 })],
  ])('rejects %s', (_label, frame) => {
    expect(() => parseAckFrame(frame)).toThrow(BleProtocolError);
  });

  it('rejects an invalid checksum', () => {
    const frame = createAckFrame({ sequence: 1, requestOpcode: 5, resultCode: 0, detail: 0 });
    frame[7] ^= 0x01;
    expect(() => parseAckFrame(frame)).toThrow('checksum');
  });
});
