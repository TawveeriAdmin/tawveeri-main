import { SimpleIntlProvider } from '@/lib/simple-intl-provider';
import { ThemeProvider } from 'next-themes';

export default async function AuthLayout({
 children,
 params,
}: {
 children: React.ReactNode;
 params: Promise<{ locale: string }>;
}) {
 const { locale } = await params;

 // Load messages
 const commonMessages = (await import(`../../../../messages/${locale}/common.json`)).default;
 const authMessages = (await import(`../../../../messages/${locale}/auth.json`)).default;
 const messages = { ...commonMessages, ...authMessages };

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
