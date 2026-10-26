import { BleDeviceCandidate, BleTransport, BleTransportError } from './types';
import { ACK_RESULT_CODES, createAckFrame, sum8, UNSOLICITED_SEQUENCE } from './AckFrame';
import {
  ALARM_SYNC_FRAME_LENGTH,
  AUDIO_CONTROL_OPCODE,
  BEGIN_ALARM_SYNC_OPCODE,
  COMMIT_ALARM_SYNC_OPCODE,
  DELETE_ALARM_FRAME_LENGTH,
  DELETE_ALARM_OPCODE,
  GET_STATUS_OPCODE,
  READ_ALARMS_FRAME_LENGTH,
  READ_ALARMS_OPCODE,
  SET_BRIGHTNESS_OPCODE,
  SET_CLOCK_OPCODE,
  SET_COLOUR_TEMPERATURE_OPCODE,
  SET_POWER_OPCODE,
  SET_VOLUME_OPCODE,
  SKIP_NEXT_ALARM_FRAME_LENGTH,
  SKIP_NEXT_ALARM_OPCODE,
  UPSERT_ALARM_FRAME_LENGTH,
  UPSERT_ALARM_OPCODE,
} from './DownlinkFrame';
import { brightnessToInverseRaw } from '../models/BleProtocol';
import { createManufacturerStatusFixture } from './manufacturerProtocolFixtures';
import { ALARM_LIST_LENGTH, ALARM_SLOT_LENGTH } from './UplinkFrame';

export interface MockBleTransportOptions {
  /** Answer writes with ACK + 0x13 status like the real device (dev demo mode). */
  readonly simulateDevice?: boolean;
  /** Real phone radio check. The fake device is returned only after this resolves. */
  readonly prepareRadio?: () => Promise<void>;
  /** While connected, report a dropped phone radio. The returned function stops the watch. */
  readonly watchRadio?: (onLost: (error: Error) => void) => () => void;
}

