/**
 * KingBet67 Design System — Typography
 * Font: System default (Public Sans not available in RN, system font is fine)
 */

import { Platform } from 'react-native';

export const FontFamily = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif' }) as string,
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium' }) as string,
  bold: Platform.select({ ios: 'System', android: 'sans-serif' }) as string,
};

export const FontSize = {
  // Tiny labels
  xs: 10,
  sm: 12,
  // Body
  base: 14,
  md: 15,
  // Titles
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
  '5xl': 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};
