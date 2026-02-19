/**
 * Apple HIG Typography Scale
 *
 * Uses SF Pro sizes/weights mapped to React Native.
 * Custom fonts: Inter (English), IBM Plex Sans Arabic (Arabic).
 *
 * HIG Reference:
 * - largeTitle: 34pt Regular
 * - title1: 28pt Regular
 * - title2: 22pt Regular
 * - title3: 20pt Regular
 * - headline: 17pt Semibold
 * - body: 17pt Regular
 * - callout: 16pt Regular
 * - subheadline: 15pt Regular
 * - footnote: 13pt Regular
 * - caption1: 12pt Regular
 * - caption2: 11pt Regular
 */

import { TextStyle, Platform } from 'react-native';

type FontWeight = TextStyle['fontWeight'];

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing: number;
}

// Apple HIG text styles
export const typography: Record<string, TypeStyle> = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '400',
    letterSpacing: 0.37,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: 0.38,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.32,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.07,
  },
};

// Font family mapping based on locale
export function getFontFamily(locale: 'ar' | 'en', weight?: FontWeight): string {
  if (locale === 'ar') {
    // IBM Plex Sans Arabic weights
    switch (weight) {
      case '700':
      case 'bold':
        return 'IBMPlexSansArabic_700Bold';
      case '600':
        return 'IBMPlexSansArabic_600SemiBold';
      case '500':
        return 'IBMPlexSansArabic_500Medium';
      case '300':
      case '200':
        return 'IBMPlexSansArabic_300Light';
      default:
        return 'IBMPlexSansArabic_400Regular';
    }
  }

  // Inter weights for English
  switch (weight) {
    case '700':
    case 'bold':
      return 'Inter_700Bold';
    case '600':
      return 'Inter_600SemiBold';
    case '500':
      return 'Inter_500Medium';
    case '300':
    case '200':
      return 'Inter_300Light';
    default:
      return 'Inter_400Regular';
  }
}

// HIG spacing scale
export const spacing = {
  xs: 4,    // Tight spacing
  sm: 8,    // Related elements
  md: 16,   // Standard spacing (HIG compact width margin)
  lg: 24,   // Section separation
  xl: 32,   // Major breaks
  xxl: 48,  // Significant breaks
} as const;

// HIG corner radii
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// HIG touch targets
export const hitSlop = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
};

// Minimum 44pt touch target per HIG
export const MIN_TOUCH_TARGET = 44;
