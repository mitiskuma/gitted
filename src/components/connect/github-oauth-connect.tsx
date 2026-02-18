'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { GitHubOAuthConnectProps } from '@/lib/types';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className || ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function GitHubOAuthConnect({
  isConnected,
  user,
  onConnect,
  onDisconnect,
  isConnecting,
}: GitHubOAuthConnectProps) {
  const handleConnect = useCallback(() => {
    onConnect();
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
  }, [onDisconnect]);

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
      {/* Decorative gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1e2327]/5 via-transparent to-[#663399]/5" />

      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e2327] text-white">
            <GitHubIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Connect GitHub</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Authorize access to your repositories and commit history
            </CardDescription>
          </div>
          {isConnected && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            >
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {!isConnected ? (
          <>
            {/* Permissions info */}
            <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldIcon className="h-4 w-4 text-[#3178c6]" />
                Permissions requested
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3178c6]" />
                  <span>
                    <strong className="text-foreground/80">repo</strong> — Read access to public and
                    private repositories
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3178c6]" />
                  <span>
                    <strong className="text-foreground/80">read:user</strong> — Read your profile
                    information
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#663399]" />
                  <span>
                    <strong className="text-foreground/80">read:org</strong> — Read organization
                    membership for org repos
                  </span>
                </li>
              </ul>
            </div>

            {/* Connect button */}
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-[#1e2327] text-white hover:bg-[#1e2327]/80 disabled:opacity-50"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4" />
                  Redirecting to GitHub...
                </>
              ) : (
                <>
                  <GitHubIcon className="mr-2 h-5 w-5" />
                  Connect with GitHub
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground/70">
              You&apos;ll be redirected to GitHub to authorize. We never store your password.
            </p>
          </>
        ) : user ? (
          <>
            {/* Connected user profile */}
            <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
              <div className="relative">
                <Image
                  src={user.avatarUrl}
                  alt={user.name || user.login}
                  width={56}
                  height={56}
                  className="rounded-full ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background"
                />
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                  <CheckCircleIcon className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {user.name || user.login}
                  </h3>
                </div>
                <p className="truncate text-sm text-muted-foreground">@{user.login}</p>
                {user.bio && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
                    {user.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Repo stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/10 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#3178c6]/10">
                  <GlobeIcon className="h-4 w-4 text-[#3178c6]" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none text-foreground tabular-nums">
                    {user.publicRepos}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Public repos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/10 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#663399]/10">
                  <LockIcon className="h-4 w-4 text-[#663399]" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none text-foreground tabular-nums">
                    {Math.max(0, user.totalRepos - user.publicRepos)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Private repos</p>
                </div>
              </div>
            </div>

            {/* Additional user info */}
            {(user.company || user.location) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {user.company && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M3 21h18M3 7v14m0-14l9-4 9 4M9 21V11m6 10V11M3 7h18" />
                    </svg>
                    {user.company}
                  </span>
                )}
                {user.location && (
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {user.location}
                  </span>
                )}
              </div>
            )}

            <Separator className="opacity-50" />

            {/* Disconnect */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Member since{' '}
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <LogOutIcon className="mr-1.5 h-3 w-3" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          /* Connected but user data not loaded yet */
          <div className="flex items-center justify-center py-6">
            <LoaderIcon className="mr-2 h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading profile...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
