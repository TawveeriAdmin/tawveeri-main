import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'توفيري - Tawveeri | منصة مقارنة الأسعار - Price Comparison',
  description:
    'أفضل الأسعار للإلكترونيات في السعودية - Find the best deals on electronics in Saudi Arabia',
  keywords:
    'price comparison, saudi arabia, electronics, deals, توفيري, مقارنة أسعار',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
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
