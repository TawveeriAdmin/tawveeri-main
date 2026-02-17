import type { Metadata } from 'next';
import './globals.css';

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
 // The locale layout provides the html and body tags
 // This root layout just passes through children
 return <>{children}</>;
}
