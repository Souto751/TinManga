export type ColorScheme = 'dark' | 'light';

export const colors = {
  bg: '#07070E',
  bg2: '#0E1020',
  surface: '#121428',
  surface2: '#1A1D36',
  border: '#2E3560',
  text: '#F4F1FF',
  textMuted: '#8B88A8',
  accent: '#FF2E8A',
  accentSoft: 'rgba(255, 46, 138, 0.18)',
  accent2: '#3EF0FF',
  accent2Soft: 'rgba(62, 240, 255, 0.16)',
  gold: '#FFD24A',
  overlay: 'rgba(7, 7, 14, 0.78)',
};

export type ColorTokens = typeof colors;

export const lightColors: ColorTokens = {
  bg: '#E6E1EF',
  bg2: '#DCD6E8',
  surface: '#D4CDE3',
  surface2: '#C8C0DA',
  border: '#AFA6C6',
  text: '#1C1630',
  textMuted: '#5E5870',
  accent: '#FF2E8A',
  accentSoft: 'rgba(255, 46, 138, 0.14)',
  accent2: '#0A9BB0',
  accent2Soft: 'rgba(10, 155, 176, 0.14)',
  gold: '#C48900',
  overlay: 'rgba(230, 225, 239, 0.9)',
};

export function paletteFor(scheme: ColorScheme): ColorTokens {
  return scheme === 'light' ? lightColors : colors;
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  full: 999,
};

export const fonts = {
  serif: 'ChakraPetch_700Bold',
  display: 'ChakraPetch_700Bold',
  displaySemi: 'ChakraPetch_600SemiBold',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemi: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
};

export const coverPalette = [
  ['#3A1028', '#FF2E8A'],
  ['#102430', '#3EF0FF'],
  ['#2A1840', '#A78BFF'],
  ['#241808', '#FFD24A'],
  ['#1A1028', '#FF6B4A'],
  ['#0E2430', '#5B8FBF'],
];
