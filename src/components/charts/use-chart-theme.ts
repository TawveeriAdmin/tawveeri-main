'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ChartThemeColors {
  primary: string;
  success: string;
  error: string;
  tertiary: string;
  onSurface: string;
  onSurfaceVariant: string;
  surfaceContainerLow: string;
  outlineVariant: string;
  surface: string;
  primaryContainer: string;
}

function readCSSColors(): ChartThemeColors {
  if (typeof window === 'undefined') {
    return {
      primary: '#0D47A1',
      success: '#10B981',
      error: '#EF4444',
      tertiary: '#D97706',
      onSurface: '#111827',
      onSurfaceVariant: '#4B5563',
      surfaceContainerLow: '#F9FAFB',
      outlineVariant: '#D1D5DB',
      surface: '#F9FAFB',
      primaryContainer: '#DBEAFE',
    };
  }

  const style = getComputedStyle(document.documentElement);
  const get = (prop: string) => style.getPropertyValue(prop).trim() || '';

  return {
    primary: get('--color-primary'),
    success: get('--color-success'),
    error: get('--color-error'),
    tertiary: get('--color-tertiary'),
    onSurface: get('--color-on-surface'),
    onSurfaceVariant: get('--color-on-surface-variant'),
    surfaceContainerLow: get('--color-surface-container-low'),
    outlineVariant: get('--color-outline-variant'),
    surface: get('--color-surface'),
    primaryContainer: get('--color-primary-container'),
  };
}

export function useChartThemeColors(): ChartThemeColors {
  const [colors, setColors] = useState<ChartThemeColors>(readCSSColors);

  const updateColors = useCallback(() => {
    setColors(readCSSColors());
  }, []);

  useEffect(() => {
    updateColors();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          // Small delay to let CSS variables update
          requestAnimationFrame(updateColors);
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [updateColors]);

  return colors;
}

export function buildBaseChartOption(
  colors: ChartThemeColors,
  isRTL: boolean
): Record<string, any> {
  return {
    textStyle: {
      fontFamily: isRTL
        ? "'IBM Plex Sans Arabic', sans-serif"
        : "'Inter', sans-serif",
      color: colors.onSurfaceVariant,
    },
    grid: {
      top: 50,
      bottom: 30,
      left: isRTL ? 20 : 50,
      right: isRTL ? 50 : 20,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.surfaceContainerLow,
      borderColor: colors.outlineVariant,
      borderWidth: 1,
      textStyle: {
        color: colors.onSurface,
        fontFamily: isRTL
          ? "'IBM Plex Sans Arabic', sans-serif"
          : "'Inter', sans-serif",
        fontSize: 13,
      },
      extraCssText: isRTL ? 'direction: rtl;' : '',
    },
    legend: {
      textStyle: {
        color: colors.onSurfaceVariant,
        fontFamily: isRTL
          ? "'IBM Plex Sans Arabic', sans-serif"
          : "'Inter', sans-serif",
      },
      ...(isRTL ? { right: 0 } : { left: 0 }),
    },
  };
}
