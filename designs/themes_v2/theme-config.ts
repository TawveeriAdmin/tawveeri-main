// Tawveeri Theme Configuration
// Optimized for Price Comparison & Deal Finding Platform

export const themeColors = {
  light: {
    // Primary - Trust Blue (Reliable, Professional, Digital Commerce)
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    
    // Success - Savings Green (Best Price, Deals, Save Money)
    // This is THE MOST IMPORTANT color for a price comparison platform
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    
    // Warning - Urgency Orange (Hot Deals, Limited Time, Deal of the Day)
    warning: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407',
    },
    
    // Featured - Amber (Premium Stores, Featured Listings - Phase 2 Monetization)
    featured: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006',
    },
    
    // Error - Red (Out of Stock, Errors, Price Increases)
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },
    
    // Info - Cyan (Product Info, Comparisons, Neutral Information)
    info: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
      950: '#083344',
    },
    
    // Neutrals - Clean Grays for Data Tables
    neutral: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
      950: '#09090b',
    },
    
    // Backgrounds
    background: {
      primary: '#ffffff',
      secondary: '#fafafa',
      tertiary: '#f4f4f5',
      elevated: '#ffffff',
      success: '#f0fdf4', // For savings highlights
      warning: '#fff7ed', // For urgent deals
    },
    
    // Text
    text: {
      primary: '#18181b',
      secondary: '#52525b',
      tertiary: '#71717a',
      inverse: '#ffffff',
      link: '#2563eb',
      success: '#15803d', // For "Save" text
      warning: '#c2410c', // For urgency text
    },
    
    // Borders
    border: {
      light: '#e4e4e7',
      medium: '#d4d4d8',
      strong: '#a1a1aa',
    },
    
    // Price-specific colors
    price: {
      current: '#18181b', // Current price - bold and clear
      original: '#71717a', // Strikethrough price
      savings: '#22c55e', // Savings amount - GREEN
      best: '#15803d', // Best price indicator
    },
  },
  
  dark: {
    // Primary - Brighter Blue for dark backgrounds
    primary: {
      50: '#172554',
      100: '#1e3a8a',
      200: '#1e40af',
      300: '#1d4ed8',
      400: '#2563eb',
      500: '#3b82f6',
      600: '#60a5fa',
      700: '#93c5fd',
      800: '#bfdbfe',
      900: '#dbeafe',
      950: '#eff6ff',
    },
    
    // Success - Vibrant Green (stands out on dark)
    success: {
      50: '#052e16',
      100: '#14532d',
      200: '#166534',
      300: '#15803d',
      400: '#16a34a',
      500: '#22c55e',
      600: '#4ade80',
      700: '#86efac',
      800: '#bbf7d0',
      900: '#dcfce7',
      950: '#f0fdf4',
    },
    
    // Warning - Bright Orange for visibility
    warning: {
      50: '#431407',
      100: '#7c2d12',
      200: '#9a3412',
      300: '#c2410c',
      400: '#ea580c',
      500: '#f97316',
      600: '#fb923c',
      700: '#fdba74',
      800: '#fed7aa',
      900: '#ffedd5',
      950: '#fff7ed',
    },
    
    // Featured - Amber
    featured: {
      50: '#422006',
      100: '#713f12',
      200: '#854d0e',
      300: '#a16207',
      400: '#ca8a04',
      500: '#eab308',
      600: '#facc15',
      700: '#fde047',
      800: '#fef08a',
      900: '#fef9c3',
      950: '#fefce8',
    },
    
    // Error - Red
    error: {
      50: '#450a0a',
      100: '#7f1d1d',
      200: '#991b1b',
      300: '#b91c1c',
      400: '#dc2626',
      500: '#ef4444',
      600: '#f87171',
      700: '#fca5a5',
      800: '#fecaca',
      900: '#fee2e2',
      950: '#fef2f2',
    },
    
    // Info - Cyan
    info: {
      50: '#083344',
      100: '#164e63',
      200: '#155e75',
      300: '#0e7490',
      400: '#0891b2',
      500: '#06b6d4',
      600: '#22d3ee',
      700: '#67e8f9',
      800: '#a5f3fc',
      900: '#cffafe',
      950: '#ecfeff',
    },
    
    // Neutrals - Deep blacks with subtle warmth
    neutral: {
      50: '#09090b',
      100: '#18181b',
      200: '#27272a',
      300: '#3f3f46',
      400: '#52525b',
      500: '#71717a',
      600: '#a1a1aa',
      700: '#d4d4d8',
      800: '#e4e4e7',
      900: '#f4f4f5',
      950: '#fafafa',
    },
    
    // Backgrounds
    background: {
      primary: '#09090b',
      secondary: '#18181b',
      tertiary: '#27272a',
      elevated: '#18181b',
      success: '#14532d', // Dark green for savings
      warning: '#7c2d12', // Dark orange for deals
    },
    
    // Text
    text: {
      primary: '#fafafa',
      secondary: '#d4d4d8',
      tertiary: '#a1a1aa',
      inverse: '#09090b',
      link: '#60a5fa',
      success: '#86efac', // Bright green for savings
      warning: '#fdba74', // Bright orange for urgency
    },
    
    // Borders
    border: {
      light: '#27272a',
      medium: '#3f3f46',
      strong: '#52525b',
    },
    
    // Price-specific colors
    price: {
      current: '#fafafa', // Clear white for prices
      original: '#a1a1aa', // Muted for strikethrough
      savings: '#4ade80', // Bright green - highly visible
      best: '#86efac', // Best price indicator
    },
  },
};

// Shadow system for depth and elevation
export const shadows = {
  light: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  dark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
  },
};

// Typography system - Optimized for price scanning and data comparison
export const typography = {
  fontFamily: {
    sans: {
      en: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      ar: ['IBM Plex Sans Arabic', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
    },
    display: {
      en: ['Inter', 'system-ui', 'sans-serif'],
      ar: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
    },
    // Monospace for prices - ensures alignment in tables
    mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'Monaco', 'monospace'],
    // Tabular numbers for price consistency
    price: ['Inter', 'system-ui', 'sans-serif'], // With font-feature-settings: 'tnum'
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// Spacing system (8px base)
export const spacing = {
  0: '0px',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  11: '2.75rem',   // 44px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
  28: '7rem',      // 112px
  32: '8rem',      // 128px
};

// Border radius system
export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  base: '0.5rem',  // 8px
  md: '0.625rem',  // 10px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
};

// Animation timings
export const animations = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export default {
  colors: themeColors,
  shadows,
  typography,
  spacing,
  borderRadius,
  animations,
};
