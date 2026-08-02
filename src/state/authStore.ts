import { useState } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'apple' | 'google' | 'email';
  avatar?: string;
}

export function useAuthStore() {
  const [user, setUser] = useState<User | null>(null);

  const signIn = (u: User) => setUser(u);
  const signOut = () => setUser(null);

  return { user, signIn, signOut };
}
