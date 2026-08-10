import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

// Handles the app being opened via an email-confirmation or password-recovery
// link (somnara://auth/callback?code=...). Exchanging the code establishes a
// session; onAuthStateChange elsewhere picks up the resulting SIGNED_IN or
// PASSWORD_RECOVERY event. Returns a user-facing message when the link itself
// couldn't be used (expired, already used, or opened on a different device
// than it was requested from — the PKCE verifier is device-local).
export function useAuthDeepLink(): string | null {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    async function handleUrl(url: string | null) {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      const linkError = queryParams?.error_description ?? queryParams?.error;
      if (typeof linkError === 'string') {
        setError('This link has expired or was already used. Please request a new one.');
        return;
      }
      const code = queryParams?.code;
      if (typeof code !== 'string') return;
      const { error: exchangeError } = await client!.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(
          exchangeError.message.toLowerCase().includes('verifier')
            ? 'Open this link on the device you requested it from, or request a new one.'
            : 'This link has expired or was already used. Please request a new one.'
        );
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => subscription.remove();
  }, []);

  return error;
}
