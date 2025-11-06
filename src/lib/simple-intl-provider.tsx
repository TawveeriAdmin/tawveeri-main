'use client';

import { createContext, useContext, useMemo } from 'react';

type Messages = Record<string, any>;

const IntlContext = createContext<{ messages: Messages; locale: string }>({
  messages: {},
  locale: 'ar',
});

export function SimpleIntlProvider({
  children,
  messages = {},
  locale = 'ar',
}: {
  children: React.ReactNode;
  messages?: Messages;
  locale?: string;
}) {
  // Normalize inputs - ensure they're always valid
  const normalizedMessages = useMemo(() => {
    if (!messages || typeof messages !== 'object') {
      return {};
    }
    // Deep clone to ensure it's a plain object (helps with Chrome serialization)
    try {
      return JSON.parse(JSON.stringify(messages));
    } catch {
      return messages;
    }
  }, [messages]);

  const normalizedLocale = useMemo(() => {
    return typeof locale === 'string' && locale ? locale : 'ar';
  }, [locale]);

  // Memoize the context value to prevent unnecessary re-renders
  // This is stable across navigation in Chrome
  const value = useMemo(
    () => ({
      messages: normalizedMessages,
      locale: normalizedLocale,
    }),
    [normalizedMessages, normalizedLocale]
  );

  return (
    <IntlContext.Provider value={value}>
      {children}
    </IntlContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(IntlContext);
  
  // Safety check - ensure context exists
  if (!context) {
    console.warn('useTranslations called outside of SimpleIntlProvider');
    return (key: string) => key;
  }

  const { messages = {} } = context;

  return (key: string) => {
    if (!key || typeof key !== 'string') {
      return key || '';
    }

    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    return value || key;
  };
}
