// One render() per test file — see syncTestHelpers.tsx for why: this
// dependency combination (React 19 + react-test-renderer + RTL 14) doesn't
// reliably support a second render() within the same file/module registry,
// even across unrelated tests. Splitting by scenario sidesteps it cleanly,
// since Jest gives each test file its own fresh environment.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

import { act } from '@testing-library/react-native';
import { renderSync } from './syncTestHelpers';

it('settles on "local" and never attempts a sync when no backend is configured', async () => {
  const { getCtx } = await renderSync();
  expect(getCtx().status).toBe('local');

  await act(async () => { getCtx().setAlarms([]); });
  expect(getCtx().status).toBe('local');
});
