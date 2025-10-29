import type { Config } from 'tailwindcss';
import { themeColors, shadows, typography, spacing, borderRadius } from './theme-config';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light mode colors
        primary: themeColors.light.primary,
        secondary: themeColors.light.secondary,
        accent: themeColors.light.accent,
        neutral: themeColors.light.neutral,
        
        // Semantic colors
        success: themeColors.light.semantic.success,
        error: themeColors.light.semantic.error,
        warning: themeColors.light.semantic.warning,
        info: themeColors.light.semantic.info,
        
        // Background colors
        'bg-primary': themeColors.light.background.primary,
        'bg-secondary': themeColors.light.background.secondary,
        'bg-tertiary': themeColors.light.background.tertiary,
        'bg-elevated': themeColors.light.background.elevated,
        
        // Text colors
        'text-primary': themeColors.light.text.primary,
        'text-secondary': themeColors.light.text.secondary,
        'text-tertiary': themeColors.light.text.tertiary,
        'text-inverse': themeColors.light.text.inverse,
        'text-link': themeColors.light.text.link,
        
        // Border colors
        'border-light': themeColors.light.border.light,
        'border-medium': themeColors.light.border.medium,
        'border-strong': themeColors.light.border.strong,
      },
      boxShadow: shadows.light,
      fontFamily: {
        sans: typography.fontFamily.sans.en,
        'sans-ar': typography.fontFamily.sans.ar,
        display: typography.fontFamily.display.en,
        'display-ar': typography.fontFamily.display.ar,
        mono: typography.fontFamily.mono,
      },
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      spacing: spacing,
      borderRadius: borderRadius,
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '500ms',
      },
      transitionTimingFunction: {
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-rtl'),
    // Custom plugin for dark mode colors
    function ({ addUtilities, theme }: any) {
      const darkModeColors = {
        '.dark': {
          '--color-primary': themeColors.dark.primary[500],
          '--color-secondary': themeColors.dark.secondary[500],
          '--color-accent': themeColors.dark.accent[500],
          '--color-bg-primary': themeColors.dark.background.primary,
          '--color-bg-secondary': themeColors.dark.background.secondary,
          '--color-bg-tertiary': themeColors.dark.background.tertiary,
          '--color-text-primary': themeColors.dark.text.primary,
          '--color-text-secondary': themeColors.dark.text.secondary,
          '--color-text-tertiary': themeColors.dark.text.tertiary,
        },
      };
      addUtilities(darkModeColors);
    },
  ],
};

export default config;
