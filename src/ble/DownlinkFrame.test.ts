import { sum8 } from './AckFrame';
import {
  createSkipNextAlarmFrame,
  SKIP_NEXT_ALARM_FRAME_LENGTH,
  SKIP_NEXT_ALARM_OPCODE,
  AUDIO_CONTROL_OPCODE,
  createAudioControlFrame,
  createSetVolumeFrame,
  SET_VOLUME_FRAME_LENGTH,
  SET_VOLUME_OPCODE,
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

describe('audio frames', () => {
  it('creates an Audio Control 0x09 preview frame', () => {
    // FF 08 05 09 01 03 32 → 255+8+5+9+1+3+50 = 331 → 0x4B
    expect(createAudioControlFrame({ sequence: 5, action: 'preview', soundId: 3, volumePercent: 50 }))
      .toEqual(new Uint8Array([0xFF, 0x08, 0x05, AUDIO_CONTROL_OPCODE, 0x01, 0x03, 0x32, 0x4B]));
  });

  it('creates an Audio Control 0x09 stop frame', () => {
    expect(createAudioControlFrame({ sequence: 0, action: 'stop', soundId: 0, volumePercent: 0 }))
      .toEqual(new Uint8Array([0xFF, 0x08, 0x00, 0x09, 0x00, 0x00, 0x00, 0x10]));
  });

  it('creates a Set Volume 0x08 frame', () => {
    // FF 06 01 08 50 → 255+6+1+8+80 = 350 → 0x5E
    expect(createSetVolumeFrame({ sequence: 1, volumePercent: 80 }))
      .toEqual(new Uint8Array([0xFF, SET_VOLUME_FRAME_LENGTH, 0x01, SET_VOLUME_OPCODE, 0x50, 0x5E]));
  });

  it.each([
    [{ sequence: 0, action: 'preview' as const, soundId: 26, volumePercent: 50 }, 'Sound ID'],
    [{ sequence: 0, action: 'preview' as const, soundId: 1, volumePercent: 101 }, 'Volume'],
    [{ sequence: 0xFF, action: 'stop' as const, soundId: 0, volumePercent: 0 }, 'Sequence'],
  ])('rejects invalid audio input', (input, field) => {
    expect(() => createAudioControlFrame(input)).toThrow(field);
  });
});
