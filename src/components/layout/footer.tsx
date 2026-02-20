'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GitBranch, Github, Heart, Copy, Check } from 'lucide-react';

const CRYPTO_ADDRESSES = [
  {
    label: 'Bitcoin',
    sublabel: 'BTC',
    address: 'bc1qqtm9dujmu8qekzymm6eyf37g4h6ft26s0szjk2',
  },
  {
    label: 'EVM',
    sublabel: 'ETH / Base / Polygon / etc.',
    address: '0xD9476B6E6f138dd40dEF14b64d7D5D6924a25442',
  },
  {
    label: 'Solana',
    sublabel: 'SOL / SPL tokens',
    address: 'B4U8S9Ug2qVJvyWdNfqTeoUN8Xi73Ke7QhjYupWGqkEX',
  },
];

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Wrapped', href: '/wrapped' },
  { label: 'Story', href: '/story' },
  { label: 'Gource', href: '/gource' },
];

function CryptoAddress({ label, sublabel, address }: { label: string; sublabel: string; address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
      <div className="flex-shrink-0">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="ml-1.5 text-[10px] text-muted-foreground/60">{sublabel}</span>
      </div>
      <code className="flex-1 truncate text-[11px] text-muted-foreground/80 font-mono">
        {address}
      </code>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
        aria-label={`Copy ${label} address`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t border-border/40 bg-background/80 backdrop-blur-sm"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Brand + nav */}
          <div className="lg:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
              aria-label="gitted — Home"
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 shadow-md shadow-violet-500/20">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                gitted
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Transform your GitHub activity into visual stories, wrapped stats, and
              Gource-style visualizations.
            </p>

            {/* Nav links — inline */}
            <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* GitHub links */}
            <div className="mt-4 flex flex-col gap-1.5">
              <a
                href="https://github.com/mitiskuma/gitted"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <Github className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open source on GitHub</span>
              </a>
              <span className="pl-5.5 text-xs text-muted-foreground/40">
                Powered by the{' '}
                <a
                  href="https://docs.github.com/en/rest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 transition-colors hover:text-muted-foreground/60"
                >
                  GitHub API
                </a>
              </span>
            </div>
          </div>

          {/* Support / Donate */}
          <div className="lg:col-span-7">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Heart className="h-3.5 w-3.5 text-pink-500" />
              Support gitted
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              gitted is free and open. If you find it useful, consider sending a tip.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {CRYPTO_ADDRESSES.map((addr) => (
                <CryptoAddress key={addr.label} {...addr} />
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-8 border-t border-border/40" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 pt-5 sm:flex-row">
          <p className="text-xs text-muted-foreground/60">
            &copy; {currentYear} gitted
          </p>
          <div className="flex items-center gap-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              Built with
              <Heart
                className="h-3 w-3 fill-red-500 text-red-500"
                aria-label="love"
              />
              for developers
            </p>
            <a
              href="https://github.com/mitiskuma/gitted"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
              aria-label="GitHub repository"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
