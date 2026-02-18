// src/components/layout/sidebar-nav.tsx
'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Gift,
  Play,
  FolderGit2,
  GitBranch,
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  Code2,
  Flame,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useGitData } from '@/context/git-data-provider';
import { useAppStore, selectSelectedRepos, selectHasSelectedRepos } from '@/stores/app-store';
import type { Repository, RepoFetchStatus } from '@/lib/types';

// =============================================================================
// TYPES
// =============================================================================

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  isActive?: boolean;
  isDisabled?: boolean;
  description?: string;
}

// =============================================================================
// QUICK LINKS
// =============================================================================

const QUICK_LINKS: SidebarItem[] = [
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

const ANALYTICS_SECTIONS: SidebarItem[] = [
  {
    label: 'Contribution Heatmap',
    href: '/dashboard#heatmap',
    icon: <Calendar className="h-4 w-4" />,
    description: 'Daily commit activity',
  },
  {
    label: 'Commit Frequency',
    href: '/dashboard#frequency',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Time-series analysis',
  },
  {
    label: 'Language Breakdown',
    href: '/dashboard#languages',
    icon: <Code2 className="h-4 w-4" />,
    description: 'Tech stack distribution',
  },
  {
    label: 'Coding Patterns',
    href: '/dashboard#patterns',
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'When you code best',
  },
  {
    label: 'Streaks',
    href: '/dashboard#streaks',
    icon: <Flame className="h-4 w-4" />,
    description: 'Consecutive commit days',
  },
  {
    label: 'Contributors',
    href: '/dashboard#contributors',
    icon: <Users className="h-4 w-4" />,
    description: 'Team activity breakdown',
  },
];

// =============================================================================
// HELPER: REPO STATUS INDICATOR
// =============================================================================

function RepoStatusDot({ status }: { status?: RepoFetchStatus }) {
  if (!status) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30"
        aria-label="Not fetched"
      />
    );
  }

  if (status.isFetching) {
    return (
      <Loader2
        className="h-3 w-3 shrink-0 animate-spin text-violet-400"
        aria-label="Fetching data"
      />
    );
  }

  if (status.error) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-red-500"
        aria-label="Fetch error"
      />
    );
  }

  if (status.commits) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
        aria-label="Data loaded"
      />
    );
  }

  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
      aria-label="Partially loaded"
    />
  );
}

// =============================================================================
// SIDEBAR SECTION COMPONENT
// =============================================================================

function SidebarSectionGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// =============================================================================
// SIDEBAR NAV ITEM
// =============================================================================

function SidebarNavItem({
  item,
  isActive,
  compact = false,
}: {
  item: SidebarItem;
  isActive: boolean;
  compact?: boolean;
}) {
  const content = (
    <Link
      href={item.isDisabled ? '#' : item.href}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-violet-500/10 text-violet-400'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        item.isDisabled && 'pointer-events-none opacity-40'
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={item.isDisabled}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
          isActive
            ? 'bg-violet-500/15 text-violet-400'
            : 'bg-transparent text-muted-foreground group-hover:text-foreground'
        )}
      >
        {item.icon}
      </span>
      {!compact && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-auto h-5 shrink-0 rounded-full px-1.5 text-[10px] font-semibold',
                isActive
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {item.badge}
            </Badge>
          )}
          {!item.badge && isActive && (
            <ChevronRight
              className="ml-auto h-3.5 w-3.5 shrink-0 text-violet-400/60"
              aria-hidden="true"
            />
          )}
        </>
      )}
    </Link>
  );

  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p className="font-medium">{item.label}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// =============================================================================
// MAIN SIDEBAR NAV COMPONENT
// =============================================================================

interface SidebarNavProps {
  /** Optional className override */
  className?: string;
  /** Compact mode (icon-only) for smaller viewports */
  compact?: boolean;
}

