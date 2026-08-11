import type { User as SupabaseUser } from '@supabase/supabase-js';
import { toAppUser } from './authStore';

function fakeSupabaseUser(overrides: {
  id?: string;
  email?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}): SupabaseUser {
  return {
    id: overrides.id ?? 'user-123',
    email: overrides.email,
    app_metadata: overrides.provider ? { provider: overrides.provider } : {},
    user_metadata: overrides.metadata ?? {},
  } as unknown as SupabaseUser;
}

describe('toAppUser', () => {
  it('passes id and email through unchanged', () => {
    const result = toAppUser(fakeSupabaseUser({ id: 'abc-1', email: 'ric@example.com' }));
    expect(result.id).toBe('abc-1');
    expect(result.email).toBe('ric@example.com');
  });

  it('defaults email to an empty string when missing', () => {
    expect(toAppUser(fakeSupabaseUser({})).email).toBe('');
  });

  describe('provider inference', () => {
    it('recognizes apple and google', () => {
      expect(toAppUser(fakeSupabaseUser({ provider: 'apple' })).provider).toBe('apple');
      expect(toAppUser(fakeSupabaseUser({ provider: 'google' })).provider).toBe('google');
    });

    it('falls back to email for any other or missing provider', () => {
      expect(toAppUser(fakeSupabaseUser({ provider: 'phone' })).provider).toBe('email');
      expect(toAppUser(fakeSupabaseUser({})).provider).toBe('email');
    });
  });

  describe('name fallback chain', () => {
    it('prefers full_name', () => {
      const user = fakeSupabaseUser({
        email: 'jane@example.com',
        metadata: { full_name: 'Jane Doe', name: 'Jane', avatar_url: 'x' },
      });
      expect(toAppUser(user).name).toBe('Jane Doe');
    });

    it('falls back to name when full_name is absent', () => {
      const user = fakeSupabaseUser({ email: 'jane@example.com', metadata: { name: 'Jane' } });
      expect(toAppUser(user).name).toBe('Jane');
    });

    it('falls back to the email prefix when no name metadata exists', () => {
      const user = fakeSupabaseUser({ email: 'jane.doe@example.com', metadata: {} });
      expect(toAppUser(user).name).toBe('jane.doe');
    });

    it('falls back to "Somnara User" when there is no name metadata or email', () => {
      const user = fakeSupabaseUser({ metadata: {} });
      expect(toAppUser(user).name).toBe('Somnara User');
    });
  });

  describe('avatar fallback', () => {
    it('prefers avatar_url', () => {
      const user = fakeSupabaseUser({ metadata: { avatar_url: 'a.png', picture: 'p.png' } });
      expect(toAppUser(user).avatar).toBe('a.png');
    });

    it('falls back to picture when avatar_url is absent', () => {
      const user = fakeSupabaseUser({ metadata: { picture: 'p.png' } });
      expect(toAppUser(user).avatar).toBe('p.png');
    });

    it('is undefined when neither is present', () => {
      expect(toAppUser(fakeSupabaseUser({ metadata: {} })).avatar).toBeUndefined();
    });
  });
});
