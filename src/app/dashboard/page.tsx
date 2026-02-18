'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGitData } from '@/context/git-data-provider';
import { StatsOverviewCards } from '@/components/dashboard/stats-overview-cards';
import { ContributionHeatmap } from '@/components/dashboard/contribution-heatmap';
import { CommitTimelineChart } from '@/components/dashboard/commit-timeline-chart';
import { LanguageBreakdown } from '@/components/dashboard/language-breakdown';
import { CodingPatterns } from '@/components/dashboard/coding-patterns';
import { NavigationCards } from '@/components/dashboard/navigation-cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  RefreshCw,
  Calendar,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const selectedRepos = useAppStore((state) => state.selectedRepos);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const gitData = useGitData();
  const analytics = useAnalytics();

  const analyticsData = analytics.analytics;
  const heatmapData = analytics.heatmap;
  const commitFrequencyData = analytics.commitFrequency;
  const languageBreakdownData = analytics.languageBreakdown;
  const codingPatternsData = analytics.codingPatterns;
  const isComputing = analytics.isComputing;
  const analyticsError = analytics.error;

  const selectedRepositories = gitData.selectedRepositories ?? [];
  const allCommitsSorted = gitData.allCommitsSorted ?? [];

  // Heatmap year state — default to year with the most commits
  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear());

  // Update default year when heatmap data becomes available
  useEffect(() => {
    if (!heatmapData || !heatmapData.years.length) return;
    // Find year with the most commits
    let bestYear = heatmapData.years[heatmapData.years.length - 1];
    let bestCount = 0;
    for (const yr of heatmapData.years) {
      let count = 0;
      for (const [dateKey, cell] of Object.entries(heatmapData.cells)) {
        if (dateKey.startsWith(String(yr))) {
          count += cell.count;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestYear = yr;
      }
    }
    setHeatmapYear(bestYear);
  }, [heatmapData]);

  // Route guard: redirect to /connect if no repos selected
  useEffect(() => {
    if (selectedRepos.length === 0) {
      router.push('/connect');
    }
  }, [selectedRepos, router]);

  // Compute date range label
  const dateRangeLabel = useMemo(() => {
    const dateRange = analyticsData?.dateRange;
    if (!dateRange) return '';
    const { start, end } = dateRange;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${formatDate(startDate)} — ${formatDate(endDate)}`;
  }, [analyticsData]);

  // Compute selected repo names for display
  const selectedRepoNames = useMemo(() => {
    return selectedRepositories.map((r) => r.name);
  }, [selectedRepositories]);

  // If redirecting, show nothing
  if (selectedRepos.length === 0) {
    return null;
  }

  // Loading state
  const statusStr = String(processingStatus ?? '');
  const isLoading =
    !!isComputing ||
    statusStr === 'fetching' ||
    statusStr === 'analyzing';

  return (
    <div className="min-h-screen bg-background">
      {/* Header section */}
      <header className="border-b border-border/40 bg-gradient-to-r from-background via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
                  <GitBranch className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Your Git activity, visualized and analyzed
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dateRangeLabel && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-border/60 px-3 py-1.5 text-xs"
                >
                  <Calendar className="h-3 w-3" />
                  {dateRangeLabel}
                </Badge>
              )}
              <Badge
                variant="secondary"
                className="px-3 py-1.5 text-xs"
              >
                {selectedRepos.length} repo{selectedRepos.length !== 1 ? 's' : ''} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/connect')}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Change Repos
              </Button>
            </div>
          </div>

          {/* Selected repo chips */}
          {selectedRepoNames.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedRepoNames.slice(0, 8).map((name: string, idx: number) => (
                <Badge
                  key={`${name}-${idx}`}
                  variant="outline"
                  className="bg-muted/50 text-xs font-medium"
                >
                  {name}
                </Badge>
              ))}
              {selectedRepoNames.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedRepoNames.length - 8} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading && !analyticsData ? (
          <DashboardSkeleton />
        ) : analyticsError ? (
          <DashboardError error={analyticsError} />
        ) : (
          <div className="space-y-8">
            {/* Stats Overview Cards */}
            <section>
              <StatsOverviewCards
                totals={analyticsData?.totals ?? null}
                streaks={analyticsData?.streaks ?? null}
              />
            </section>

            {/* Contribution Heatmap */}
            <section>
              {heatmapData && (
                <ContributionHeatmap
                  data={heatmapData}
                  year={heatmapYear}
                  onYearChange={setHeatmapYear}
                />
              )}
            </section>

            {/* Commit Timeline Chart */}
            <section>
              <CommitTimelineChart data={commitFrequencyData} commits={allCommitsSorted} />
            </section>

            {/* Language Breakdown — full width */}
            <section>
              <LanguageBreakdown data={languageBreakdownData} />
            </section>

            {/* Coding Patterns — full width */}
            <section>
              {codingPatternsData && (
                <CodingPatterns data={codingPatternsData} />
              )}
            </section>

            {/* Ad placement area */}
            <div className="flex items-center justify-center py-2">
              {/* AdUnit placeholder */}
            </div>

            {/* Navigation Cards */}
            <section>
              <SectionHeader
                title="Explore Your Data"
                description="Dive deeper into your developer journey with these powerful tools"
              />
              <NavigationCards />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// Section header component
function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Loading indicator */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-3 rounded-full bg-muted/50 px-6 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
          <span className="text-sm font-medium text-muted-foreground">
            Crunching your commit history...
          </span>
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Heatmap skeleton */}
      <Skeleton className="h-48 rounded-xl" />

      {/* Chart skeleton */}
      <Skeleton className="h-80 rounded-xl" />

      {/* Language & Coding Patterns skeleton */}
      <Skeleton className="h-96 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />

      {/* Nav cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// Error state
function DashboardError({ error }: { error: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="mb-2 text-xl font-semibold">Analytics Error</h2>
        <p className="mb-6 text-sm text-muted-foreground">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/connect')}
          >
            Back to Connect
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
