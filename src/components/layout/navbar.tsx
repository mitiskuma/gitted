// src/components/layout/navbar.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  GitBranch,
  Github,
  Menu,
  Home,
  Link2,
  LayoutDashboard,
  BookOpen,
  Gift,
  Play,
  Zap,
  LogOut,
  User,
  Settings,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import type { GitHubUser } from '@/lib/types';

// ---------------------------------------------------------------------------
// Nav item definitions
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    description: 'Analytics overview',
  },
  {
    label: 'Story',
    href: '/story',
    icon: <BookOpen className="h-4 w-4" />,
    description: 'AI-generated narrative',
  },
  {
    label: 'Wrapped',
    href: '/wrapped',
    icon: <Gift className="h-4 w-4" />,
    description: 'Year in review',
  },
  {
    label: 'Gource',
    href: '/gource',
    icon: <Play className="h-4 w-4" />,
    description: 'Repository visualization',
  },
];

// All pages including landing & connect (used in mobile drawer)
const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-4 w-4" />,
    description: 'Landing page',
  },
  {
    label: 'Connect',
    href: '/connect',
    icon: <Link2 className="h-4 w-4" />,
    description: 'Connect your repos',
  },
  ...NAV_ITEMS,
];

// ---------------------------------------------------------------------------
// User Avatar Dropdown
// ---------------------------------------------------------------------------

function UserAvatarDropdown({ user }: { user: GitHubUser }) {
  const { logout, disconnectGitHub } = useAuth();

  const initials = (user.name || user.login || 'U')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative flex h-9 items-center gap-2 rounded-full px-2 transition-colors hover:bg-accent/50"
          aria-label={`User menu for ${user.login}`}
        >
          <Avatar className="h-7 w-7 border border-border/50">
            <AvatarImage
              src={user.avatarUrl}
              alt={user.login}
            />
            <AvatarFallback className="bg-violet-600 text-xs font-medium text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground lg:inline-block">
            {user.login}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:inline-block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center gap-3 py-3">
          <Avatar className="h-9 w-9 border border-border/50">
            <AvatarImage src={user.avatarUrl} alt={user.login} />
            <AvatarFallback className="bg-violet-600 text-xs font-medium text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">
              {user.name || user.login}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              @{user.login}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={user.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            GitHub Profile
            <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={disconnectGitHub}
          className="flex items-center gap-2 text-muted-foreground focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Disconnect GitHub
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={logout}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { isGitHubConnected, githubUser } = useAuth();

  // Track scroll position for backdrop blur intensity
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      return pathname.startsWith(href);
    },
    [pathname]
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        isScrolled
          ? 'border-b border-border/40 bg-background/80 backdrop-blur-xl shadow-sm'
          : 'bg-background/60 backdrop-blur-sm'
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ── Logo ───────────────────────────────────────────────────── */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          aria-label="gitted — Home"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 shadow-md shadow-violet-500/20 transition-transform duration-200 group-hover:scale-105">
            <GitBranch className="h-5 w-5 text-white" />
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 opacity-0 blur transition-opacity duration-300 group-hover:opacity-40" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              gitted
            </span>
          </span>
        </Link>

        {/* ── Desktop Navigation ─────────────────────────────────────── */}
        <nav
          className="hidden items-center gap-1 md:flex"
          role="navigation"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
              {isActive(item.href) && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </nav>

        {/* ── Right side: ThemeToggle, User, CTA, Mobile ─────────────── */}
        <div className="flex items-center gap-3">
          {/* GitHub repo link */}
          <a
            href="https://github.com/mitiskuma/gitted"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground sm:flex"
            aria-label="View source on GitHub"
          >
            <Github className="h-[18px] w-[18px]" />
          </a>

          {/* User avatar dropdown OR Play Now CTA */}
          {isGitHubConnected && githubUser ? (
            <UserAvatarDropdown user={githubUser} />
          ) : (
            <Link href="/connect" className="hidden sm:block">
              <Button
                size="sm"
                className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
              >
                <Zap className="mr-1.5 h-4 w-4" />
                Play Now
                <span
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] animate-[shimmer_3s_infinite]"
                  aria-hidden="true"
                />
              </Button>
            </Link>
          )}

          {/* ── Mobile Hamburger ─────────────────────────────────────── */}
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="h-9 w-9"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 border-l border-border/50 bg-background/95 backdrop-blur-xl p-0"
            >
              <SheetHeader className="border-b border-border/40 px-6 py-5">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700">
                      <GitBranch className="h-4 w-4 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-lg font-bold text-transparent">
                      gitted
                    </span>
                  </SheetTitle>
                </div>
              </SheetHeader>

              {/* Connected user info in mobile */}
              {isGitHubConnected && githubUser && (
                <div className="border-b border-border/40 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage
                        src={githubUser.avatarUrl}
                        alt={githubUser.login}
                      />
                      <AvatarFallback className="bg-violet-600 text-sm font-medium text-white">
                        {(githubUser.name || githubUser.login || 'U')
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {githubUser.name || githubUser.login}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{githubUser.login}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <nav
                className="flex flex-col gap-1 px-4 py-4"
                role="navigation"
                aria-label="Mobile navigation"
              >
                {ALL_NAV_ITEMS.map((item, index) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-violet-500/10 text-violet-400 shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                          isActive(item.href)
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'bg-muted/50 text-muted-foreground'
                        )}
                      >
                        {item.icon}
                      </div>
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground/70">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {isActive(item.href) && (
                        <div
                          className="ml-auto h-2 w-2 rounded-full bg-violet-500"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </SheetClose>
                ))}

                {/* Mobile Play Now CTA */}
                <div className="mt-4 px-2">
                  <SheetClose asChild>
                    <Link href="/connect" className="block">
                      <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25">
                        <Zap className="mr-2 h-4 w-4" />
                        Play Now
                      </Button>
                    </Link>
                  </SheetClose>
                </div>
              </nav>

              {/* Mobile menu footer */}
              <div className="absolute bottom-0 left-0 right-0 border-t border-border/40 px-6 py-4">
                <p className="text-center text-xs text-muted-foreground/60">
                  Your git story, visualized.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
