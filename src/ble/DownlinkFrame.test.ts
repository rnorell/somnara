import { sum8 } from './AckFrame';
import {
  createSkipNextAlarmFrame,
  SKIP_NEXT_ALARM_FRAME_LENGTH,
  SKIP_NEXT_ALARM_OPCODE,
} from './DownlinkFrame';

describe('confirmed app-to-device frames', () => {
  it('creates the confirmed Skip Next 0x1C frame', () => {
    const frame = createSkipNextAlarmFrame({ sequence: 0x2A, alarmIndex: 4, skip: true });
    expect(frame).toEqual(new Uint8Array([0xFF, 0x07, 0x2A, 0x1C, 0x04, 0x01, 0x51]));
    expect(frame[1]).toBe(SKIP_NEXT_ALARM_FRAME_LENGTH);
    expect(frame[3]).toBe(SKIP_NEXT_ALARM_OPCODE);
    expect(frame[6]).toBe(sum8(frame.slice(0, 6)));
  });

  it('creates the clear-skip variant', () => {
    expect(createSkipNextAlarmFrame({ sequence: 0, alarmIndex: 9, skip: false }))
      .toEqual(new Uint8Array([0xFF, 0x07, 0x00, 0x1C, 0x09, 0x00, 0x2B]));
  });

  it.each([
    [{ sequence: -1, alarmIndex: 0, skip: true }, 'Sequence'],
    [{ sequence: 0xFF, alarmIndex: 0, skip: true }, 'Sequence'],
    [{ sequence: 0, alarmIndex: -1, skip: true }, 'Alarm index'],
    [{ sequence: 0, alarmIndex: 10, skip: true }, 'Alarm index'],
  ])('rejects invalid Skip Next input', (input, field) => {
    expect(() => createSkipNextAlarmFrame(input)).toThrow(field);
  });
});
