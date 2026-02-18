import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const fontVariables = `${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`;

export const fonts = {
  inter,
  spaceGrotesk,
  jetbrainsMono,
} as const;

export const fontClassNames = {
  body: inter.className,
  heading: spaceGrotesk.className,
  mono: jetbrainsMono.className,
} as const;
