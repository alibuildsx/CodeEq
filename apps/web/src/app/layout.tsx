import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://codeeq.dev'),
  title: 'CodeEq — Balance your AI-built code',
  description:
    'Vibe Coding Doctor: Static project health scanner and diagnostics for AI-built applications. Detect security leaks, configuration bugs, undeclared packages, and deployment blockers before you ship.',
  keywords: [
    'codeeq',
    'vibe coding',
    'ai code quality',
    'code health',
    'security scanner',
    'static analysis',
    'deployment readiness',
    'nextjs',
    'typescript',
  ],
  authors: [{ name: 'CodeEq Team' }],
  openGraph: {
    title: 'CodeEq — Balance your AI-built code',
    description:
      'Static project health scanner and diagnostic doctor for AI-built applications. Pure static analysis, zero code execution.',
    url: 'https://codeeq.dev',
    siteName: 'CodeEq',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CodeEq — Balance your AI-built code',
    description:
      'Static project health scanner and diagnostic doctor for AI-built applications. Pure static analysis, zero code execution.',
  },
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
