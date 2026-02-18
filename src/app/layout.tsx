// src/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/auth-provider';
import { GitDataProvider } from '@/context/git-data-provider';
import { LayoutShell } from '@/components/layout/layout-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'gitted — Your Git Story, Visualized',
    template: '%s | gitted',
  },
  description:
    'Transform your GitHub repositories into stunning visual stories. Generate Spotify Wrapped-style summaries, animated Gource visualizations, and AI-powered developer narratives.',
  keywords: [
    'git',
    'github',
    'visualization',
    'gource',
    'developer',
    'wrapped',
    'story',
    'analytics',
    'commits',
    'repository',
  ],
  authors: [{ name: 'gitted' }],
  openGraph: {
    title: 'gitted — Your Git Story, Visualized',
    description:
      'Transform your GitHub repositories into stunning visual stories. Discover patterns, celebrate milestones, and share your developer journey.',
    type: 'website',
    siteName: 'gitted',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'gitted — Your Git Story, Visualized',
    description:
      'Transform your GitHub repositories into stunning visual stories.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <GitDataProvider>
              <LayoutShell>{children}</LayoutShell>
            </GitDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