export function SidebarNav({ className, compact = false }: SidebarNavProps) {
  const pathname = usePathname();
  const {
    selectedRepositories,
    allRepositories,
    fetchStatus,
    commitsByRepo,
  } = useGitData();
  const selectedRepoIds = useAppStore(selectSelectedRepos);
  const hasSelectedRepos = useAppStore(selectHasSelectedRepos);

  const isActive = useCallback(
    (href: string) => {
      if (href.includes('#')) {
        const basePath = href.split('#')[0];
        return pathname === basePath || pathname.startsWith(basePath);
      }
      if (href === '/dashboard') return pathname === '/dashboard';
      return pathname.startsWith(href);
    },
    [pathname]
  );

  // Build repo items from selected repos
  const repoItems: (SidebarItem & {
    repo: Repository;
    status?: RepoFetchStatus;
  })[] = useMemo(() => {
    const repos = selectedRepositories.length > 0
      ? selectedRepositories
      : allRepositories.filter((r) => selectedRepoIds.includes(r.fullName));

    return repos.map((repo) => {
      const commitCount = commitsByRepo[repo.fullName]?.length ?? 0;
      const status = fetchStatus[repo.fullName];

      return {
        label: repo.name,
        href: `/repo/${encodeURIComponent(repo.fullName)}`,
        icon: <FolderGit2 className="h-4 w-4" />,
        badge: commitCount > 0 ? commitCount.toLocaleString() : undefined,
        description: repo.description || repo.fullName,
        repo,
        status,
      };
    });
  }, [
    selectedRepositories,
    allRepositories,
    selectedRepoIds,
    commitsByRepo,
    fetchStatus,
  ]);

  // Quick links with disabled state based on whether repos are selected
  const quickLinksWithState = useMemo(
    () =>
      QUICK_LINKS.map((link) => ({
        ...link,
        isDisabled:
          link.href !== '/dashboard' &&
          !hasSelectedRepos &&
          link.href !== '/wrapped',
      })),
    [hasSelectedRepos]
  );

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/40 bg-background/50',
        compact ? 'w-16' : 'w-64',
        className
      )}
      role="complementary"
      aria-label="Sidebar navigation"
    >
      <ScrollArea className="flex-1 px-2 py-4">
        <div className="space-y-6">
          {/* Quick Links */}
          <SidebarSectionGroup title={compact ? '' : 'Navigate'}>
            {quickLinksWithState.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                compact={compact}
              />
            ))}
          </SidebarSectionGroup>

          <Separator className="mx-3 bg-border/30" />

          {/* Repositories */}
          <SidebarSectionGroup title={compact ? '' : 'Repositories'}>
            {repoItems.length === 0 ? (
              <div className="px-3 py-4">
                {!compact && (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                      <GitBranch className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground/70">
                      No repositories selected
                    </p>
                    <Link href="/connect">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 h-7 text-xs"
                      >
                        Connect Repos
                        <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )}
                {compact && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/connect"
                          className="flex items-center justify-center rounded-lg px-3 py-2 text-muted-foreground/50 transition-colors hover:bg-accent/50 hover:text-foreground"
                        >
                          <GitBranch className="h-4 w-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        <p className="font-medium">Connect Repos</p>
                        <p className="text-xs text-muted-foreground">
                          No repositories selected
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : (
              repoItems.map((item) => (
                <div key={item.href} className="relative">
                  {compact ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                              isActive(item.href)
                                ? 'bg-violet-500/10 text-violet-400'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            )}
                            aria-current={
                              isActive(item.href) ? 'page' : undefined
                            }
                          >
                            <span className="relative">
                              {item.icon}
                              <span className="absolute -right-0.5 -top-0.5">
                                <RepoStatusDot status={item.status} />
                              </span>
                            </span>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <p className="font-medium">{item.label}</p>
                          {item.badge && (
                            <p className="text-xs text-muted-foreground">
                              {item.badge} commits
                            </p>
                          )}
                          {item.repo.language && (
                            <p className="text-xs text-muted-foreground">
                              {item.repo.language}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                        isActive(item.href)
                          ? 'bg-violet-500/10 text-violet-400'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                          isActive(item.href)
                            ? 'bg-violet-500/15 text-violet-400'
                            : 'bg-transparent text-muted-foreground group-hover:text-foreground'
                        )}
                      >
                        {item.icon}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{item.label}</span>
                        {item.repo.language && (
                          <span className="truncate text-[10px] text-muted-foreground/60">
                            {item.repo.language}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <RepoStatusDot status={item.status} />
                        {item.badge !== undefined && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              'h-5 rounded-full px-1.5 text-[10px] font-semibold',
                              isActive(item.href)
                                ? 'bg-violet-500/20 text-violet-300'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  )}
                </div>
              ))
            )}

            {/* Show count if there are repos */}
            {repoItems.length > 0 && !compact && (
              <div className="px-3 pt-1">
                <p className="text-[10px] text-muted-foreground/50">
                  {repoItems.length} repositor{repoItems.length === 1 ? 'y' : 'ies'} selected
                </p>
              </div>
            )}
          </SidebarSectionGroup>

          {/* Analytics sections — only show when repos are selected and not in compact mode */}
          {hasSelectedRepos && (
            <>
              <Separator className="mx-3 bg-border/30" />

              <SidebarSectionGroup title={compact ? '' : 'Analytics'}>
                {ANALYTICS_SECTIONS.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={isActive(item.href)}
                    compact={compact}
                  />
                ))}
              </SidebarSectionGroup>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Sidebar footer — connect more repos */}
      {!compact && hasSelectedRepos && (
        <div className="border-t border-border/30 px-3 py-3">
          <Link href="/connect">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Manage Repositories
            </Button>
          </Link>
        </div>
      )}
    </aside>
  );
}
