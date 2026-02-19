import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import * as Localization from 'expo-localization';

// --- Types ---
type MessagePrimitive = string | number | boolean;
type MessageValue = MessagePrimitive | MessageValue[] | { [key: string]: MessageValue };
type Messages = Record<string, MessageValue>;
type TranslationParams = Record<string, string | number>;
type TranslateFn = (key: string, params?: TranslationParams) => string;
type Locale = 'ar' | 'en';

interface IntlContextValue {
  messages: Messages;
  locale: Locale;
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
}

const LOCALE_STORAGE_KEY = 'tawveeri-locale';

// --- Message Loading ---
// Static imports of all 19 translation namespaces for both locales
const arMessages: Record<string, Record<string, unknown>> = {
  common: require('../../../../messages/ar/common.json'),
  landing: require('../../../../messages/ar/landing.json'),
  auth: require('../../../../messages/ar/auth.json'),
  products: require('../../../../messages/ar/products.json'),
  dashboard: require('../../../../messages/ar/dashboard.json'),
  profile: require('../../../../messages/ar/profile.json'),
  stores: require('../../../../messages/ar/stores.json'),
  deals: require('../../../../messages/ar/deals.json'),
  product: require('../../../../messages/ar/product.json'),
  store: require('../../../../messages/ar/store.json'),
  search: require('../../../../messages/ar/search.json'),
  wishlist: require('../../../../messages/ar/wishlist.json'),
  compare: require('../../../../messages/ar/compare.json'),
  settings: require('../../../../messages/ar/settings.json'),
  notifications: require('../../../../messages/ar/notifications.json'),
  admin: require('../../../../messages/ar/admin.json'),
  checkout: require('../../../../messages/ar/checkout.json'),
  priceAlerts: require('../../../../messages/ar/priceAlerts.json'),
  cart: require('../../../../messages/ar/cart.json'),
};

const enMessages: Record<string, Record<string, unknown>> = {
  common: require('../../../../messages/en/common.json'),
  landing: require('../../../../messages/en/landing.json'),
  auth: require('../../../../messages/en/auth.json'),
  products: require('../../../../messages/en/products.json'),
  dashboard: require('../../../../messages/en/dashboard.json'),
  profile: require('../../../../messages/en/profile.json'),
  stores: require('../../../../messages/en/stores.json'),
  deals: require('../../../../messages/en/deals.json'),
  product: require('../../../../messages/en/product.json'),
  store: require('../../../../messages/en/store.json'),
  search: require('../../../../messages/en/search.json'),
  wishlist: require('../../../../messages/en/wishlist.json'),
  compare: require('../../../../messages/en/compare.json'),
  settings: require('../../../../messages/en/settings.json'),
  notifications: require('../../../../messages/en/notifications.json'),
  admin: require('../../../../messages/en/admin.json'),
  checkout: require('../../../../messages/en/checkout.json'),
  priceAlerts: require('../../../../messages/en/priceAlerts.json'),
  cart: require('../../../../messages/en/cart.json'),
};

function extractNamespace(data: Record<string, unknown>, key: string): Record<string, unknown> {
  if (typeof data[key] === 'object' && data[key] !== null) {
    return data[key] as Record<string, unknown>;
  }
  return data;
}

function buildMessages(localeFiles: Record<string, Record<string, unknown>>): Messages {
  const messages: Messages = {};

  // common.json: top-level keys spread directly, nested 'common' key becomes namespace
  const common = localeFiles.common || {};
  Object.entries(common).forEach(([key, value]) => {
    if (key === 'common' && typeof value === 'object' && value !== null) {
      (messages as Record<string, unknown>)['common'] = value;
    } else {
      (messages as Record<string, unknown>)[key] = value;
    }
  });

  // landing.json: spread directly (not namespaced)
  if (localeFiles.landing) {
    Object.entries(localeFiles.landing).forEach(([key, value]) => {
      (messages as Record<string, unknown>)[key] = value;
    });
  }

  // admin.json: uses extractNamespace for nested admin key
  if (localeFiles.admin) {
    (messages as Record<string, unknown>)['admin'] = extractNamespace(localeFiles.admin, 'admin');
  }

  // All other files are namespaced by filename
  const specialFiles = ['common', 'landing', 'admin'];
  Object.entries(localeFiles).forEach(([namespace, data]) => {
    if (!specialFiles.includes(namespace) && data) {
      (messages as Record<string, unknown>)[namespace] = data;
    }
  });

  return messages;
}

const allMessages: Record<Locale, Messages> = {
  ar: buildMessages(arMessages),
  en: buildMessages(enMessages),
};

// --- Helper ---
const isMessageObject = (value: unknown): value is Record<string, MessageValue> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// --- Context ---
const IntlContext = createContext<IntlContextValue>({
  messages: {},
  locale: 'ar',
  isRTL: true,
  setLocale: () => {},
});

// --- Provider ---
export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [ready, setReady] = useState(false);

  // Load saved locale on mount and sync RTL direction
  useEffect(() => {
    (async () => {
      let resolvedLocale: Locale = 'ar';
      try {
        const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved === 'ar' || saved === 'en') {
          resolvedLocale = saved;
        } else {
          const deviceLocale = Localization.getLocales()[0]?.languageCode;
          resolvedLocale = deviceLocale === 'en' ? 'en' : 'ar';
        }
      } catch {
        // Default Arabic
      }

      setLocaleState(resolvedLocale);

      // Ensure I18nManager.isRTL matches the locale.
      // If mismatched, force the correct direction and reload the app.
      const shouldBeRTL = resolvedLocale === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        I18nManager.allowRTL(shouldBeRTL);
        // Reload required for layout direction change to take effect
        try {
          const { DevSettings } = require('react-native');
          DevSettings?.reload?.();
        } catch {
          // Production: expo-updates reloadAsync or native restart needed
        }
        return; // Don't set ready — app is reloading
      }

      setReady(true);
    })();
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

    // Update RTL layout direction
    const shouldBeRTL = newLocale === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      I18nManager.allowRTL(shouldBeRTL);
      // Note: Requires app restart for full RTL change on Android
    }
  }, []);

  const value = useMemo<IntlContextValue>(() => ({
    messages: allMessages[locale],
    locale,
    isRTL: locale === 'ar',
    setLocale,
  }), [locale, setLocale]);

  if (!ready) return null;

  return (
    <IntlContext.Provider value={value}>
      {children}
    </IntlContext.Provider>
  );
}

// --- Hooks ---
export function useTranslations(): TranslateFn {
  const { messages } = useContext(IntlContext);

  return useCallback((key: string, params?: TranslationParams) => {
    if (!key || typeof key !== 'string') return key || '';

    const keys = key.split('.');
    let value: unknown = messages;

    for (const k of keys) {
      if (isMessageObject(value) && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      let result = String(value);
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          result = result.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
        });
      }
      return result;
    }

    return key;
  }, [messages]);
}

export function useLocale() {
  const { locale, isRTL, setLocale } = useContext(IntlContext);
  return { locale, isRTL, direction: isRTL ? 'rtl' : 'ltr', setLocale } as const;
}

export function useLocalizedField<T extends Record<string, unknown>>(
  item: T,
  field: string,
): string {
  const { locale } = useContext(IntlContext);
  const key = `${field}_${locale}`;
  const value = item[key];
  if (typeof value === 'string') return value;
  // Fallback to other locale
  const fallbackKey = `${field}_${locale === 'ar' ? 'en' : 'ar'}`;
  const fallback = item[fallbackKey];
  return typeof fallback === 'string' ? fallback : '';
}
