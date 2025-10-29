// Tawveeri Theme Configuration - Final
// Professional Price Comparison Platform
// Optimized for Saudi Arabian market

export const themeColors = {
  // ============================================
  // PRIMARY - Trust Blue (Deep Blue)
  // Purpose: Reliability, primary actions, CTAs
  // ============================================
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',  // Main color
    900: '#1e3a8a',  // Hover state
    950: '#172554',
  },

  // ============================================
  // SUCCESS - Emerald Green (Savings)
  // Purpose: THE MOST IMPORTANT - Best prices, deals, savings
  // ============================================
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',  // Main color
    700: '#047857',  // Dark variant
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },

  // ============================================
  // WARNING - True Red (Urgency)
  // Purpose: Hot deals, limited time, urgency
  // ============================================
  warning: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',  // Main color
    700: '#b91c1c',  // Dark variant
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // ============================================
  // FEATURED - Amber (Premium)
  // Purpose: Featured stores, premium placements
  // ============================================
  featured: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Main color
    600: '#d97706',  // Hover state
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // ============================================
  // NEUTRALS - Clean Grays
  // Purpose: Text, backgrounds, borders
  // ============================================
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
};

// ============================================
// SEMANTIC COLORS - Light Mode
// ============================================
export const lightMode = {
  // Backgrounds
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    elevated: '#ffffff',
    success: '#ecfdf5',
    warning: '#fef2f2',
    featured: '#fffbeb',
  },

  // Text
  text: {
    primary: '#111827',
    secondary: '#4b5563',
    tertiary: '#6b7280',
    inverse: '#ffffff',
    link: '#1e40af',
    success: '#047857',
    warning: '#b91c1c',
    featured: '#92400e',
  },

  // Borders
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    strong: '#9ca3af',
  },

  // Price-specific
  price: {
    current: '#111827',
    original: '#9ca3af',
    savings: '#059669',
    best: '#047857',
  },
};

// ============================================
// SEMANTIC COLORS - Dark Mode
// ============================================
export const darkMode = {
  // Backgrounds
  background: {
    primary: '#111827',
    secondary: '#1f2937',
    tertiary: '#374151',
    elevated: '#1f2937',
    success: '#064e3b',
    warning: '#7f1d1d',
    featured: '#78350f',
  },

  // Text
  text: {
    primary: '#f9fafb',
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
    inverse: '#111827',
    link: '#60a5fa',
    success: '#6ee7b7',
    warning: '#fca5a5',
    featured: '#fbbf24',
  },

  // Borders
  border: {
    light: '#374151',
    medium: '#4b5563',
    strong: '#6b7280',
  },

  // Price-specific
  price: {
    current: '#f9fafb',
    original: '#9ca3af',
    savings: '#34d399',
    best: '#6ee7b7',
  },
};

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
  fontFamily: {
    sans: {
      en: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      ar: ['IBM Plex Sans Arabic', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
    },
    display: {
      en: ['Inter', 'system-ui', 'sans-serif'],
      ar: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
    },
    mono: ['SF Mono', 'Consolas', 'Monaco', 'monospace'],
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
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
};

// ============================================
// SPACING (8px grid)
// ============================================
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
};

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  base: '0.375rem', // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  '3xl': '2rem',    // 32px
  full: '9999px',
};

// ============================================
// SHADOWS
// ============================================
export const shadows = {
  light: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  dark: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
  },
};

// ============================================
// ANIMATIONS
// ============================================
export const animations = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ============================================
// BREAKPOINTS
// ============================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Default export
export default {
  colors: themeColors,
  lightMode,
  darkMode,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  breakpoints,
};
