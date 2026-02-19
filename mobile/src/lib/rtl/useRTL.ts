/**
 * RTL Hook — JavaScript-based RTL handling
 *
 * Mirrors Monifi's approach: disable native I18nManager RTL entirely
 * and handle all directionality in JS. This avoids unpredictable
 * native flipping of textAlign, margins, etc.
 *
 * Usage:
 *   const rtl = useRTL();
 *   <View style={{ flexDirection: rtl.row }}>
 *     <Text style={{ textAlign: rtl.textAlign, writingDirection: rtl.writingDirection }}>
 */

import { useMemo } from 'react';
import type { FlexStyle, TextStyle } from 'react-native';
import { useLocale } from '@/src/lib/i18n/provider';

export function useRTL() {
  const { locale } = useLocale();
  const isRTL = locale === 'ar';

  return useMemo(
    () => ({
      isRTL,
      locale,

      // Flex direction
      row: (isRTL ? 'row-reverse' : 'row') as FlexStyle['flexDirection'],
      rowReverse: (isRTL ? 'row' : 'row-reverse') as FlexStyle['flexDirection'],

      // Text alignment
      textAlign: (isRTL ? 'right' : 'left') as TextStyle['textAlign'],
      textAlignOpposite: (isRTL ? 'left' : 'right') as TextStyle['textAlign'],

      // Writing direction (critical for Arabic character rendering)
      writingDirection: (isRTL ? 'rtl' : 'ltr') as TextStyle['writingDirection'],

      // Alignment helpers
      alignStart: (isRTL ? 'flex-end' : 'flex-start') as FlexStyle['alignItems'],
      alignEnd: (isRTL ? 'flex-start' : 'flex-end') as FlexStyle['alignItems'],

      // Icon flip transform
      flipIcon: isRTL ? ([{ scaleX: -1 }] as const) : ([] as const),

      // Positioning helper: returns { left: val } in LTR, { right: val } in RTL
      position: (startValue: number) =>
        isRTL ? { right: startValue } : { left: startValue },
    }),
    [locale, isRTL],
  );
}
