import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './providers/theme-provider';
import { LocaleProvider } from './providers/locale-provider';
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

export const metadata: Metadata = {
  title: 'توفيري - Tawveeri | منصة مقارنة الأسعار - Price Comparison',
  description: 'أفضل الأسعار للإلكترونيات في السعودية - Find the best deals on electronics in Saudi Arabia',
  keywords: 'price comparison, saudi arabia, electronics, deals, توفيري, مقارنة أسعار',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexArabic.variable} font-sans-ar antialiased`}
      >
        <LocaleProvider>
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
        </LocaleProvider>
      </body>
    </html>
  );
}