export class MockBleTransport implements BleTransport {
  readonly kind = 'mock' as const;
  readonly syncsClockOnConnect: boolean;
  readonly candidate: BleDeviceCandidate = { id: 'mock-somnara-001', name: 'Somnara Development Device' };
  private connected = false;
  private destroyed = false;
  readonly writtenFrames: Uint8Array[] = [];
  negotiatedMtu = 247;
  private onData: ((bytes: Uint8Array) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private sessionError: ((error: Error) => void) | null = null;
  private queuedLoss: Error | null = null;
  private stopRadioWatch: (() => void) | null = null;
  private powerOn = true;
  private brightness = 60;
  private white = 100;
  private warmWhite = 0;
  private simulatedVolume = 30;
  private simulatedSoundId = 0;
  private clockValid = true;
  private responsePending = false;
  private revision = 0;
  private readonly committed = new Map<number, StoredAlarm>();
  private stage: AlarmStage | null = null;

  constructor(private readonly options: MockBleTransportOptions = {}) {
    this.syncsClockOnConnect = options.simulateDevice === true;
  }

  private async ensureRadio(): Promise<void> {
    this.assertActive();
    await this.options.prepareRadio?.();
  }

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async scan(_timeoutMs?: number): Promise<BleDeviceCandidate> {
    this.assertActive();
    await Promise.resolve();
    return this.candidate;
  }

  async discover(): Promise<BleDeviceCandidate[]> {
    await this.ensureRadio();
    return [await this.scan()];
  }

  async connect(deviceId: string): Promise<void> {
    this.assertActive();
    await this.ensureRadio();
    if (deviceId !== this.candidate.id) {
      throw new BleTransportError('connection_failed', 'The mock device was not found.');
    }
    this.connected = true;
    this.queuedLoss = null;
    this.beginRadioWatch();
    const loss = this.takeQueuedLoss();
    if (loss) {
      this.connected = false;
      this.stopWatchingLink();
      throw loss;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stage = null;
    this.stopWatchingLink();
  }

  async negotiateMtu(minimumMtu: number): Promise<number> {
    this.assertConnected();
    if (this.negotiatedMtu < minimumMtu) {
      throw new BleTransportError(
        'mtu_negotiation_failed',
        `Somnara requires an MTU of at least ${minimumMtu} bytes. The device supplied ${this.negotiatedMtu}.`,
      );
    }
    return this.negotiatedMtu;
  }

  subscribe(onData: (bytes: Uint8Array) => void, onError: (error: Error) => void): () => void {
    this.assertActive();
    const loss = this.takeQueuedLoss();
    if (loss) {
      this.connected = false;
      onError(loss);
      return () => undefined;
    }
    this.assertConnected();
    this.onData = onData;
    this.onError = onError;
    this.sessionError = onError;
    if (this.options.simulateDevice) this.later(() => this.simulatedStatus(UNSOLICITED_SEQUENCE));
    return () => {
      this.onData = null;
      this.onError = null;
      this.sessionError = null;
    };
  }

  emitNotification(bytes: Uint8Array): void {
    this.assertConnected();
    this.onData?.(new Uint8Array(bytes));
  }

  emitError(error: Error): void {
    this.assertConnected();
    this.onError?.(error);
  }

  async writeRaw(bytes: Uint8Array): Promise<void> {
    this.assertConnected();
    this.writtenFrames.push(new Uint8Array(bytes));
    if (this.options.simulateDevice) this.simulateResponse(bytes);
  }

  private simulateResponse(frame: Uint8Array): void {
    const sequence = frame[2] ?? 0;
    const opcode = frame[3] ?? 0;
    if (this.responsePending) {
      this.reply(sequence, opcode, ACK_RESULT_CODES.BUSY, false);
      return;
    }
    const resultCode = this.applyCommand(frame);
    if (this.isAlarmOpcode(opcode)) this.replyAlarm(frame, resultCode);
    else this.reply(sequence, opcode, resultCode, resultCode === ACK_RESULT_CODES.OK);
  }

  private applyCommand(frame: Uint8Array): number {
    if (frame.length < 4 || frame[1] !== frame.length) return ACK_RESULT_CODES.INVALID_LENGTH;
    if (sum8(frame.slice(0, -1)) !== frame[frame.length - 1]) return ACK_RESULT_CODES.INVALID_CHECKSUM;
    const opcode = frame[3];
    if (opcode === SET_POWER_OPCODE) {
      if (frame[4] !== 1 && frame[4] !== 2) return ACK_RESULT_CODES.INVALID_VALUE;
      this.powerOn = frame[4] === 1;
    } else if (opcode === SET_BRIGHTNESS_OPCODE) {
      if (!this.validPercent(frame[4]) || frame[5] !== brightnessToInverseRaw(frame[4])) return ACK_RESULT_CODES.INVALID_VALUE;
      this.brightness = frame[4];
    } else if (opcode === SET_COLOUR_TEMPERATURE_OPCODE) {
      if (frame[4] !== 1 || frame[5] !== 3 || !this.knownInverse(frame[8])) return ACK_RESULT_CODES.INVALID_VALUE;
      this.white = frame[6];
      this.warmWhite = frame[7];
      this.brightness = this.percentForInverse(frame[8]);
    } else if (opcode === SET_VOLUME_OPCODE) {
      if (!this.validPercent(frame[4])) return ACK_RESULT_CODES.INVALID_VALUE;
      this.simulatedVolume = frame[4];
    } else if (opcode === AUDIO_CONTROL_OPCODE) {
      const [action, soundId, volume] = [frame[4], frame[5], frame[6]];
      if ((action !== 0 && action !== 1) || !this.validPercent(volume)) return ACK_RESULT_CODES.INVALID_VALUE;
      if (action === 1 && (soundId < 1 || soundId > 25)) return soundId === 0 ? ACK_RESULT_CODES.INVALID_VALUE : ACK_RESULT_CODES.AUDIO_NOT_FOUND;
      this.simulatedSoundId = action === 1 ? soundId : 0;
      if (action === 1) this.simulatedVolume = volume;
    } else if (opcode === GET_STATUS_OPCODE) {
      if (frame[5] !== 0xAA) return ACK_RESULT_CODES.INVALID_VALUE;
    } else if (opcode === SET_CLOCK_OPCODE) {
      const [month, day, hour, minute, second, weekday] = [frame[5], frame[6], frame[7], frame[8], frame[9], frame[10]];
      const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59 && second <= 59 && weekday >= 1 && weekday <= 7;
      if (!valid) return ACK_RESULT_CODES.INVALID_VALUE;
      this.clockValid = true;
    } else if (this.isAlarmOpcode(opcode)) {
      return this.applyAlarm(frame);
    } else {
      return ACK_RESULT_CODES.UNKNOWN_OPCODE;
    }
    return ACK_RESULT_CODES.OK;
  }

  private applyAlarm(frame: Uint8Array): number {
    const opcode = frame[3];
    if (opcode === READ_ALARMS_OPCODE) {
      if (frame.length !== READ_ALARMS_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
      if (frame[5] !== 0xAA) return ACK_RESULT_CODES.INVALID_VALUE;
      return ACK_RESULT_CODES.OK;
    }
    if (!this.clockValid) return ACK_RESULT_CODES.CLOCK_INVALID;
    if (opcode === UPSERT_ALARM_OPCODE) return this.upsertAlarm(frame);
    if (opcode === BEGIN_ALARM_SYNC_OPCODE) return this.beginAlarmSync(frame);
    if (opcode === COMMIT_ALARM_SYNC_OPCODE) return this.commitAlarmSync(frame);
    if (opcode === DELETE_ALARM_OPCODE) return this.deleteAlarm(frame);
    return this.skipAlarm(frame);
  }

  private upsertAlarm(frame: Uint8Array): number {
    const alarm = this.readAlarm(frame);
    if (typeof alarm === 'number') return alarm;
    const target = this.stage?.slots ?? this.committed;
    if (!target.has(alarm.index) && target.size >= 10) return ACK_RESULT_CODES.ALARM_LIMIT;
    target.set(alarm.index, alarm);
    return ACK_RESULT_CODES.OK;
  }

  private beginAlarmSync(frame: Uint8Array): number {
    if (frame.length !== ALARM_SYNC_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
    const alarmCount = frame[6];
    if (alarmCount > 10) return ACK_RESULT_CODES.ALARM_LIMIT;
    if (this.stage) return ACK_RESULT_CODES.SYNC_CONFLICT;
    this.stage = { revision: frame[4] | (frame[5] << 8), expectedCount: alarmCount, slots: new Map() };
    return ACK_RESULT_CODES.OK;
  }

  private commitAlarmSync(frame: Uint8Array): number {
    if (frame.length !== ALARM_SYNC_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
    if (frame[6] > 10) return ACK_RESULT_CODES.ALARM_LIMIT;
    const stage = this.stage;
    const revision = frame[4] | (frame[5] << 8);
    const matches = stage
      && stage.revision === revision
      && stage.expectedCount === frame[6]
      && stage.slots.size === stage.expectedCount;
    this.stage = null;
    if (!matches || !stage) return ACK_RESULT_CODES.SYNC_CONFLICT;
    this.committed.clear();
    stage.slots.forEach((alarm, index) => this.committed.set(index, alarm));
    this.revision = stage.revision;
    return ACK_RESULT_CODES.OK;
  }

  private deleteAlarm(frame: Uint8Array): number {
    if (this.stage) return ACK_RESULT_CODES.SYNC_CONFLICT;
    if (frame.length !== DELETE_ALARM_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
    if (frame[4] > 9 || frame[5] !== 0xAA) return ACK_RESULT_CODES.INVALID_VALUE;
    this.committed.delete(frame[4]);
    return ACK_RESULT_CODES.OK;
  }

  private skipAlarm(frame: Uint8Array): number {
    if (this.stage) return ACK_RESULT_CODES.SYNC_CONFLICT;
    if (frame.length !== SKIP_NEXT_ALARM_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
    if (frame[4] > 9 || (frame[5] !== 0 && frame[5] !== 1)) return ACK_RESULT_CODES.INVALID_VALUE;
    const alarm = this.committed.get(frame[4]);
    if (!alarm) return ACK_RESULT_CODES.INVALID_VALUE;
    this.committed.set(frame[4], { ...alarm, skipNext: frame[5] === 1 });
    return ACK_RESULT_CODES.OK;
  }

  private readAlarm(frame: Uint8Array): StoredAlarm | number {
    if (frame.length !== UPSERT_ALARM_FRAME_LENGTH) return ACK_RESULT_CODES.INVALID_LENGTH;
    const [index, flags, hour, minute, weekdayMask, sunriseMinutes, brightnessPercent, soundId, volumePercent] = [
      frame[4], frame[5], frame[6], frame[7], frame[8], frame[9], frame[10], frame[11], frame[12],
    ];
    const reserved = frame[13] | frame[14] | frame[15] | frame[16];
    const sunriseOk = sunriseMinutes === 15 || sunriseMinutes === 30 || sunriseMinutes === 45;
    if (
      index > 9 || (flags & ~0x03) !== 0 || hour > 23 || minute > 59 || weekdayMask < 1 || weekdayMask > 0x7F
      || !sunriseOk || !this.validPercent(brightnessPercent) || soundId > 25 || !this.validPercent(volumePercent) || reserved !== 0
    ) return ACK_RESULT_CODES.INVALID_VALUE;
    return {
      index, hour, minute, weekdayMask, sunriseMinutes, brightnessPercent, soundId, volumePercent,
      enabled: (flags & 0x01) !== 0,
      skipNext: (flags & 0x02) !== 0,
    };
  }

  private replyAlarm(frame: Uint8Array, resultCode: number): void {
    const sequence = frame[2] ?? 0;
    const opcode = frame[3] ?? 0;
    this.responsePending = true;
    this.later(() => {
      this.responsePending = false;
      this.onData?.(createAckFrame({ sequence, requestOpcode: opcode, resultCode, detail: 0 }));
      if (resultCode !== ACK_RESULT_CODES.OK) return;
      if (
        opcode !== READ_ALARMS_OPCODE
        && opcode !== COMMIT_ALARM_SYNC_OPCODE
        && opcode !== UPSERT_ALARM_OPCODE
        && opcode !== SKIP_NEXT_ALARM_OPCODE
      ) return;
      this.onData?.(this.alarmList(sequence));
    });
  }

  private committedAlarms(): StoredAlarm[] {
    return [...this.committed.values()].sort((left, right) => left.index - right.index);
  }

  private alarmList(sequence: number): Uint8Array {
    const frame = new Uint8Array(ALARM_LIST_LENGTH);
    const alarms = this.committedAlarms();
    frame.set([
      0xFF, ALARM_LIST_LENGTH, sequence, READ_ALARMS_OPCODE, 0,
      this.revision & 0xFF, (this.revision >> 8) & 0xFF, alarms.length, 0, this.clockValid ? 1 : 0, 0,
    ]);
    alarms.forEach(alarm => frame.set(alarmSlot(alarm), 11 + (alarm.index * ALARM_SLOT_LENGTH)));
    frame[8] = sum8(frame.slice(11, 101));
    frame[ALARM_LIST_LENGTH - 1] = sum8(frame.slice(0, ALARM_LIST_LENGTH - 1));
    return frame;
  }

  private isAlarmOpcode(opcode: number): boolean {
    return opcode === UPSERT_ALARM_OPCODE || opcode === READ_ALARMS_OPCODE || opcode === BEGIN_ALARM_SYNC_OPCODE
      || opcode === COMMIT_ALARM_SYNC_OPCODE || opcode === DELETE_ALARM_OPCODE || opcode === SKIP_NEXT_ALARM_OPCODE;
  }

  private reply(sequence: number, opcode: number, resultCode: number, includeStatus: boolean): void {
    this.responsePending = true;
    this.later(() => {
      this.responsePending = false;
      this.onData?.(createAckFrame({ sequence, requestOpcode: opcode, resultCode, detail: 0 }));
      if (!includeStatus) return;
      if (opcode === AUDIO_CONTROL_OPCODE) this.onData?.(this.audioState(sequence));
      this.simulatedStatus(sequence);
    });
  }

  private simulatedStatus(sequence: number): void {
    const frame = createManufacturerStatusFixture(sequence);
    frame[13] = this.powerOn ? 1 : 0;
    frame[14] = this.brightness;
    frame[15] = this.white;
    frame[16] = this.warmWhite;
    frame[17] = this.simulatedVolume;
    frame[18] = this.simulatedSoundId;
    frame[19] = this.clockValid ? 1 : 0;
    frame[20] = this.committed.size;
    frame[frame.length - 1] = sum8(frame.slice(0, -1));
    this.onData?.(frame);
  }

  private audioState(sequence: number): Uint8Array {
    const frame = new Uint8Array([
      0xFF, 0x08, sequence, AUDIO_CONTROL_OPCODE,
      this.simulatedSoundId === 0 ? 0 : 1, this.simulatedSoundId, this.simulatedVolume, 0,
    ]);
    frame[7] = sum8(frame.slice(0, 7));
    return frame;
  }

  private validPercent(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 100;
  }

  private knownInverse(raw: number): boolean {
    return this.percentForInverse(raw) >= 0;
  }

  private percentForInverse(raw: number): number {
    for (let percent = 0; percent <= 100; percent += 1) {
      if (brightnessToInverseRaw(percent) === raw) return percent;
    }
    return -1;
  }

  private later(fn: () => void): void {
    setTimeout(() => { if (this.connected && !this.destroyed) fn(); }, 150);
  }

  async destroy(): Promise<void> {
    this.connected = false;
    this.destroyed = true;
    this.stopWatchingLink();
  }

  private beginRadioWatch(): void {
    this.stopRadioWatch?.();
    this.stopRadioWatch = this.options.watchRadio?.(error => this.loseLink(error)) ?? null;
  }

  private loseLink(error: Error): void {
    if (!this.connected || this.destroyed) return;
    this.connected = false;
    this.stage = null;
    this.stopRadioWatch?.();
    this.stopRadioWatch = null;
    const notify = this.sessionError;
    this.sessionError = null;
    if (notify) notify(error);
    else this.queuedLoss = error;
  }

  private takeQueuedLoss(): Error | null {
    const error = this.queuedLoss;
    this.queuedLoss = null;
    return error;
  }

  private stopWatchingLink(): void {
    this.stopRadioWatch?.();
    this.stopRadioWatch = null;
    this.sessionError = null;
    this.queuedLoss = null;
  }

  private assertConnected(): void {
    this.assertActive();
    if (!this.connected) throw new BleTransportError('connection_failed', 'The mock device is not connected.');
  }

  private assertActive(): void {
    if (this.destroyed) throw new BleTransportError('operation_cancelled', 'The mock transport was closed.');
  }
}

interface StoredAlarm {
  readonly index: number;
  readonly enabled: boolean;
  readonly skipNext: boolean;
  readonly hour: number;
  readonly minute: number;
  readonly weekdayMask: number;
  readonly sunriseMinutes: number;
  readonly brightnessPercent: number;
  readonly soundId: number;
  readonly volumePercent: number;
}

interface AlarmStage {
  readonly revision: number;
  readonly expectedCount: number;
  readonly slots: Map<number, StoredAlarm>;
}

function alarmSlot(alarm: StoredAlarm): Uint8Array {
  return new Uint8Array([
    0x01 | (alarm.enabled ? 0x02 : 0) | (alarm.skipNext ? 0x04 : 0),
    alarm.hour,
    alarm.minute,
    alarm.weekdayMask,
    alarm.sunriseMinutes,
    alarm.brightnessPercent,
    alarm.soundId,
    alarm.volumePercent,
    0,
  ]);
}
