'use client';

import { createContext, useContext } from 'react';

type Messages = Record<string, any>;

const IntlContext = createContext<{ messages: Messages; locale: string }>({
  messages: {},
  locale: 'ar',
});

export function SimpleIntlProvider({
  children,
  messages,
  locale,
}: {
  children: React.ReactNode;
  messages: Messages;
  locale: string;
}) {
  return (
    <IntlContext.Provider value={{ messages, locale }}>
      {children}
    </IntlContext.Provider>
  );
}

export function useTranslations() {
  const { messages } = useContext(IntlContext);

  return (key: string) => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };
}
