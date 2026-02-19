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

    // --- Semantic ---
    error: '#FF3B30',         // systemRed
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    success: '#34C759',       // systemGreen
    onSuccess: '#FFFFFF',
    successContainer: '#D1FAE5',
    warning: '#FF9500',       // systemOrange
    onWarning: '#FFFFFF',
    warningContainer: '#FEF3C7',

    // --- Apple HIG Backgrounds ---
    background: '#FFFFFF',              // systemBackground
    secondaryBackground: '#F2F2F7',     // secondarySystemBackground
    tertiaryBackground: '#FFFFFF',      // tertiarySystemBackground
    groupedBackground: '#F2F2F7',       // systemGroupedBackground
    secondaryGroupedBackground: '#FFFFFF',
    tertiaryGroupedBackground: '#F2F2F7',

    // --- Apple HIG Labels ---
    label: '#000000',                   // label
    secondaryLabel: 'rgba(60,60,67,0.6)',  // secondaryLabel
    tertiaryLabel: 'rgba(60,60,67,0.3)',   // tertiaryLabel
    quaternaryLabel: 'rgba(60,60,67,0.18)',

    // --- Apple HIG Fills ---
    fill: 'rgba(120,120,128,0.2)',
    secondaryFill: 'rgba(120,120,128,0.16)',
    tertiaryFill: 'rgba(118,118,128,0.12)',
    quaternaryFill: 'rgba(116,116,128,0.08)',

    // --- Apple HIG Separators ---
    separator: 'rgba(60,60,67,0.29)',
    opaqueSeparator: '#C6C6C8',

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
    priceSavings: '#34C759',
    priceSavingsContainer: '#D1FAE5',
    priceOriginal: '#8E8E93',

    // --- Surface (for card-like elements) ---
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
  },

  dark: {
    // --- Tawveeri Brand ---
    primary: '#60A5FA',
    onPrimary: '#FFFFFF',
    primaryContainer: '#1D4ED8',
    onPrimaryContainer: '#DBEAFE',

    secondary: '#A5B4FC',
    onSecondary: '#312E81',
    secondaryContainer: '#4338CA',
    onSecondaryContainer: '#E0E7FF',

    tertiary: '#FCD34D',
    onTertiary: '#78350F',
    tertiaryContainer: '#92400E',
    onTertiaryContainer: '#FEF3C7',

    // --- Apple HIG System Colors (Dark) ---
    systemRed: '#FF453A',
    systemOrange: '#FF9F0A',
    systemYellow: '#FFD60A',
    systemGreen: '#30D158',
    systemMint: '#63E6E2',
    systemTeal: '#40CBE0',
    systemCyan: '#64D2FF',
    systemBlue: '#0A84FF',
    systemIndigo: '#5E5CE6',
    systemPurple: '#BF5AF2',
    systemPink: '#FF375F',
    systemBrown: '#AC8E68',

    // --- Semantic ---
    error: '#FF453A',
    onError: '#FFFFFF',
    errorContainer: '#7F1D1D',
    success: '#30D158',
    onSuccess: '#FFFFFF',
    successContainer: '#064E3B',
    warning: '#FF9F0A',
    onWarning: '#000000',
    warningContainer: '#92400E',

    // --- Apple HIG Backgrounds (Dark) ---
    background: '#000000',
    secondaryBackground: '#1C1C1E',
    tertiaryBackground: '#2C2C2E',
    groupedBackground: '#000000',
    secondaryGroupedBackground: '#1C1C1E',
    tertiaryGroupedBackground: '#2C2C2E',

    // --- Apple HIG Labels (Dark) ---
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235,235,245,0.6)',
    tertiaryLabel: 'rgba(235,235,245,0.3)',
    quaternaryLabel: 'rgba(235,235,245,0.18)',

    // --- Apple HIG Fills (Dark) ---
    fill: 'rgba(120,120,128,0.36)',
    secondaryFill: 'rgba(120,120,128,0.32)',
    tertiaryFill: 'rgba(118,118,128,0.24)',
    quaternaryFill: 'rgba(116,116,128,0.18)',

    // --- Apple HIG Separators (Dark) ---
    separator: 'rgba(84,84,88,0.6)',
    opaqueSeparator: '#38383A',

    // --- Apple HIG Gray Scale (Dark) ---
    systemGray: '#8E8E93',
    systemGray2: '#636366',
    systemGray3: '#48484A',
    systemGray4: '#3A3A3C',
    systemGray5: '#2C2C2E',
    systemGray6: '#1C1C1E',

    // --- Domain-specific ---
    deal: '#FCD34D',
    dealContainer: '#92400E',
    priceSavings: '#30D158',
    priceSavingsContainer: '#064E3B',
    priceOriginal: '#8E8E93',

    // --- Surface ---
    card: '#1C1C1E',
    cardElevated: '#2C2C2E',
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof colors.light]: string };
