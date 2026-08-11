import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const isMonitoringConfigured = Boolean(dsn);

let initialized = false;

// Absent DSN => clean no-op, same pattern as src/lib/supabase.ts's
// isSupabaseConfigured. Crash reporting only activates once a real Sentry
// project's DSN is supplied.
export function initMonitoring(): void {
  if (!isMonitoringConfigured || initialized) return;
  initialized = true;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enabled: true,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isMonitoringConfigured) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
