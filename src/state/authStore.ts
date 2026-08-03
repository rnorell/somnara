import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'apple' | 'google' | 'email';
  avatar?: string;
}

export function toAppUser(user: SupabaseUser): User {
  const metadata = user.user_metadata ?? {};
  const provider = user.app_metadata?.provider;
  return {
    id: user.id,
    email: user.email ?? '',
    name: metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? 'Somnara User',
    provider: provider === 'apple' || provider === 'google' ? provider : 'email',
    avatar: metadata.avatar_url ?? metadata.picture,
  };
}

export function useAuthStore() {
  const [user, setUser] = useState<User | null>(null);

  const signIn = (u: User) => setUser(u);
  const signOut = () => setUser(null);

  return { user, signIn, signOut };
}
