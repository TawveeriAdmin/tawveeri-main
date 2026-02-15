'use client';

import { createContext, useContext, useMemo } from 'react';

type MessagePrimitive = string | number | boolean;
type MessageValue = MessagePrimitive | MessageValue[] | { [key: string]: MessageValue };
type Messages = Record<string, MessageValue>;

const isMessageObject = (value: unknown): value is Record<string, MessageValue> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

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
  messages?: Record<string, unknown>;
  locale?: string;
}) {
  // Normalize inputs - ensure they're always valid
  const normalizedMessages = useMemo(() => {
    if (!messages || typeof messages !== 'object') {
      return {} as Messages;
    }
    // Deep clone to ensure it's a plain object (helps with Chrome serialization)
    try {
      return JSON.parse(JSON.stringify(messages)) as Messages;
    } catch {
      return messages as Messages;
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

export function useTranslations(): (key: string) => string {
  const context = useContext(IntlContext);
  
  // Safety check - ensure context exists
  if (!context) {
    console.warn('useTranslations called outside of SimpleIntlProvider');
    return (key: string) => key;
  }

  const { messages = {} } = context;

  return (key: string, params?: Record<string, string | number>) => {
    if (!key || typeof key !== 'string') {
      return key || '';
    }

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
      
      // Simple placeholder replacement: {{key}}
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          result = result.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
        });
      }
      
      return result;
    }

    return key;
  };
}
