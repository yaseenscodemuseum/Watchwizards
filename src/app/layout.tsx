import './globals.css';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'WatchWizards',
  description: 'Let the magic find your perfect movie',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.cdnfonts.com/css/chetkiy"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body>
        <a href="https://yaseensportfolio.vercel.app" target="_blank" rel="noopener noreferrer" className="site-logo">
          <img src="/background/logo.svg" alt="WatchWizards" />
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
} 