import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, ColorScheme, ThemeColors } from './colors';

const THEME_STORAGE_KEY = 'tawveeri-theme';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  setColorScheme: (scheme: ColorScheme | 'system') => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  colors: colors.light,
  isDark: false,
  setColorScheme: () => {},
  toggleColorScheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useDeviceColorScheme();
  const [override, setOverride] = useState<ColorScheme | 'system'>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setOverride(saved);
        }
      } catch {
        // Use system default
      }
      setReady(true);
    })();
  }, []);

  const resolvedScheme: ColorScheme = useMemo(() => {
    if (override === 'system') {
      return deviceScheme === 'dark' ? 'dark' : 'light';
    }
    return override;
  }, [override, deviceScheme]);

  const setColorScheme = useCallback(async (scheme: ColorScheme | 'system') => {
    setOverride(scheme);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
  }, []);

  const toggleColorScheme = useCallback(() => {
    const next = resolvedScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
  }, [resolvedScheme, setColorScheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    colorScheme: resolvedScheme,
    colors: colors[resolvedScheme],
    isDark: resolvedScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
  }), [resolvedScheme, setColorScheme, toggleColorScheme]);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColor(
  colorName: keyof ThemeColors,
): string {
  const { colors: themeColors } = useTheme();
  return themeColors[colorName];
}
