'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Repository } from '@/lib/types';

interface RepoSelectorTabsProps {
  repositories: Repository[];
  activeRepoId: string | null;
  onRepoChange: (repoId: string | null) => void;
  repoColors: Map<string, string>;
}

/** Tab bar for switching between combined and individual repository views. */
export function RepoSelectorTabs({
  repositories,
  activeRepoId,
  onRepoChange,
  repoColors,
}: RepoSelectorTabsProps) {
  const currentValue = activeRepoId ?? '__all__';

  const handleValueChange = useCallback(
    (value: string) => {
      onRepoChange(value === '__all__' ? null : value);
    },
    [onRepoChange],
  );

  const getRepoDisplayName = (repo: Repository): string => {
    return repo.name || repo.fullName.split('/').pop() || repo.fullName;
  };

  const getRepoColor = (repoId: string): string => {
    return repoColors.get(repoId) || '#60a5fa';
  };

  if (repositories.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <span className="hidden shrink-0 text-xs font-medium tracking-wider text-white/40 uppercase sm:block">
          View
        </span>

        <div className="w-full min-w-0 overflow-x-auto scrollbar-none">
          <Tabs
            value={currentValue}
            onValueChange={handleValueChange}
            className="w-full"
          >
            <TabsList className="inline-flex h-auto w-max gap-1 rounded-lg border-none bg-white/[0.04] p-1">
              {/* All Repos tab */}
              <TabsTrigger
                value="__all__"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  'data-[state=inactive]:text-white/50 data-[state=inactive]:hover:bg-white/[0.06] data-[state=inactive]:hover:text-white/70',
                  'data-[state=active]:bg-white/[0.1] data-[state=active]:text-white data-[state=active]:shadow-sm',
                )}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full',
                      currentValue === '__all__'
                        ? 'animate-ping bg-white/30'
                        : '',
                    )}
                  />
                  <span
                    className="relative inline-flex h-2.5 w-2.5 rounded-full"
                    style={{
                      background:
                        'conic-gradient(#60a5fa, #f97316, #a78bfa, #34d399, #60a5fa)',
                    }}
                  />
                </span>
                <span className="whitespace-nowrap">All Repos</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-4 min-w-[1rem] rounded-full px-1.5 text-[10px] font-semibold leading-none',
                    currentValue === '__all__'
                      ? 'bg-white/15 text-white'
                      : 'bg-white/[0.06] text-white/40',
                  )}
                >
                  {repositories.length}
                </Badge>
              </TabsTrigger>

              {/* Separator */}
              {repositories.length > 0 && (
                <div className="mx-0.5 h-5 w-px shrink-0 bg-white/[0.08]" />
              )}

              {/* Individual repo tabs */}
              {repositories.map((repo) => {
                const color = getRepoColor(repo.fullName);
                const isActive = currentValue === repo.fullName;
                const displayName = getRepoDisplayName(repo);

                return (
                  <TabsTrigger
                    key={repo.fullName}
                    value={repo.fullName}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                      'data-[state=inactive]:text-white/50 data-[state=inactive]:hover:bg-white/[0.06] data-[state=inactive]:hover:text-white/70',
                      'data-[state=active]:text-white data-[state=active]:shadow-sm',
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor: `${color}20`,
                            boxShadow: `0 0 12px ${color}15`,
                          }
                        : undefined
                    }
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {isActive && (
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span
                        className="relative inline-flex h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: color }}
                      />
                    </span>

                    <span className="max-w-[120px] truncate whitespace-nowrap sm:max-w-[160px]">
                      {displayName}
                    </span>

                    {repo.language && (
                      <span
                        className={cn(
                          'hidden text-[10px] lg:inline-block',
                          isActive ? 'text-white/50' : 'text-white/30',
                        )}
                      >
                        {repo.language}
                      </span>
                    )}

                    {repo.commitCount != null && repo.commitCount > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'hidden h-4 min-w-[1rem] rounded-full px-1.5 text-[10px] font-semibold leading-none md:inline-flex',
                          isActive
                            ? 'text-white'
                            : 'bg-white/[0.06] text-white/40',
                        )}
                        style={
                          isActive
                            ? { backgroundColor: `${color}30` }
                            : undefined
                        }
                      >
                        {repo.commitCount > 999
                          ? `${(repo.commitCount / 1000).toFixed(1)}k`
                          : repo.commitCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Active repo info bar */}
      {activeRepoId && (
        <div className="flex items-center gap-3 border-t border-white/[0.04] px-4 py-1.5">
          {(() => {
            const repo = repositories.find((r) => r.fullName === activeRepoId);
            if (!repo) return null;
            const color = getRepoColor(activeRepoId);

            return (
              <>
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-white/40">
                  <span className="text-white/60">{repo.fullName}</span>
                  {repo.description && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span className="max-w-[300px] truncate">
                        {repo.description}
                      </span>
                    </>
                  )}
                </span>
                {repo.starCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-white/30">
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {repo.starCount >= 1000
                      ? `${(repo.starCount / 1000).toFixed(1)}k`
                      : repo.starCount}
                  </span>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
