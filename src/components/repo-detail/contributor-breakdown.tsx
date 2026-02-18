'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  GitCommit,
  Plus,
  Minus,
  Users,
} from 'lucide-react';
import type { Contributor, CommitData } from '@/lib/types';

interface ContributorWithTimeline extends Contributor {
  /** Monthly commit counts for timeline: { "2024-01": 15, "2024-02": 22, ... } */
  monthlyCommits?: Record<string, number>;
  /** Percentage of total commits */
  percentage: number;
}

interface ContributorBreakdownProps {
  contributors: Contributor[];
  commits: CommitData[];
  totalCommits: number;
}

function buildContributorTimelines(
  contributors: Contributor[],
  commits: CommitData[],
  totalCommits: number
): ContributorWithTimeline[] {
  const commitsByContributor: Record<string, Record<string, number>> = {};

  for (const commit of commits) {
    const key = commit.author.login || commit.author.email || commit.author.name;
    if (!commitsByContributor[key]) {
      commitsByContributor[key] = {};
    }
    const monthKey = `${commit.year}-${String(commit.month).padStart(2, '0')}`;
    commitsByContributor[key][monthKey] =
      (commitsByContributor[key][monthKey] || 0) + 1;
  }

  return contributors
    .map((c) => {
      const key = c.login || c.email || c.name;
      return {
        ...c,
        monthlyCommits: commitsByContributor[key] || {},
        percentage:
          totalCommits > 0
            ? Math.round((c.totalCommits / totalCommits) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.totalCommits - a.totalCommits);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MiniTimeline({
  monthlyCommits,
  maxCount,
}: {
  monthlyCommits: Record<string, number>;
  maxCount: number;
}) {
  const months = Object.entries(monthlyCommits).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (months.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No timeline data available
      </p>
    );
  }

  const barMax = Math.max(...months.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span>{months[0][0]}</span>
        <span className="flex-1 border-t border-dashed border-muted-foreground/30" />
        <span>{months[months.length - 1][0]}</span>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {months.map(([month, count]) => {
          const height = Math.max((count / barMax) * 100, 4);
          const intensity = maxCount > 0 ? count / maxCount : 0;
          return (
            <div
              key={month}
              className="group relative flex-1 min-w-[3px] max-w-[12px] rounded-t-sm transition-all duration-200 hover:opacity-80"
              style={{
                height: `${height}%`,
                background: `linear-gradient(to top, hsl(${210 + intensity * 60}, 80%, ${40 + intensity * 25}%), hsl(${210 + intensity * 60}, 90%, ${55 + intensity * 20}%))`,
              }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none border border-border">
                {month}: {count} commits
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContributorRow({
  contributor,
  rank,
  maxCommits,
  isExpanded,
  onToggle,
}: {
  contributor: ContributorWithTimeline;
  rank: number;
  maxCommits: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const barWidth =
    maxCommits > 0
      ? Math.max((contributor.totalCommits / maxCommits) * 100, 2)
      : 0;

  const netLines = contributor.totalAdditions - contributor.totalDeletions;

  return (
    <div
      className={`rounded-lg border transition-all duration-300 ${
        isExpanded
          ? 'border-primary/30 bg-primary/5 shadow-md'
          : 'border-border/50 bg-card hover:border-border hover:bg-accent/5'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-3 sm:p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <span
              className={`text-xs font-bold ${
                rank <= 3 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {rank}
            </span>
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0">
            {contributor.avatarUrl ? (
              <img
                src={contributor.avatarUrl}
                alt={contributor.name}
                className="w-9 h-9 rounded-full border-2 border-border/50"
                loading="lazy"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/60 to-secondary/60 flex items-center justify-center text-white font-semibold text-sm">
                {contributor.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name & login */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {contributor.name}
              </span>
              {contributor.login && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 hidden sm:inline-flex"
                >
                  @{contributor.login}
                </Badge>
              )}
            </div>

            {/* Horizontal bar */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    background:
                      rank === 1
                        ? 'linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd)'
                        : rank === 2
                          ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                          : rank === 3
                            ? 'linear-gradient(90deg, #06b6d4, #67e8f9)'
                            : 'linear-gradient(90deg, hsl(215, 50%, 45%), hsl(215, 50%, 60%))',
                  }}
                />
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground font-mono w-12 text-right">
                {contributor.percentage}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <GitCommit className="w-3.5 h-3.5 text-muted-foreground" />
                {formatNumber(contributor.totalCommits)}
              </div>
              <span className="text-[10px] text-muted-foreground">commits</span>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="flex items-center gap-0.5 text-green-400">
                  <Plus className="w-3 h-3" />
                  {formatNumber(contributor.totalAdditions)}
                </span>
                <span className="flex items-center gap-0.5 text-red-400">
                  <Minus className="w-3 h-3" />
                  {formatNumber(contributor.totalDeletions)}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono ${
                  netLines >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                }`}
              >
                net {netLines >= 0 ? '+' : ''}
                {formatNumber(netLines)}
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <div className="flex-shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="flex items-center gap-4 mt-2 md:hidden ml-[76px]">
          <div className="flex items-center gap-1 text-xs">
            <GitCommit className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold">
              {formatNumber(contributor.totalCommits)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-green-400">
              +{formatNumber(contributor.totalAdditions)}
            </span>
            <span className="text-red-400">
              -{formatNumber(contributor.totalDeletions)}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded timeline */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {/* Timeline chart */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Commit Timeline
              </h4>
              <MiniTimeline
                monthlyCommits={contributor.monthlyCommits || {}}
                maxCount={contributor.totalCommits}
              />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  First Commit
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {new Date(contributor.firstCommitDate).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Last Commit
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {new Date(contributor.lastCommitDate).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Repos
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {contributor.repos.length}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Avg / Commit
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {contributor.totalCommits > 0
                    ? formatNumber(
                        Math.round(
                          (contributor.totalAdditions +
                            contributor.totalDeletions) /
                            contributor.totalCommits
                        )
                      )
                    : '0'}{' '}
                  lines
                </p>
              </div>
            </div>
          </div>

          {/* Contributed repos */}
          {contributor.repos.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Contributed To
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {contributor.repos.map((repo) => (
                  <Badge
                    key={repo}
                    variant="secondary"
                    className="text-[11px] px-2 py-0.5"
                  >
                    {repo.split('/').pop() || repo}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ContributorBreakdown({
  contributors,
  commits,
  totalCommits,
}: ContributorBreakdownProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const enrichedContributors = React.useMemo(
    () => buildContributorTimelines(contributors, commits, totalCommits),
    [contributors, commits, totalCommits]
  );

  const maxCommits =
    enrichedContributors.length > 0
      ? enrichedContributors[0].totalCommits
      : 0;

  const displayCount = showAll ? enrichedContributors.length : 10;
  const displayedContributors = enrichedContributors.slice(0, displayCount);
  const hasMore = enrichedContributors.length > 10;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Contributors</CardTitle>
              <p className="text-xs text-muted-foreground">
                {enrichedContributors.length} contributor
                {enrichedContributors.length !== 1 ? 's' : ''} · ranked by
                commit count
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatNumber(totalCommits)} total commits
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {displayedContributors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No contributor data available</p>
          </div>
        ) : (
          <>
            {displayedContributors.map((contributor, index) => (
              <ContributorRow
                key={contributor.id}
                contributor={contributor}
                rank={index + 1}
                maxCommits={maxCommits}
                isExpanded={expandedId === contributor.id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === contributor.id ? null : contributor.id
                  )
                }
              />
            ))}

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAll
                    ? 'Show Top 10'
                    : `Show All ${enrichedContributors.length} Contributors`}
                  {showAll ? (
                    <ChevronUp className="w-3.5 h-3.5 ml-1" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
