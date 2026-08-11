import { classifyError } from './errors';

describe('classifyError', () => {
  it('classifies fetch/network failures', () => {
    expect(classifyError(new TypeError('Network request failed')).kind).toBe('network');
    expect(classifyError(new Error('fetch failed')).kind).toBe('network');
    expect(classifyError({ message: 'The operation timed out' }).kind).toBe('network');
  });

  it('classifies expired/invalid-session errors by code or message', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' }).kind).toBe('auth');
    expect(classifyError({ code: '401', message: 'unauthorized' }).kind).toBe('auth');
    expect(classifyError(new Error('invalid session')).kind).toBe('auth');
  });

  it('falls back to unknown for anything else, preserving the message', () => {
    const result = classifyError(new Error('duplicate key value violates unique constraint'));
    expect(result.kind).toBe('unknown');
    expect(result.message).toBe('duplicate key value violates unique constraint');
  });

  it('gives every kind a non-empty, user-facing message', () => {
    const cases = [
      new TypeError('Network request failed'),
      { code: 'PGRST301' },
      new Error(''),
      null,
      undefined,
      'a plain string error',
    ];
    for (const err of cases) {
      const { message } = classifyError(err);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('handles non-object, non-Error inputs without throwing', () => {
    expect(() => classifyError(null)).not.toThrow();
    expect(() => classifyError(undefined)).not.toThrow();
    expect(() => classifyError(42)).not.toThrow();
    expect(classifyError(null).kind).toBe('unknown');
  });
});
