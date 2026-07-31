import type { Metadata } from 'next';
import './globals.css';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  icons: {
    icon: '/logos/Tawveeri.png',
    apple: '/logos/Tawveeri.png',
  },
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
    <html lang="ar" dir="rtl" suppressHydrationWarning>
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
              /* P2-7 (3.1.1 + RTL correctness). This layout is above the [locale] segment,
                 so it cannot read the locale param and shipped a hardcoded lang="ar" on
                 EVERY page — measured: /en served <html lang="ar">, so a screen reader
                 announced English copy in an Arabic voice. <html> also carried no dir at
                 all, which matters beyond a11y: Radix portals mount into document.body,
                 OUTSIDE the [locale] wrapper that holds dir, which is why the header menu
                 has to set direction by hand.
                 Corrected here from the URL before first paint, so the accessibility tree
                 is built from the right value. The SERVED bytes still say ar for /en — the
                 real fix is the root layout owning the locale, which needs the root-shell
                 restructure already recorded as a roadmap prerequisite. Recorded, not
                 quietly widened into this ticket. */
              try {
                var seg = location.pathname.split('/')[1];
                if (seg === 'en' || seg === 'ar') {
                  document.documentElement.lang = seg;
                  document.documentElement.dir = seg === 'ar' ? 'rtl' : 'ltr';
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
