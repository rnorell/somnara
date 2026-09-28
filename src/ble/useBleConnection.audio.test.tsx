import { act, renderHook } from '@testing-library/react-native';
import { MockBleTransport } from './MockBleTransport';
import { useBleConnection } from './useBleConnection';
import { ACK_RESULT_CODES, createAckFrame, sum8 } from './AckFrame';
import { AUDIO_CONTROL_OPCODE, createAudioControlFrame, createSetVolumeFrame, SET_VOLUME_OPCODE } from './DownlinkFrame';
import { createManufacturerStatusFixture } from './manufacturerProtocolFixtures';

function statusWithSound(sequence: number, soundId: number, volume: number): Uint8Array {
  const frame = createManufacturerStatusFixture(sequence);
  frame[17] = volume;
  frame[18] = soundId;
  frame[frame.length - 1] = sum8(frame.slice(0, -1));
  return frame;
}

async function connected(transport = new MockBleTransport()) {
  const hook = await renderHook(() => useBleConnection(() => transport));
  await act(async () => { await hook.result.current.connect(); });
  return { transport, ...hook };
}

describe('useBleConnection audio commands', () => {
  it('sends Audio Control 0x09 and tracks the playing sound after ACK + status', async () => {
    const { transport, result, unmount } = await connected();

    let playing!: Promise<void>;
    await act(async () => { playing = result.current.playSound(3, 50); });
    expect(transport.writtenFrames.at(-1)).toEqual(
      createAudioControlFrame({ sequence: 0, action: 'preview', soundId: 3, volumePercent: 50 }));
    expect(result.current.commandPending).toBe(true);

    await act(async () => {
      transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: AUDIO_CONTROL_OPCODE, resultCode: 0, detail: 0 }));
      await playing;
      transport.emitNotification(statusWithSound(0, 3, 50));
    });

    expect(result.current.playingSoundId).toBe(3);
    expect(result.current.commandPending).toBe(false);
    expect(result.current.deviceStatus.activeSoundId).toBe(3);
    expect(result.current.deviceStatus.volume).toBe(50);
    await unmount();
  });

  it('stops playback with the 0x09 stop action', async () => {
    const { transport, result, unmount } = await connected();
    let stopping!: Promise<void>;
    await act(async () => { stopping = result.current.stopSound(); });
    expect(transport.writtenFrames.at(-1)).toEqual(
      createAudioControlFrame({ sequence: 0, action: 'stop', soundId: 0, volumePercent: 0 }));
    await act(async () => {
      transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: AUDIO_CONTROL_OPCODE, resultCode: 0, detail: 0 }));
      await stopping;
    });
    expect(result.current.playingSoundId).toBeNull();
    await unmount();
  });

  it('sends Set Volume 0x08', async () => {
    const { transport, result, unmount } = await connected();
    let setting!: Promise<void>;
    await act(async () => { setting = result.current.setVolume(80); });
    expect(transport.writtenFrames.at(-1)).toEqual(createSetVolumeFrame({ sequence: 0, volumePercent: 80 }));
    await act(async () => {
      transport.emitNotification(createAckFrame({ sequence: 0, requestOpcode: SET_VOLUME_OPCODE, resultCode: 0, detail: 0 }));
      await setting;
    });
    await unmount();
  });

  it('surfaces AUDIO_NOT_FOUND as a readable error and does not mark the sound playing', async () => {
    const { transport, result, unmount } = await connected();
    let playing!: Promise<void>;
    await act(async () => { playing = result.current.playSound(7, 40); });
    let failure: unknown;
    await act(async () => {
      transport.emitNotification(createAckFrame({
        sequence: 0, requestOpcode: AUDIO_CONTROL_OPCODE, resultCode: ACK_RESULT_CODES.AUDIO_NOT_FOUND, detail: 0,
      }));
      await playing.catch(error => { failure = error; });
    });
    expect((failure as Error).message).toBe('That sound is not installed on this Somnara.');
    expect(result.current.playingSoundId).toBeNull();
    expect(result.current.commandPending).toBe(false);
    await unmount();
  });

  it('refuses audio commands before a connection exists', async () => {
    const transport = new MockBleTransport();
    const { result, unmount } = await renderHook(() => useBleConnection(() => transport));
    await expect(result.current.playSound(1, 50)).rejects.toThrow('Connect to Somnara first.');
    expect(transport.writtenFrames).toHaveLength(0);
    await unmount();
  });

  it('works end to end against the simulated demo device', async () => {
    const { result, unmount } = await connected(new MockBleTransport({ simulateDevice: true }));
    await act(async () => { await result.current.playSound(5, 60); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
    expect(result.current.playingSoundId).toBe(5);
    expect(result.current.deviceStatus.activeSoundId).toBe(5);
    expect(result.current.deviceStatus.volume).toBe(60);
    await unmount();
  });
});
