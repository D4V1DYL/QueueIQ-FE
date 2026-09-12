import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
const sans = Inter({ variable: '--font-inter', subsets: ['latin'] });
const mono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});
export const metadata: Metadata = {
  title: 'QueueIQ - AI-Powered Smart Checkout',
  description:
    'Basket-aware checkout intelligence: YOLOv8 overhead detection, basket-fullness classification, online-learning wait prediction, and real-time lane signals.',
  icons: { icon: '/queueiq-logo.jpg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
