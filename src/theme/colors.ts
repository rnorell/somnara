export const colors = {
  background: {
    primary: '#FAF8F4',
    card: '#F2EBE0',
    elevated: '#FFFFFF',
    overlay: 'rgba(58, 48, 42, 0.04)',
  },
  text: {
    primary: '#3A302A',
    secondary: '#9B8F88',
    tertiary: '#C4B8B0',
    inverse: '#FAF8F4',
  },
  primary: {
    DEFAULT: '#D4B896',
    light: '#E8D4BC',
    dark: '#B89870',
  },
  accent: {
    DEFAULT: '#B8916E',
    light: '#D4B090',
    dark: '#8C6A4A',
  },
  success: '#7A9E7E',
  border: {
    DEFAULT: '#EAE2D8',
    strong: '#D8CCBF',
  },
  glow: {
    sunrise: '#F9C97C',
    warm: '#F0A855',
    soft: '#FBE4C0',
  },
  dark: {
    background: '#1E1E18',
    card: '#2A2A22',
    text: '#F0EBE3',
  },
} as const;

export type Colors = typeof colors;
