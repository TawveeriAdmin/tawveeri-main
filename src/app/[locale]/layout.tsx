import { notFound } from 'next/navigation';
import { SimpleIntlProvider } from '@/lib/simple-intl-provider';

const locales = ['ar', 'en'] as const;
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from '../providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';

// English font
const inter = Inter({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Arabic font
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  weight: ['400', '500', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

// Removed generateStaticParams - next-intl plugin handles this

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Await params (Next.js 15+ requirement)
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Load messages directly
  const [common, landing] = await Promise.all([
    import(`../../../messages/${locale}/common.json`),
    import(`../../../messages/${locale}/landing.json`),
  ]);

  const messages = {
    ...common.default,
    ...landing.default,
  };

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning className="">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Tailwind uses 'dark' class for dark mode
                // NO CLASS = light mode (Tailwind default)
                const theme = localStorage.getItem('tawveeri-theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  // Light mode = remove dark class (don't add 'light' class!)
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${ibmPlexArabic.variable} ${
          locale === 'ar' ? 'font-sans-ar' : 'font-sans'
        } antialiased`}
      >
        <SimpleIntlProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            forcedTheme={undefined}
            storageKey="tawveeri-theme"
            disableTransitionOnChange={false}
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </SimpleIntlProvider>
      </body>
    </html>
  );
}
