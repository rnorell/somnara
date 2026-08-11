export type AppEnv = 'development' | 'staging' | 'production';

const raw = process.env.EXPO_PUBLIC_APP_ENV;

export const APP_ENV: AppEnv =
  raw === 'staging' || raw === 'production' ? raw : 'development';

export const isProduction = APP_ENV === 'production';
