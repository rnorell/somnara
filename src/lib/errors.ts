export type ErrorKind = 'network' | 'auth' | 'config' | 'unknown';

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

function extractRaw(err: unknown): { message: string; code: string } {
  if (err instanceof Error) return { message: err.message, code: '' };
  if (typeof err === 'string') return { message: err, code: '' };
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: unknown; code?: unknown };
    return {
      message: typeof anyErr.message === 'string' ? anyErr.message : '',
      code: typeof anyErr.code === 'string' ? anyErr.code : '',
    };
  }
  return { message: '', code: '' };
}

// Classifies an error from a Supabase call (or any thrown error) into a
// user-facing kind + message, so screens can tell "the backend is
// unreachable" apart from "your input/session is actually invalid" instead
// of showing the same generic failure message for both.
export function classifyError(err: unknown): ClassifiedError {
  const { message, code } = extractRaw(err);
  const lower = message.toLowerCase();

  if (/network|fetch|offline|timed out|timeout|econnrefused|enotfound/.test(lower)) {
    return {
      kind: 'network',
      message: "Can't reach Somnara servers. Check your connection and try again.",
    };
  }

  if (code === 'PGRST301' || code === '401' || /jwt|token expired|invalid session/.test(lower)) {
    return {
      kind: 'auth',
      message: 'Your session has expired. Please sign in again.',
    };
  }

  return {
    kind: 'unknown',
    message: message || 'Something went wrong. Please try again.',
  };
}
