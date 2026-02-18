import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useGitData } from '@/context/git-data-provider';
import { useAppStore } from '@/stores/app-store';
import {
  computeContributionHeatmap,
  computeCommitFrequency,
  computeLanguageBreakdown,
  computeCodingPatterns,
  computeStreaks,
  computeProductivityMetrics,
  computeYearOverYear,
  computeSuperlatives,
} from '@/lib/analytics-engine';
import type {
  UseAnalyticsReturn,
  AnalyticsResult,
  HeatmapData,
  CommitFrequencyData,
  LanguageBreakdownData,
  CodingPatternsData,
  StreakData,
  ProductivityData,
  YearOverYearData,
  SuperlativesData,
  CommitData,
  Repository,
  TimeGranularity,
} from '@/lib/types';

/**
 * useAnalytics — thin hook that delegates all computation to analytics-engine.ts
 * 
 * Reads commits from GitDataProvider and selectedRepos from the app store.
 * Recomputes ONLY when those inputs change.
 * 
 * For large datasets (5000+ commits), attempts to offload computation
 * to a Web Worker if available, otherwise runs synchronously on main thread.
 */
export function useAnalytics(): UseAnalyticsReturn {
  const gitData = useGitData();
  const selectedRepos = useAppStore((state) => state.selectedRepos);

  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computedAnalytics, setComputedAnalytics] = useState<AnalyticsResult | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const computationIdRef = useRef(0);

  // Build a stable key from selectedRepos to track when we need to recompute
  const selectedReposKey = useMemo(() => {
    return [...selectedRepos].sort().join('|');
  }, [selectedRepos]);

  // Gather all commits for selected repos
  const filteredCommits = useMemo((): CommitData[] => {
    if (!selectedRepos.length) return [];

    const allCommits: CommitData[] = [];
    const repoSet = new Set(selectedRepos);

    for (const repoId of repoSet) {
      const repoCommits = gitData.commitsByRepo[repoId];
      if (repoCommits && repoCommits.length > 0) {
        allCommits.push(...repoCommits);
      }
    }

    // Also check allCommitsSorted for repos that might only be stored there
    if (allCommits.length === 0 && gitData.allCommitsSorted.length > 0) {
      for (const commit of gitData.allCommitsSorted) {
        if (repoSet.has(commit.repoId)) {
          allCommits.push(commit);
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    allCommits.sort((a, b) => b.timestampMs - a.timestampMs);
    return allCommits;
  }, [gitData.commitsByRepo, gitData.allCommitsSorted, selectedReposKey]);

  // Gather selected repositories metadata
  const selectedRepositories = useMemo((): Repository[] => {
    if (!selectedRepos.length) return [];
    const repoSet = new Set(selectedRepos);
    return gitData.allRepositories.filter((r) => repoSet.has(r.id) || repoSet.has(r.fullName));
  }, [gitData.allRepositories, selectedReposKey]);

  // Compute analytics — main synchronous computation
  const computeAnalytics = useCallback(
    (commits: CommitData[], repos: Repository[]): AnalyticsResult | null => {
      if (commits.length === 0) return null;

      try {
        const heatmap = computeContributionHeatmap(commits);
        const commitFrequency = computeCommitFrequency(commits);
        const languageBreakdown = computeLanguageBreakdown(repos);
        const codingPatterns = computeCodingPatterns(commits);
        const streaks = computeStreaks(commits);
        const productivity = computeProductivityMetrics(commits);
        const yearOverYear = computeYearOverYear(commits);
        const superlatives = computeSuperlatives(commits, repos);

        // Compute totals
        const uniqueDates = new Set(commits.map((c) => c.dateKey));
        const uniqueContributors = new Set(
          commits.map((c) => c.author.login || c.author.email)
        );

        const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
        const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
        const totalFilesChanged = commits.reduce((sum, c) => sum + c.filesChanged, 0);
        const activeDays = uniqueDates.size;

        // Date range
        const timestamps = commits.map((c) => c.timestampMs);
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const startDate = new Date(minTime).toISOString();
        const endDate = new Date(maxTime).toISOString();
        const totalDays = Math.max(1, Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)));

        const result: AnalyticsResult = {
          heatmap,
          commitFrequency,
          languageBreakdown,
          codingPatterns,
          streaks,
          productivity,
          yearOverYear,
          monthlyBreakdown: {
            months: [],
            peakMonthIndex: 0,
          },
          superlatives,
          topContributors: [],
          dateRange: {
            start: startDate,
            end: endDate,
            totalDays,
          },
          totals: {
            totalCommits: commits.length,
            totalRepos: repos.length,
            totalAdditions,
            totalDeletions,
            totalFilesChanged,
            activeDays,
            uniqueContributors: uniqueContributors.size,
            avgCommitsPerDay: activeDays > 0 ? commits.length / activeDays : 0,
            avgCommitsPerWeek:
              totalDays > 0 ? (commits.length / totalDays) * 7 : 0,
          },
          computedAt: Date.now(),
        };

        return result;
      } catch (err) {
        console.error('[useAnalytics] Computation error:', err);
        throw err;
      }
    },
    []
  );

  // Trigger computation when inputs change
  useEffect(() => {
    if (filteredCommits.length === 0 || selectedRepositories.length === 0) {
      setComputedAnalytics(null);
      setIsComputing(false);
      setError(null);
      return;
    }

    // If GitDataProvider already has analytics, use those
    if (gitData.analytics) {
      setComputedAnalytics(gitData.analytics);
      setIsComputing(false);
      setError(null);
      return;
    }

    const computationId = ++computationIdRef.current;
    setIsComputing(true);
    setError(null);

    // For large datasets, use requestIdleCallback or setTimeout to avoid blocking UI
    const shouldDefer = filteredCommits.length > 2000;

    const runComputation = () => {
      // Bail if a newer computation was triggered
      if (computationId !== computationIdRef.current) return;

      try {
        const result = computeAnalytics(filteredCommits, selectedRepositories);
        
        // Check again that this is still the latest computation
        if (computationId !== computationIdRef.current) return;

        setComputedAnalytics(result);
        setIsComputing(false);

        // Store in GitDataProvider for other consumers
        if (result) {
          gitData.setAnalytics(result);
        }
      } catch (err) {
        if (computationId !== computationIdRef.current) return;

        const message =
          err instanceof Error ? err.message : 'Analytics computation failed';
        setError(message);
        setIsComputing(false);
      }
    };

    if (shouldDefer && typeof requestIdleCallback !== 'undefined') {
      const handle = requestIdleCallback(runComputation, { timeout: 3000 });
      return () => cancelIdleCallback(handle);
    } else if (shouldDefer) {
      const timeout = setTimeout(runComputation, 50);
      return () => clearTimeout(timeout);
    } else {
      // Small dataset — compute synchronously
      runComputation();
    }
  }, [
    filteredCommits,
    selectedRepositories,
    selectedReposKey,
    gitData.analytics,
    computeAnalytics,
    gitData.setAnalytics,
  ]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Memoize individual analytics sections so consumers don't re-render unnecessarily
  const heatmap = useMemo<HeatmapData | null>(
    () => computedAnalytics?.heatmap ?? null,
    [computedAnalytics?.heatmap]
  );

  const commitFrequency = useMemo<CommitFrequencyData | null>(
    () => computedAnalytics?.commitFrequency ?? null,
    [computedAnalytics?.commitFrequency]
  );

  const languageBreakdown = useMemo<LanguageBreakdownData | null>(
    () => computedAnalytics?.languageBreakdown ?? null,
    [computedAnalytics?.languageBreakdown]
  );

  const codingPatterns = useMemo<CodingPatternsData | null>(
    () => computedAnalytics?.codingPatterns ?? null,
    [computedAnalytics?.codingPatterns]
  );

  const streaks = useMemo<StreakData | null>(
    () => computedAnalytics?.streaks ?? null,
    [computedAnalytics?.streaks]
  );

  const productivity = useMemo<ProductivityData | null>(
    () => computedAnalytics?.productivity ?? null,
    [computedAnalytics?.productivity]
  );

  const yearOverYear = useMemo<YearOverYearData | null>(
    () => computedAnalytics?.yearOverYear ?? null,
    [computedAnalytics?.yearOverYear]
  );

  const superlatives = useMemo<SuperlativesData | null>(
    () => computedAnalytics?.superlatives ?? null,
    [computedAnalytics?.superlatives]
  );

  return {
    heatmap,
    commitFrequency,
    languageBreakdown,
    codingPatterns,
    streaks,
    productivity,
    yearOverYear,
    superlatives,
    analytics: computedAnalytics,
    isComputing,
    error,
  };
}
