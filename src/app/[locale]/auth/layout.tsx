import type { Metadata } from 'next';
import { SimpleIntlProvider } from '@/lib/simple-intl-provider';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({
 children,
 params,
}: {
 children: React.ReactNode;
 params: Promise<{ locale: string }>;
}) {
 const { locale } = await params;

 // Load messages
 const commonMessages = (await import(`../../../../messages/${locale}/common.json`)).default as Record<string, unknown>;
 const authMessages = (await import(`../../../../messages/${locale}/auth.json`)).default as Record<string, unknown>;

 // Keep common top-level keys (app/nav/button...) and expose auth under `auth.*`
 const commonNested = commonMessages.common as Record<string, unknown> | undefined;
 const commonTopLevel = { ...commonMessages };
 delete commonTopLevel.common;
 const messages = {
  ...commonTopLevel,
  ...(commonNested ? { common: commonNested } : {}),
  auth: authMessages,
 };

 return (
 <SimpleIntlProvider messages={messages} locale={locale}>
 <ThemeProvider
 attribute="class"
 defaultTheme="light"
 enableSystem={false}
 storageKey="tawveeri-theme"
 >
 {children}
 </ThemeProvider>
 </SimpleIntlProvider>
 );
}
