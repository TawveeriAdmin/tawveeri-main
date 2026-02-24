import type { Metadata } from 'next';
import './globals.css';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'توفيري - Tawveeri | منصة مقارنة الأسعار',
    template: '%s | توفيري Tawveeri',
  },
  description:
    'أفضل الأسعار للإلكترونيات في السعودية - Find the best deals on electronics in Saudi Arabia',
  keywords:
    'price comparison, saudi arabia, electronics, deals, توفيري, مقارنة أسعار, السعودية, إلكترونيات',
  openGraph: {
    type: 'website',
    siteName: 'توفيري Tawveeri',
    locale: 'ar_SA',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('tawveeri-theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
