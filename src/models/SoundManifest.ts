export const MAX_AUDIO_STORAGE_BYTES = 32 * 1024 * 1024;
export const SOUND_IDS = Array.from({ length: 26 }, (_, id) => id) as readonly number[];
export const SUPPORTED_SAMPLE_RATES_HZ = [
  8_000, 11_025, 12_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000,
] as const;

export interface SoundManifestEntry {
  id: number;
  displayName: string | null;
  filename: string | null;
  format: 'mp3' | null;
  sampleRateHz: typeof SUPPORTED_SAMPLE_RATES_HZ[number] | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  sha256: string | null;
  loopBehavior: string | null;
}

export const EMPTY_SOUND_MANIFEST: readonly SoundManifestEntry[] = SOUND_IDS.map(id => ({
  id,
  displayName: id === 0 ? 'Off' : null,
  filename: null,
  format: null,
  sampleRateHz: null,
  sizeBytes: null,
  durationSeconds: null,
  sha256: null,
  loopBehavior: id === 0 ? 'silent' : null,
}));

const FAT_SAFE_MP3 = /^([A-Za-z0-9_-]{1,251})\.mp3$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const SAMPLE_RATE_SET = new Set<number>(SUPPORTED_SAMPLE_RATES_HZ);

export function validateSoundManifest(entries: readonly SoundManifestEntry[]): readonly SoundManifestEntry[] {
  if (entries.length !== SOUND_IDS.length) throw new RangeError('Sound manifest must contain IDs 0 to 25.');
  const seen = new Set<number>();
  let totalBytes = 0;

  for (const entry of entries) {
    if (!Number.isInteger(entry.id) || entry.id < 0 || entry.id > 25 || seen.has(entry.id)) {
      throw new RangeError('Sound IDs must be unique integers from 0 to 25.');
    }
    seen.add(entry.id);
    if (entry.id === 0 && entry.filename !== null) throw new RangeError('Sound ID 0 cannot have an audio file.');
    if (entry.filename !== null && !FAT_SAFE_MP3.test(entry.filename)) {
      throw new RangeError('Audio filenames must use FAT-safe letters, numbers, hyphens, or underscores.');
    }
    if (entry.filename !== null && entry.format !== 'mp3') throw new RangeError('Audio files must use MP3 format.');
    if (entry.sampleRateHz !== null && !SAMPLE_RATE_SET.has(entry.sampleRateHz)) {
      throw new RangeError('Audio sample rate is not supported.');
    }
    if (entry.sizeBytes !== null) {
      if (!Number.isInteger(entry.sizeBytes) || entry.sizeBytes < 0) throw new RangeError('Audio file size is invalid.');
      totalBytes += entry.sizeBytes;
    }
    if (entry.durationSeconds !== null && (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0)) {
      throw new RangeError('Audio duration is invalid.');
    }
    if (entry.sha256 !== null && !SHA256.test(entry.sha256)) throw new RangeError('Audio SHA-256 is invalid.');
  }

  if (totalBytes > MAX_AUDIO_STORAGE_BYTES) throw new RangeError('Audio files exceed the 32 MB storage limit.');
  return entries;
}
