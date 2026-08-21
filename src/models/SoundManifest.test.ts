import {
  EMPTY_SOUND_MANIFEST,
  MAX_AUDIO_STORAGE_BYTES,
  SoundManifestEntry,
  validateSoundManifest,
} from './SoundManifest';

function withSound(patch: Partial<SoundManifestEntry>): SoundManifestEntry[] {
  return EMPTY_SOUND_MANIFEST.map(entry => entry.id === 1 ? {
    ...entry,
    displayName: 'Morning Birds',
    filename: 'morning_birds-01.mp3',
    format: 'mp3',
    sampleRateHz: 44_100,
    sizeBytes: 1_024,
    durationSeconds: 30,
    sha256: 'a'.repeat(64),
    loopBehavior: 'continuous',
    ...patch,
  } : { ...entry });
}

describe('sound manifest validation', () => {
  it('accepts the empty manufacturer manifest and a valid MP3 entry', () => {
    expect(validateSoundManifest(EMPTY_SOUND_MANIFEST)).toHaveLength(26);
    expect(validateSoundManifest(withSound({}))).toHaveLength(26);
  });

  it('rejects unsafe filenames and unsupported sample rates', () => {
    expect(() => validateSoundManifest(withSound({ filename: 'morning birds.mp3' }))).toThrow('FAT-safe');
    expect(() => validateSoundManifest(withSound({ sampleRateHz: 96_000 as 44_100 }))).toThrow('sample rate');
  });

  it('rejects totals over 32 MB', () => {
    expect(() => validateSoundManifest(withSound({ sizeBytes: MAX_AUDIO_STORAGE_BYTES + 1 }))).toThrow('32 MB');
  });
});
