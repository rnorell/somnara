/**
 * Startup mode.
 *
 * `offline` opens the local Bluetooth controller. Login, device activation,
 * and Supabase are not used.
 * `account` restores that original startup. Those screens and the Supabase
 * client stay in the project either way.
 */
export type AppMode = 'offline' | 'account';

export const APP_MODE: AppMode = 'offline';

export const isOfflineController = APP_MODE === 'offline';

/** AsyncStorage namespace for alarms and preferences when there is no account. */
export const LOCAL_USER_ID = 'local';
