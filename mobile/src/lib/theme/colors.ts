/**
 * Tawveeri Color System
 *
 * Based on Apple HIG semantic color guidelines with the Tawveeri brand palette.
 * Uses Apple's systemBackground / label hierarchy for proper iOS feel.
 *
 * HIG Reference:
 * - systemBlue as tint color for primary actions
 * - Semantic backgrounds: systemBackground > secondarySystemBackground > tertiarySystemBackground
 * - Label hierarchy: label > secondaryLabel > tertiaryLabel > quaternaryLabel
 * - System colors for semantic meaning (red=destructive, green=success, orange=warning)
 */

export const colors = {
  light: {
    // --- Tawveeri Brand ---
    primary: '#0D47A1',       // Deep Royal Blue (tint color)
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBEAFE',
    onPrimaryContainer: '#1E3A8A',

    secondary: '#4F46E5',     // Indigo
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E0E7FF',
    onSecondaryContainer: '#312E81',

    tertiary: '#D97706',      // Amber (deals/featured)
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FEF3C7',
    onTertiaryContainer: '#78350F',

    // --- Apple HIG System Colors ---
    systemRed: '#FF3B30',
    systemOrange: '#FF9500',
    systemYellow: '#FFCC00',
    systemGreen: '#34C759',
    systemMint: '#00C7BE',
    systemTeal: '#30B0C7',
    systemCyan: '#32ADE6',
    systemBlue: '#007AFF',
    systemIndigo: '#5856D6',
    systemPurple: '#AF52DE',
    systemPink: '#FF2D55',
    systemBrown: '#A2845E',

    // --- Semantic (web parity) ---
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    success: '#059669',
    onSuccess: '#FFFFFF',
    successContainer: '#D1FAE5',
    warning: '#F59E0B',
    onWarning: '#FFFFFF',
    warningContainer: '#FEF3C7',

    // --- Surface hierarchy (web parity) ---
    background: '#F9FAFB',
    secondaryBackground: '#F9FAFB',
    tertiaryBackground: '#F3F4F6',
    groupedBackground: '#F9FAFB',
    secondaryGroupedBackground: '#FFFFFF',
    tertiaryGroupedBackground: '#F3F4F6',

    // --- Text hierarchy (web parity) ---
    label: '#111827',
    secondaryLabel: '#4B5563',
    tertiaryLabel: '#4B5563',
    quaternaryLabel: '#D1D5DB',

    // --- Apple HIG Fills ---
    fill: 'rgba(120,120,128,0.2)',
    secondaryFill: 'rgba(120,120,128,0.16)',
    tertiaryFill: 'rgba(118,118,128,0.12)',
    quaternaryFill: 'rgba(116,116,128,0.08)',

    // --- Outline (web parity) ---
    separator: '#D1D5DB',
    opaqueSeparator: '#D1D5DB',

    // --- Apple HIG Gray Scale ---
    systemGray: '#8E8E93',
    systemGray2: '#AEAEB2',
    systemGray3: '#C7C7CC',
    systemGray4: '#D1D1D6',
    systemGray5: '#E5E5EA',
    systemGray6: '#F2F2F7',

    // --- Domain-specific ---
    deal: '#D97706',
    dealContainer: '#FEF3C7',
    priceSavings: '#059669',
    priceSavingsContainer: '#D1FAE5',
    priceOriginal: '#4B5563',

    // --- Surface ---
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',

    // --- Mock parity (Best Value, accents) ---
    brandAccent: '#059669',
  },

  dark: {
    // --- Tawveeri Brand (mock: brand-blue, brand-dark, brand-surface, brand-accent) ---
    primary: '#3B82F6',
    onPrimary: '#FFFFFF',
    primaryContainer: '#1E3A8A',
    onPrimaryContainer: '#DBEAFE',

    secondary: '#A5B4FC',
    onSecondary: '#312E81',
    secondaryContainer: '#4338CA',
    onSecondaryContainer: '#E0E7FF',

    tertiary: '#FCD34D',
    onTertiary: '#78350F',
    tertiaryContainer: '#B45309',
    onTertiaryContainer: '#FEF3C7',

    // --- Apple HIG System Colors (Dark) ---
    systemRed: '#FF453A',
    systemOrange: '#FF9F0A',
    systemYellow: '#FFD60A',
    systemGreen: '#30D158',
    systemMint: '#63E6E2',
    systemTeal: '#40CBE0',
    systemCyan: '#64D2FF',
    systemBlue: '#3B82F6',
    systemIndigo: '#5E5CE6',
    systemPurple: '#BF5AF2',
    systemPink: '#FF375F',
    systemBrown: '#AC8E68',

    // --- Semantic (web parity) ---
    error: '#FCA5A5',
    onError: '#7F1D1D',
    errorContainer: '#DC2626',
    success: '#10B981',
    onSuccess: '#064E3B',
    successContainer: '#059669',
    warning: '#FCD34D',
    onWarning: '#78350F',
    warningContainer: '#D97706',

    // --- Surface hierarchy (mock: brand-dark #0F172A, brand-surface #1E293B) ---
    background: '#0F172A',
    secondaryBackground: '#0F172A',
    tertiaryBackground: '#1E293B',
    groupedBackground: '#0F172A',
    secondaryGroupedBackground: '#1E293B',
    tertiaryGroupedBackground: '#1E293B',

    // --- Text hierarchy (dark web parity) ---
    label: '#F1F5F9',
    secondaryLabel: '#94A3B8',
    tertiaryLabel: '#64748B',
    quaternaryLabel: '#475569',

    // --- Apple HIG Fills (Dark) ---
    fill: 'rgba(120,120,128,0.36)',
    secondaryFill: 'rgba(120,120,128,0.32)',
    tertiaryFill: 'rgba(255,255,255,0.08)',
    quaternaryFill: 'rgba(255,255,255,0.05)',

    // --- Outline (mock: border-white/5, white/10) ---
    separator: 'rgba(255,255,255,0.08)',
    opaqueSeparator: '#334155',

    // --- Apple HIG Gray Scale (Dark) ---
    systemGray: '#94A3B8',
    systemGray2: '#64748B',
    systemGray3: '#475569',
    systemGray4: '#334155',
    systemGray5: '#1E293B',
    systemGray6: '#0F172A',

    // --- Domain-specific ---
    deal: '#EAB308',
    dealContainer: '#B45309',
    priceSavings: '#10B981',
    priceSavingsContainer: '#059669',
    priceOriginal: '#64748B',

    // --- Surface (mock: brand-surface) ---
    card: '#1E293B',
    cardElevated: '#334155',

    // --- Mock parity (Best Value green) ---
    brandAccent: '#10B981',
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof colors.light]: string };
