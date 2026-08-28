import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type OtaPhase =
  | 'connecting'
  | 'authenticating'
  | 'transferring'
  | 'verifying'
  | 'restarting'
  | 'complete'
  | 'failed'
  | 'cancelled';

export interface OtaEvent {
  phase: OtaPhase;
  progress: number;
  code?: string;
  message?: string;
  recoverable?: boolean;
  finalVersion?: string;
  timestamp: string;
}

export interface OtaDevice {
  id: string;
  name: string | null;
  flashUuid: string | null;
  macAddress: string | null;
  rawIdentity: string | null;
  rssi: number;
}

export interface FirmwareInspection {
  uri: string;
  name: string;
  sizeBytes: number;
  sha256: string;
  imageVersion: string | null;
  hardwareId: string | null;
}

export interface OtaSdkInfo {
  platform: 'android' | 'ios';
  sdkVersion: string;
  authenticationEnabled: true;
  supportsBle: true;
  supportsCancel: true;
  requiresPhysicalAcceptance: true;
}

type SomnaraOtaEvents = {
  onOtaEvent: (event: OtaEvent) => void;
};

declare class SomnaraOtaNativeModule extends NativeModule<SomnaraOtaEvents> {
  getSdkInfo(): Promise<OtaSdkInfo>;
  scanForOtaDevices(timeoutMs: number): Promise<OtaDevice[]>;
  inspectFirmware(uri: string): Promise<FirmwareInspection>;
  startUpdate(options: { deviceId: string; firmwareUri: string; expectedSha256: string }): Promise<void>;
  cancelUpdate(): Promise<boolean>;
}

const nativeModule = requireNativeModule<SomnaraOtaNativeModule>('SomnaraOta');

export const getSdkInfo = () => nativeModule.getSdkInfo();
export const scanForOtaDevices = (timeoutMs = 8_000) => nativeModule.scanForOtaDevices(timeoutMs);
export const inspectFirmware = (uri: string) => nativeModule.inspectFirmware(uri);
export const startUpdate = (options: { deviceId: string; firmwareUri: string; expectedSha256: string }) => nativeModule.startUpdate(options);
export const cancelUpdate = () => nativeModule.cancelUpdate();
export const addOtaListener = (listener: (event: OtaEvent) => void) => nativeModule.addListener('onOtaEvent', listener);
