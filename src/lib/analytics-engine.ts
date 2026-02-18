// src/lib/analytics-engine.ts
// Core analytics computation engine — pure TypeScript, no React
// Efficiently processes thousands of commits using Maps and pre-sorted arrays

import type {
  CommitData,
  Repository,
  HeatmapData,
  HeatmapCell,
  CommitFrequencyData,
  CommitFrequencyPoint,
  LanguageBreakdownData,
  LanguageEntry,
  CodingPatternsData,
  StreakData,
  StreakInfo,
  ProductivityData,
  YearOverYearData,
  YearStats,
  YearGrowth,
  MonthlyBreakdownData,
  MonthStats,
  SuperlativesData,
  Badge,
  AnalyticsResult,
  TotalStats,
  DateRange,
  Contributor,
} from '@/lib/types';

import {
  TimeGranularity,
  DayOfWeek,
  GITHUB_LANGUAGE_COLORS,
} from '@/lib/types';

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/** Parse a date string to YYYY-MM-DD key */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get ISO week number */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the start of a week (Monday) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get month label */
function getMonthLabel(year: number, month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

/** Day name from DayOfWeek */
function getDayName(day: DayOfWeek): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[day];
}

/** Compute heatmap level (0-4) from count relative to max */
function computeLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** Percentage growth between two values, handling zero denominator */
function percentageGrowth(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

/** Sort commits by timestamp ascending — returns new array */
function sortCommitsByTime(commits: CommitData[]): CommitData[] {
  return [...commits].sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Common stop words to exclude from word frequency analysis */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'was', 'are',
  'be', 'has', 'have', 'had', 'not', 'no', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'if', 'so',
  'as', 'up', 'out', 'into', 'just', 'also', 'than', 'then', 'now',
  'all', 'some', 'any', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'new', 'old', 'when', 'where', 'how', 'what', 'which', 'who',
]);

/** Positive sentiment words for commit mood analysis */
const POSITIVE_WORDS = new Set([
  'fix', 'fixed', 'improve', 'improved', 'add', 'added', 'implement', 'implemented',
  'enhance', 'enhanced', 'optimize', 'optimized', 'update', 'updated', 'upgrade',
  'clean', 'cleaned', 'refactor', 'refactored', 'resolve', 'resolved', 'complete',
  'completed', 'finish', 'finished', 'better', 'great', 'nice', 'awesome',
  'feat', 'feature', 'support', 'enable', 'enabled',
]);

/** Negative sentiment words */
const NEGATIVE_WORDS = new Set([
  'bug', 'broken', 'break', 'breaking', 'revert', 'reverted', 'hack', 'hotfix',
  'workaround', 'todo', 'fixme', 'temporary', 'temp', 'ugly', 'dirty',
  'remove', 'removed', 'delete', 'deleted', 'disable', 'disabled', 'deprecated',
  'fail', 'failed', 'error', 'issue', 'problem', 'crash', 'crashed',
]);

// =============================================================================
// CORE COMPUTATION FUNCTIONS
// =============================================================================

/**
 * Compute contribution heatmap from commits.
 * Efficiently groups commits by date key using a Map.
 */
export function computeContributionHeatmap(commits: CommitData[]): HeatmapData {
  const cellMap = new Map<string, { count: number; repos: Set<string> }>();
  const yearsSet = new Set<number>();
  let maxCount = 0;

  for (const commit of commits) {
    const dateKey = commit.dateKey;
    yearsSet.add(commit.year);

    let cell = cellMap.get(dateKey);
    if (!cell) {
      cell = { count: 0, repos: new Set() };
      cellMap.set(dateKey, cell);
    }
    cell.count++;
    cell.repos.add(commit.repoId);

    if (cell.count > maxCount) {
      maxCount = cell.count;
    }
  }

  const cells: Record<string, HeatmapCell> = {};
  for (const [dateKey, cell] of cellMap) {
    cells[dateKey] = {
      date: dateKey,
      count: cell.count,
      level: computeLevel(cell.count, maxCount),
      repos: Array.from(cell.repos),
    };
  }

  const years = Array.from(yearsSet).sort((a, b) => a - b);

  return { cells, maxCount, years };
}

/**
 * Compute commit frequency time series at the given granularity.
 * Uses pre-sorted commits and Map-based aggregation.
 */
export function computeCommitFrequency(
  commits: CommitData[],
  granularity: TimeGranularity = TimeGranularity.WEEKLY
): CommitFrequencyData {
  const sorted = sortCommitsByTime(commits);

  // Build a key function based on granularity
  const getKey = (commit: CommitData): string => {
    const date = new Date(commit.timestampMs);
    switch (granularity) {
      case TimeGranularity.DAILY:
        return commit.dateKey;
      case TimeGranularity.WEEKLY: {
        const ws = getWeekStart(date);
        return toDateKey(ws);
      }
      case TimeGranularity.MONTHLY:
        return `${commit.year}-${String(commit.month).padStart(2, '0')}`;
      case TimeGranularity.YEARLY:
        return `${commit.year}`;
    }
  };

  // Aggregate all commits
  const aggregated = new Map<string, { count: number; additions: number; deletions: number }>();
  // Per-repo aggregation
  const perRepo = new Map<string, Map<string, { count: number; additions: number; deletions: number }>>();

  for (const commit of sorted) {
    const key = getKey(commit);

    let agg = aggregated.get(key);
    if (!agg) {
      agg = { count: 0, additions: 0, deletions: 0 };
      aggregated.set(key, agg);
    }
    agg.count++;
    agg.additions += commit.additions;
    agg.deletions += commit.deletions;

    // Per-repo
    let repoMap = perRepo.get(commit.repoId);
    if (!repoMap) {
      repoMap = new Map();
      perRepo.set(commit.repoId, repoMap);
    }
    let repoAgg = repoMap.get(key);
    if (!repoAgg) {
      repoAgg = { count: 0, additions: 0, deletions: 0 };
      repoMap.set(key, repoAgg);
    }
    repoAgg.count++;
    repoAgg.additions += commit.additions;
    repoAgg.deletions += commit.deletions;
  }

  // Convert aggregated to sorted series
  const keys = Array.from(aggregated.keys()).sort();
  const series: CommitFrequencyPoint[] = keys.map(key => {
    const agg = aggregated.get(key)!;
    return {
      label: key,
      date: key,
      count: agg.count,
      additions: agg.additions,
      deletions: agg.deletions,
    };
  });

  // Per-repo series
  const perRepoSeries: Record<string, CommitFrequencyPoint[]> = {};
  for (const [repoId, repoMap] of perRepo) {
    const repoKeys = Array.from(repoMap.keys()).sort();
    perRepoSeries[repoId] = repoKeys.map(key => {
      const agg = repoMap.get(key)!;
      return {
        label: key,
        date: key,
        count: agg.count,
        additions: agg.additions,
        deletions: agg.deletions,
      };
    });
  }

  return { series, perRepoSeries, granularity };
}

/**
 * Compute language breakdown from repositories.
 * Merges language byte counts across all repos.
 */
export function computeLanguageBreakdown(repos: Repository[]): LanguageBreakdownData {
  const langMap = new Map<string, { bytes: number; repoCount: number }>();

  for (const repo of repos) {
    if (!repo.languages) continue;
    for (const [lang, bytes] of Object.entries(repo.languages)) {
      let entry = langMap.get(lang);
      if (!entry) {
        entry = { bytes: 0, repoCount: 0 };
        langMap.set(lang, entry);
      }
      entry.bytes += bytes;
      entry.repoCount++;
    }
  }

  let totalBytes = 0;
  for (const entry of langMap.values()) {
    totalBytes += entry.bytes;
  }

  const languages: LanguageEntry[] = Array.from(langMap.entries())
    .map(([name, entry]) => ({
      name,
      bytes: entry.bytes,
      percentage: totalBytes > 0 ? (entry.bytes / totalBytes) * 100 : 0,
      repoCount: entry.repoCount,
      color: GITHUB_LANGUAGE_COLORS[name] || '#94a3b8',
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return { languages, totalBytes };
}

/**
 * Compute coding patterns: peak hours, days, hour×day matrix.
 */
export function computeCodingPatterns(commits: CommitData[]): CodingPatternsData {
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  // hourDayMatrix[day][hour]
  const hourDayMatrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const commit of commits) {
    byHour[commit.hourOfDay]++;
    byDayOfWeek[commit.dayOfWeek]++;
    hourDayMatrix[commit.dayOfWeek][commit.hourOfDay]++;
  }

  // Find peak hour and day
  let peakHour = 0;
  let peakHourCount = 0;
  for (let h = 0; h < 24; h++) {
    if (byHour[h] > peakHourCount) {
      peakHourCount = byHour[h];
      peakHour = h;
    }
  }

  let peakDay: DayOfWeek = DayOfWeek.MONDAY;
  let peakDayCount = 0;
  for (let d = 0; d < 7; d++) {
    if (byDayOfWeek[d] > peakDayCount) {
      peakDayCount = byDayOfWeek[d];
      peakDay = d as DayOfWeek;
    }
  }

  // Night owl: most commits between 20:00-04:00
  const nightCommits = byHour.slice(20).reduce((s, v) => s + v, 0) +
    byHour.slice(0, 5).reduce((s, v) => s + v, 0);
  const morningCommits = byHour.slice(5, 9).reduce((s, v) => s + v, 0);
  const total = commits.length || 1;
  const isNightOwl = nightCommits / total > 0.3;
  const isEarlyBird = morningCommits / total > 0.2;

  // Weekend percentage
  const weekendCommits = byDayOfWeek[DayOfWeek.SATURDAY] + byDayOfWeek[DayOfWeek.SUNDAY];
  const weekendPercentage = (weekendCommits / total) * 100;

  return {
    byHour,
    byDayOfWeek,
    hourDayMatrix,
    peakHour,
    peakDay,
    isNightOwl,
    isEarlyBird,
    weekendPercentage,
  };
}

/**
 * Compute streaks from commits.
 * Uses a sorted date set for efficient consecutive-day detection.
 */
export function computeStreaks(commits: CommitData[]): StreakData {
  if (commits.length === 0) {
    const emptyStreak: StreakInfo = { length: 0, startDate: '', endDate: '', totalCommits: 0 };
    return {
      longestStreak: emptyStreak,
      currentStreak: emptyStreak,
      mostCommitsInDay: { date: '', count: 0, repos: [] },
      topStreaks: [],
    };
  }

  // Group commits by dateKey
  const commitsByDate = new Map<string, { count: number; repos: Set<string> }>();
  for (const commit of commits) {
    let entry = commitsByDate.get(commit.dateKey);
    if (!entry) {
      entry = { count: 0, repos: new Set() };
      commitsByDate.set(commit.dateKey, entry);
    }
    entry.count++;
    entry.repos.add(commit.repoId);
  }

  // Sort unique dates
  const sortedDates = Array.from(commitsByDate.keys()).sort();

  // Find most commits in a day
  let mostCommitsDate = sortedDates[0];
  let mostCommitsCount = 0;
  for (const [date, entry] of commitsByDate) {
    if (entry.count > mostCommitsCount) {
      mostCommitsCount = entry.count;
      mostCommitsDate = date;
    }
  }
  const mostCommitsEntry = commitsByDate.get(mostCommitsDate)!;

  // Detect streaks by iterating sorted dates
  const streaks: StreakInfo[] = [];
  let streakStart = sortedDates[0];
  let streakEnd = sortedDates[0];
  let streakCommits = commitsByDate.get(sortedDates[0])!.count;

  const ONE_DAY_MS = 86400000;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const currDate = new Date(sortedDates[i] + 'T00:00:00Z');
    const diff = currDate.getTime() - prevDate.getTime();

    if (diff <= ONE_DAY_MS) {
      // Consecutive day
      streakEnd = sortedDates[i];
      streakCommits += commitsByDate.get(sortedDates[i])!.count;
    } else {
      // Break in streak — save current streak
      const startD = new Date(streakStart + 'T00:00:00Z');
      const endD = new Date(streakEnd + 'T00:00:00Z');
      const length = Math.round((endD.getTime() - startD.getTime()) / ONE_DAY_MS) + 1;
      streaks.push({
        length,
        startDate: streakStart,
        endDate: streakEnd,
        totalCommits: streakCommits,
      });

      // Start new streak
      streakStart = sortedDates[i];
      streakEnd = sortedDates[i];
      streakCommits = commitsByDate.get(sortedDates[i])!.count;
    }
  }

  // Push the last streak
  const startD = new Date(streakStart + 'T00:00:00Z');
  const endD = new Date(streakEnd + 'T00:00:00Z');
  const length = Math.round((endD.getTime() - startD.getTime()) / ONE_DAY_MS) + 1;
  streaks.push({
    length,
    startDate: streakStart,
    endDate: streakEnd,
    totalCommits: streakCommits,
  });

  // Sort streaks by length descending
  streaks.sort((a, b) => b.length - a.length);

  const longestStreak = streaks[0] || { length: 0, startDate: '', endDate: '', totalCommits: 0 };
  const topStreaks = streaks.slice(0, 5);

  // Current streak: check if the last date is today or yesterday
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - ONE_DAY_MS));
  const lastDate = sortedDates[sortedDates.length - 1];

  let currentStreak: StreakInfo = { length: 0, startDate: '', endDate: '', totalCommits: 0 };
  if (lastDate === today || lastDate === yesterday) {
    // Find the streak that ends with the last date
    for (const streak of streaks) {
      if (streak.endDate === lastDate) {
        currentStreak = streak;
        break;
      }
    }
  }

  return {
    longestStreak,
    currentStreak,
    mostCommitsInDay: {
      date: mostCommitsDate,
      count: mostCommitsCount,
      repos: Array.from(mostCommitsEntry.repos),
    },
    topStreaks,
  };
}

/**
 * Compute productivity metrics from commits.
 */
export function computeProductivityMetrics(commits: CommitData[]): ProductivityData {
  if (commits.length === 0) {
    return {
      mostProductiveMonth: { label: 'N/A', year: 0, month: 0, commits: 0 },
      mostProductiveDay: { day: DayOfWeek.MONDAY, dayName: 'Monday', avgCommits: 0 },
      avgCommitsPerActiveDay: 0,
      avgLinesPerCommit: 0,
      commitSizeDistribution: { small: 0, medium: 0, large: 0, huge: 0 },
    };
  }

  // Monthly aggregation
  const monthlyMap = new Map<string, { year: number; month: number; count: number }>();
  for (const commit of commits) {
    const key = `${commit.year}-${commit.month}`;
    let entry = monthlyMap.get(key);
    if (!entry) {
      entry = { year: commit.year, month: commit.month, count: 0 };
      monthlyMap.set(key, entry);
    }
    entry.count++;
  }

  let mostProductiveMonth = { label: '', year: 0, month: 0, commits: 0 };
  for (const entry of monthlyMap.values()) {
    if (entry.count > mostProductiveMonth.commits) {
      mostProductiveMonth = {
        label: getMonthLabel(entry.year, entry.month),
        year: entry.year,
        month: entry.month,
        commits: entry.count,
      };
    }
  }

  // Day of week aggregation for averages
  const dayCommits = new Array(7).fill(0);
  const dayWeeks = new Array(7).fill(0); // count weeks with activity
  const weekDaySet = new Map<string, Set<number>>(); // week -> set of active days

  for (const commit of commits) {
    dayCommits[commit.dayOfWeek]++;
    const weekKey = `${commit.year}-W${commit.weekOfYear}`;
    let daySet = weekDaySet.get(weekKey);
    if (!daySet) {
      daySet = new Set();
      weekDaySet.set(weekKey, daySet);
    }
    daySet.add(commit.dayOfWeek);
  }

  // Count total weeks active for each day
  for (const daySet of weekDaySet.values()) {
    for (const day of daySet) {
      dayWeeks[day]++;
    }
  }

  let mostProductiveDay = { day: DayOfWeek.MONDAY as DayOfWeek, dayName: 'Monday', avgCommits: 0 };
  for (let d = 0; d < 7; d++) {
    const avg = dayWeeks[d] > 0 ? dayCommits[d] / dayWeeks[d] : 0;
    if (avg > mostProductiveDay.avgCommits) {
      mostProductiveDay = {
        day: d as DayOfWeek,
        dayName: getDayName(d as DayOfWeek),
        avgCommits: Math.round(avg * 100) / 100,
      };
    }
  }

  // Active days
  const activeDays = new Set(commits.map(c => c.dateKey)).size;
  const avgCommitsPerActiveDay = activeDays > 0
    ? Math.round((commits.length / activeDays) * 100) / 100
    : 0;

  // Average lines per commit
  const totalLines = commits.reduce((sum, c) => sum + c.totalChanges, 0);
  const avgLinesPerCommit = commits.length > 0
    ? Math.round((totalLines / commits.length) * 100) / 100
    : 0;

  // Commit size distribution
  const distribution = { small: 0, medium: 0, large: 0, huge: 0 };
  for (const commit of commits) {
    if (commit.totalChanges < 10) distribution.small++;
    else if (commit.totalChanges < 100) distribution.medium++;
    else if (commit.totalChanges < 500) distribution.large++;
    else distribution.huge++;
  }

  return {
    mostProductiveMonth,
    mostProductiveDay,
    avgCommitsPerActiveDay,
    avgLinesPerCommit,
    commitSizeDistribution: distribution,
  };
}

/**
 * Compute year-over-year comparison data.
 */
export function computeYearOverYear(commits: CommitData[]): YearOverYearData {
  if (commits.length === 0) {
    return { years: [], hasMultipleYears: false, growth: [] };
  }

  // Group by year
  const yearMap = new Map<number, {
    commits: number;
    additions: number;
    deletions: number;
    activeDays: Set<string>;
    repos: Set<string>;
    languages: Map<string, number>;
  }>();

  for (const commit of commits) {
    let entry = yearMap.get(commit.year);
    if (!entry) {
      entry = {
        commits: 0,
        additions: 0,
        deletions: 0,
        activeDays: new Set(),
        repos: new Set(),
        languages: new Map(),
      };
      yearMap.set(commit.year, entry);
    }
    entry.commits++;
    entry.additions += commit.additions;
    entry.deletions += commit.deletions;
    entry.activeDays.add(commit.dateKey);
    entry.repos.add(commit.repoId);
  }

  const years: YearStats[] = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, entry]) => {
      // Find top language by looking at file extensions in commits for that year
      // Simple heuristic: count file extensions
      let topLanguage: string | null = null;
      // We don't have direct language mapping per commit, so we'll leave it null
      // The language breakdown is better served by computeLanguageBreakdown

      return {
        year,
        commits: entry.commits,
        additions: entry.additions,
        deletions: entry.deletions,
        activeDays: entry.activeDays.size,
        repoCount: entry.repos.size,
        topLanguage,
      };
    });

  const hasMultipleYears = years.length > 1;

  // Compute growth between consecutive years
  const growth: YearGrowth[] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = years[i - 1];
    const curr = years[i];
    growth.push({
      fromYear: prev.year,
      toYear: curr.year,
      commitGrowth: percentageGrowth(prev.commits, curr.commits),
      activeDaysGrowth: percentageGrowth(prev.activeDays, curr.activeDays),
      linesGrowth: percentageGrowth(
        prev.additions + prev.deletions,
        curr.additions + curr.deletions
      ),
    });
  }

  return { years, hasMultipleYears, growth };
}

/**
 * Compute monthly breakdown across all time.
 */
export function computeMonthlyBreakdown(commits: CommitData[]): MonthlyBreakdownData {
  if (commits.length === 0) {
    return { months: [], peakMonthIndex: 0 };
  }

  const monthMap = new Map<string, {
    year: number;
    month: number;
    commits: number;
    additions: number;
    deletions: number;
    activeDays: Set<string>;
    repoCommits: Map<string, number>;
  }>();

  for (const commit of commits) {
    const key = `${commit.year}-${String(commit.month).padStart(2, '0')}`;
    let entry = monthMap.get(key);
    if (!entry) {
      entry = {
        year: commit.year,
        month: commit.month,
        commits: 0,
        additions: 0,
        deletions: 0,
        activeDays: new Set(),
        repoCommits: new Map(),
      };
      monthMap.set(key, entry);
    }
    entry.commits++;
    entry.additions += commit.additions;
    entry.deletions += commit.deletions;
    entry.activeDays.add(commit.dateKey);

    const rc = entry.repoCommits.get(commit.repoId) || 0;
    entry.repoCommits.set(commit.repoId, rc + 1);
  }

  const months: MonthStats[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => {
      // Find top repo for this month
      let topRepo: string | null = null;
      let maxRepoCommits = 0;
      for (const [repoId, count] of entry.repoCommits) {
        if (count > maxRepoCommits) {
          maxRepoCommits = count;
          topRepo = repoId;
        }
      }

      return {
        year: entry.year,
        month: entry.month,
        label: getMonthLabel(entry.year, entry.month),
        commits: entry.commits,
        additions: entry.additions,
        deletions: entry.deletions,
        topRepo,
        activeDays: entry.activeDays.size,
      };
    });

  // Find peak month
  let peakMonthIndex = 0;
  let peakCommits = 0;
  for (let i = 0; i < months.length; i++) {
    if (months[i].commits > peakCommits) {
      peakCommits = months[i].commits;
      peakMonthIndex = i;
    }
  }

  return { months, peakMonthIndex };
}

/**
 * Compute fun superlatives from commits and repos.
 */
export function computeSuperlatives(commits: CommitData[], repos: Repository[]): SuperlativesData {
  // Default empty result
  const empty: SuperlativesData = {
    chronotype: 'balanced',
    weekendType: 'balanced',
    favoriteCommitWord: { word: '', count: 0 },
    longestCommitMessage: { message: '', length: 0, sha: '', repoId: '' },
    shortestCommitMessage: { message: '', length: 0, sha: '', repoId: '' },
    busiestHour: { date: '', hour: 0, commits: 0 },
    mostChurnedRepo: { repoId: '', repoName: '', totalChanges: 0 },
    commitMood: 'neutral',
    fixCommits: 0,
    featureCommits: 0,
    refactorCommits: 0,
    mergePercentage: 0,
    badges: [],
  };

  if (commits.length === 0) return empty;

  // Chronotype
  const patterns = computeCodingPatterns(commits);
  let chronotype: 'night-owl' | 'early-bird' | 'balanced' = 'balanced';
  if (patterns.isNightOwl) chronotype = 'night-owl';
  else if (patterns.isEarlyBird) chronotype = 'early-bird';

  // Weekend type
  let weekendType: 'weekend-warrior' | 'weekday-warrior' | 'balanced' = 'balanced';
  if (patterns.weekendPercentage > 35) weekendType = 'weekend-warrior';
  else if (patterns.weekendPercentage < 15) weekendType = 'weekday-warrior';

  // Word frequency analysis
  const wordCounts = new Map<string, number>();
  let longestMessage = commits[0];
  let shortestMessage = commits[0];

  let positiveCount = 0;
  let negativeCount = 0;
  let fixCount = 0;
  let featureCount = 0;
  let refactorCount = 0;
  let mergeCount = 0;

  for (const commit of commits) {
    const msg = commit.message.toLowerCase();

    // Track longest/shortest
    if (commit.message.length > longestMessage.message.length) {
      longestMessage = commit;
    }
    if (commit.message.length > 0 && (shortestMessage.message.length === 0 || commit.message.length < shortestMessage.message.length)) {
      shortestMessage = commit;
    }

    // Merge detection
    if (commit.isMerge) mergeCount++;

    // Conventional commit type detection
    if (/^fix[\s(:]/i.test(msg) || msg.includes('bugfix') || msg.includes('hotfix')) fixCount++;
    if (/^feat[\s(:]/i.test(msg) || /^feature[\s(:]/i.test(msg)) featureCount++;
    if (/^refactor[\s(:]/i.test(msg)) refactorCount++;

    // Word frequency
    const words = msg
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      if (POSITIVE_WORDS.has(word)) positiveCount++;
      if (NEGATIVE_WORDS.has(word)) negativeCount++;
    }
  }

  // Find favorite word
  let favoriteWord = '';
  let favoriteWordCount = 0;
  for (const [word, count] of wordCounts) {
    if (count > favoriteWordCount) {
      favoriteWordCount = count;
      favoriteWord = word;
    }
  }

  // Busiest hour (date + hour combination)
  const hourDateMap = new Map<string, number>();
  for (const commit of commits) {
    const key = `${commit.dateKey}-${commit.hourOfDay}`;
    hourDateMap.set(key, (hourDateMap.get(key) || 0) + 1);
  }

  let busiestHourKey = '';
  let busiestHourCount = 0;
  for (const [key, count] of hourDateMap) {
    if (count > busiestHourCount) {
      busiestHourCount = count;
      busiestHourKey = key;
    }
  }

  const busiestParts = busiestHourKey.split('-');
  const busiestDate = busiestParts.slice(0, 3).join('-');
  const busiestHour = parseInt(busiestParts[3] || '0', 10);

  // Most churned repo
  const repoChurn = new Map<string, number>();
  for (const commit of commits) {
    repoChurn.set(commit.repoId, (repoChurn.get(commit.repoId) || 0) + commit.totalChanges);
  }

  let mostChurnedRepoId = '';
  let mostChurnedTotal = 0;
  for (const [repoId, total] of repoChurn) {
    if (total > mostChurnedTotal) {
      mostChurnedTotal = total;
      mostChurnedRepoId = repoId;
    }
  }

  const mostChurnedRepo = repos.find(r => r.fullName === mostChurnedRepoId || r.id === mostChurnedRepoId);

  // Commit mood
  let commitMood: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (positiveCount > negativeCount * 1.5) commitMood = 'positive';
  else if (negativeCount > positiveCount * 1.5) commitMood = 'negative';

  // Merge percentage
  const mergePercentage = (mergeCount / commits.length) * 100;

  // Generate badges
  const badges: Badge[] = [];
  const streaks = computeStreaks(commits);

  if (streaks.longestStreak.length >= 30) {
    badges.push({
      id: 'streak-master',
      name: '🔥 Streak Master',
      description: '30+ day commit streak',
      icon: '🔥',
      criteria: `${streaks.longestStreak.length} day streak`,
    });
  }

  if (streaks.longestStreak.length >= 7) {
    badges.push({
      id: 'consistent',
      name: '📅 Consistent Contributor',
      description: '7+ day commit streak',
      icon: '📅',
      criteria: `${streaks.longestStreak.length} day streak`,
    });
  }

  if (commits.length >= 1000) {
    badges.push({
      id: 'prolific',
      name: '⚡ Prolific Coder',
      description: '1000+ commits analyzed',
      icon: '⚡',
      criteria: `${commits.length} commits`,
    });
  }

  if (chronotype === 'night-owl') {
    badges.push({
      id: 'night-owl',
      name: '🦉 Night Owl',
      description: 'Most commits after 8pm',
      icon: '🦉',
      criteria: 'Peak activity hours: late night',
    });
  }

  if (chronotype === 'early-bird') {
    badges.push({
      id: 'early-bird',
      name: '🐦 Early Bird',
      description: 'Most commits before 9am',
      icon: '🐦',
      criteria: 'Peak activity hours: early morning',
    });
  }

  if (weekendType === 'weekend-warrior') {
    badges.push({
      id: 'weekend-warrior',
      name: '⚔️ Weekend Warrior',
      description: '35%+ of commits on weekends',
      icon: '⚔️',
      criteria: `${Math.round(patterns.weekendPercentage)}% weekend commits`,
    });
  }

  if (fixCount > commits.length * 0.3) {
    badges.push({
      id: 'bug-squasher',
      name: '🐛 Bug Squasher',
      description: '30%+ of commits are fixes',
      icon: '🐛',
      criteria: `${fixCount} fix commits`,
    });
  }

  if (repos.length >= 10) {
    badges.push({
      id: 'polyrepo',
      name: '🗂️ Poly-Repo Master',
      description: '10+ repositories analyzed',
      icon: '🗂️',
      criteria: `${repos.length} repositories`,
    });
  }

  const languageBreakdown = computeLanguageBreakdown(repos);
  if (languageBreakdown.languages.length >= 5) {
    badges.push({
      id: 'polyglot',
      name: '🌍 Polyglot',
      description: '5+ programming languages',
      icon: '🌍',
      criteria: `${languageBreakdown.languages.length} languages`,
    });
  }

  if (refactorCount > commits.length * 0.1) {
    badges.push({
      id: 'refactor-champion',
      name: '🔧 Refactor Champion',
      description: '10%+ of commits are refactors',
      icon: '🔧',
      criteria: `${refactorCount} refactor commits`,
    });
  }

  return {
    chronotype,
    weekendType,
    favoriteCommitWord: { word: favoriteWord, count: favoriteWordCount },
    longestCommitMessage: {
      message: longestMessage.message,
      length: longestMessage.message.length,
      sha: longestMessage.sha,
      repoId: longestMessage.repoId,
    },
    shortestCommitMessage: {
      message: shortestMessage.message,
      length: shortestMessage.message.length,
      sha: shortestMessage.sha,
      repoId: shortestMessage.repoId,
    },
    busiestHour: {
      date: busiestDate,
      hour: busiestHour,
      commits: busiestHourCount,
    },
    mostChurnedRepo: {
      repoId: mostChurnedRepoId,
      repoName: mostChurnedRepo?.name || mostChurnedRepoId,
      totalChanges: mostChurnedTotal,
    },
    commitMood,
    fixCommits: fixCount,
    featureCommits: featureCount,
    refactorCommits: refactorCount,
    mergePercentage: Math.round(mergePercentage * 100) / 100,
    badges,
  };
}

// =============================================================================
// AGGREGATION: COMPUTE TOTAL STATS
// =============================================================================

/**
 * Compute total aggregate statistics.
 */
export function computeTotalStats(commits: CommitData[], repos: Repository[]): TotalStats {
  const activeDaysSet = new Set<string>();
  const contributorSet = new Set<string>();
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalFilesChanged = 0;

  for (const commit of commits) {
    activeDaysSet.add(commit.dateKey);
    contributorSet.add(commit.author.login || commit.author.email);
    totalAdditions += commit.additions;
    totalDeletions += commit.deletions;
    totalFilesChanged += commit.filesChanged;
  }

  const activeDays = activeDaysSet.size;
  const totalCommits = commits.length;

  // Calculate weeks spanned
  let weekCount = 1;
  if (commits.length > 0) {
    const sorted = sortCommitsByTime(commits);
    const first = sorted[0].timestampMs;
    const last = sorted[sorted.length - 1].timestampMs;
    weekCount = Math.max(1, Math.ceil((last - first) / (7 * 86400000)));
  }

  return {
    totalCommits,
    totalRepos: repos.length,
    totalAdditions,
    totalDeletions,
    totalFilesChanged,
    activeDays,
    uniqueContributors: contributorSet.size,
    avgCommitsPerDay: activeDays > 0 ? Math.round((totalCommits / activeDays) * 100) / 100 : 0,
    avgCommitsPerWeek: Math.round((totalCommits / weekCount) * 100) / 100,
  };
}

/**
 * Compute date range from commits.
 */
export function computeDateRange(commits: CommitData[]): DateRange {
  if (commits.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now, totalDays: 0 };
  }

  const sorted = sortCommitsByTime(commits);
  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const totalDays = Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  ) + 1;

  return { start, end, totalDays };
}

/**
 * Extract top contributors from commits.
 */
export function computeTopContributors(commits: CommitData[], limit: number = 20): Contributor[] {
  const contribMap = new Map<string, {
    name: string;
    email: string;
    login: string | null;
    avatarUrl: string | null;
    totalCommits: number;
    totalAdditions: number;
    totalDeletions: number;
    firstCommitMs: number;
    lastCommitMs: number;
    repos: Set<string>;
  }>();

  for (const commit of commits) {
    const id = commit.author.login || commit.author.email;
    let entry = contribMap.get(id);
    if (!entry) {
      entry = {
        name: commit.author.name,
        email: commit.author.email,
        login: commit.author.login,
        avatarUrl: commit.author.avatarUrl,
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        firstCommitMs: commit.timestampMs,
        lastCommitMs: commit.timestampMs,
        repos: new Set(),
      };
      contribMap.set(id, entry);
    }
    entry.totalCommits++;
    entry.totalAdditions += commit.additions;
    entry.totalDeletions += commit.deletions;
    if (commit.timestampMs < entry.firstCommitMs) entry.firstCommitMs = commit.timestampMs;
    if (commit.timestampMs > entry.lastCommitMs) entry.lastCommitMs = commit.timestampMs;
    entry.repos.add(commit.repoId);
  }

  // Color palette for contributors
  const colors = [
    '#60a5fa', '#f97316', '#a78bfa', '#34d399', '#fb923c',
    '#f472b6', '#2dd4bf', '#fbbf24', '#818cf8', '#c084fc',
    '#22d3ee', '#e879f9', '#4ade80', '#f87171', '#facc15',
    '#38bdf8', '#a3e635', '#fb7185', '#94a3b8', '#d946ef',
  ];

  const contributors: Contributor[] = Array.from(contribMap.entries())
    .map(([id, entry], index) => ({
      id,
      name: entry.name,
      email: entry.email,
      login: entry.login,
      avatarUrl: entry.avatarUrl,
      totalCommits: entry.totalCommits,
      totalAdditions: entry.totalAdditions,
      totalDeletions: entry.totalDeletions,
      firstCommitDate: new Date(entry.firstCommitMs).toISOString(),
      lastCommitDate: new Date(entry.lastCommitMs).toISOString(),
      repos: Array.from(entry.repos),
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.totalCommits - a.totalCommits)
    .slice(0, limit);

  return contributors;
}

// =============================================================================
// FULL ANALYTICS COMPUTATION
// =============================================================================

/**
 * Compute the complete AnalyticsResult from commits and repos.
 * This is the main entry point used by the /api/analytics/compute route
 * and the useAnalytics hook.
 */
export function computeFullAnalytics(
  commits: CommitData[],
  repos: Repository[],
  granularity: TimeGranularity = TimeGranularity.WEEKLY
): AnalyticsResult {
  const heatmap = computeContributionHeatmap(commits);
  const commitFrequency = computeCommitFrequency(commits, granularity);
  const languageBreakdown = computeLanguageBreakdown(repos);
  const codingPatterns = computeCodingPatterns(commits);
  const streaks = computeStreaks(commits);
  const productivity = computeProductivityMetrics(commits);
  const yearOverYear = computeYearOverYear(commits);
  const monthlyBreakdown = computeMonthlyBreakdown(commits);
  const superlatives = computeSuperlatives(commits, repos);
  const topContributors = computeTopContributors(commits);
  const dateRange = computeDateRange(commits);
  const totals = computeTotalStats(commits, repos);

  return {
    heatmap,
    commitFrequency,
    languageBreakdown,
    codingPatterns,
    streaks,
    productivity,
    yearOverYear,
    monthlyBreakdown,
    superlatives,
    topContributors,
    dateRange,
    totals,
    computedAt: Date.now(),
  };
}

// =============================================================================
// GAME LOOP CONTROLLER
// =============================================================================

/**
 * Game loop controller using requestAnimationFrame.
 * Used by the Gource visualization engine.
 */
export interface GameLoopCallbacks {
  update: (deltaTime: number, elapsedTime: number) => void;
  render: (deltaTime: number, frameCount: number) => void;
  onFpsUpdate?: (fps: number) => void;
}

export class GameLoopController {
  private isRunning: boolean = false;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private elapsedTime: number = 0;
  private animationFrameId: number = 0;
  private callbacks: GameLoopCallbacks;

  // FPS tracking
  private fpsFrameCount: number = 0;
  private fpsLastTime: number = 0;
  private currentFps: number = 0;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.fpsLastTime = performance.now();
    this.fpsFrameCount = 0;
    this.tick(performance.now());
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  reset(): void {
    this.stop();
    this.frameCount = 0;
    this.elapsedTime = 0;
    this.currentFps = 0;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  getFps(): number {
    return this.currentFps;
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // seconds
    this.lastFrameTime = currentTime;
    this.elapsedTime += deltaTime;
    this.frameCount++;

    // FPS calculation (update once per second)
    this.fpsFrameCount++;
    const fpsElapsed = currentTime - this.fpsLastTime;
    if (fpsElapsed >= 1000) {
      this.currentFps = Math.round((this.fpsFrameCount / fpsElapsed) * 1000);
      this.fpsFrameCount = 0;
      this.fpsLastTime = currentTime;
      this.callbacks.onFpsUpdate?.(this.currentFps);
    }

    // Cap deltaTime to prevent spiral of death
    const cappedDelta = Math.min(deltaTime, 1 / 15); // Max ~15fps worth of time

    this.callbacks.update(cappedDelta, this.elapsedTime);
    this.callbacks.render(cappedDelta, this.frameCount);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

// =============================================================================
// TIMING SYSTEM
// =============================================================================

/**
 * Simulation timing system for Gource playback.
 * Manages mapping between real-time and simulation time.
 */
export class TimingSystem {
  private startTime: number; // simulation start (ms epoch)
  private endTime: number; // simulation end (ms epoch)
  private currentTime: number; // current simulation time (ms epoch)
  private speed: number = 1;
  private isPaused: boolean = true;

  constructor(startTime: number, endTime: number) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.currentTime = startTime;
  }

  update(realDeltaSeconds: number): void {
    if (this.isPaused) return;

    // Convert simulation time based on speed
    // speed=1 means 1 real second = 1 day of simulation time
    const simDeltaMs = realDeltaSeconds * this.speed * 86400000; // days per second
    this.currentTime = Math.min(this.currentTime + simDeltaMs, this.endTime);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getProgress(): number {
    const totalDuration = this.endTime - this.startTime;
    if (totalDuration === 0) return 0;
    return (this.currentTime - this.startTime) / totalDuration;
  }

  getCurrentDate(): string {
    return new Date(this.currentTime).toISOString().split('T')[0];
  }

  getStartTime(): number {
    return this.startTime;
  }

  getEndTime(): number {
    return this.endTime;
  }

  getTotalDuration(): number {
    return this.endTime - this.startTime;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getSpeed(): number {
    return this.speed;
  }

  play(): void {
    this.isPaused = false;
  }

  pause(): void {
    this.isPaused = true;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  seek(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.currentTime = this.startTime + clamped * (this.endTime - this.startTime);
  }

  seekToTime(time: number): void {
    this.currentTime = Math.max(this.startTime, Math.min(time, this.endTime));
  }

  isComplete(): boolean {
    return this.currentTime >= this.endTime;
  }

  reset(): void {
    this.currentTime = this.startTime;
    this.isPaused = true;
  }
}

// =============================================================================
// HIT DETECTION (for interactive Gource visualization)
// =============================================================================

/**
 * Point-in-circle hit detection for node selection.
 */
export function hitTestCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Point-in-rectangle hit detection.
 */
export function hitTestRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Find the nearest node to a point within a maximum distance.
 * Uses brute-force for now; can be upgraded to quadtree for large node counts.
 */
export function findNearestNode<T extends { x: number; y: number; id: string }>(
  px: number,
  py: number,
  nodes: T[],
  maxDistance: number
): T | null {
  let nearest: T | null = null;
  let nearestDist = maxDistance * maxDistance;

  for (const node of nodes) {
    const dx = px - node.x;
    const dy = py - node.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDist) {
      nearestDist = distSq;
      nearest = node;
    }
  }

  return nearest;
}

/**
 * Find all nodes within a rectangular selection area.
 */
export function findNodesInRect<T extends { x: number; y: number }>(
  nodes: T[],
  rx: number,
  ry: number,
  rw: number,
  rh: number
): T[] {
  const minX = Math.min(rx, rx + rw);
  const maxX = Math.max(rx, rx + rw);
  const minY = Math.min(ry, ry + rh);
  const maxY = Math.max(ry, ry + rh);

  return nodes.filter(node =>
    node.x >= minX && node.x <= maxX &&
    node.y >= minY && node.y <= maxY
  );
}

// =============================================================================
// SCORING CALCULATION (for gamification elements)
// =============================================================================

/**
 * Calculate a "developer score" based on analytics.
 * Used for fun metrics in the Wrapped experience.
 */
export function calculateDeveloperScore(analytics: AnalyticsResult): number {
  let score = 0;

  // Base score from commits (log scale to avoid huge repos dominating)
  score += Math.min(Math.log2(analytics.totals.totalCommits + 1) * 10, 100);

  // Streak bonus
  score += Math.min(analytics.streaks.longestStreak.length * 2, 60);

  // Consistency bonus (active days / total days ratio)
  const consistencyRatio = analytics.dateRange.totalDays > 0
    ? analytics.totals.activeDays / analytics.dateRange.totalDays
    : 0;
  score += consistencyRatio * 40;

  // Multi-repo bonus
  score += Math.min(analytics.totals.totalRepos * 5, 30);

  // Badge bonus
  score += analytics.superlatives.badges.length * 10;

  // Language diversity bonus
  score += Math.min(analytics.languageBreakdown.languages.length * 3, 20);

  // Growth bonus (if multi-year with positive growth)
  if (analytics.yearOverYear.growth.length > 0) {
    const latestGrowth = analytics.yearOverYear.growth[analytics.yearOverYear.growth.length - 1];
    if (latestGrowth.commitGrowth > 0) {
      score += Math.min(latestGrowth.commitGrowth / 5, 20);
    }
  }

  return Math.round(Math.min(score, 500));
}

/**
 * Compute a grade based on developer score.
 */
export function computeGrade(score: number): { grade: string; label: string; emoji: string } {
  if (score >= 400) return { grade: 'S', label: 'Legendary', emoji: '🏆' };
  if (score >= 300) return { grade: 'A+', label: 'Elite', emoji: '⭐' };
  if (score >= 250) return { grade: 'A', label: 'Expert', emoji: '🔥' };
  if (score >= 200) return { grade: 'B+', label: 'Advanced', emoji: '💪' };
  if (score >= 150) return { grade: 'B', label: 'Proficient', emoji: '👍' };
  if (score >= 100) return { grade: 'C+', label: 'Growing', emoji: '🌱' };
  if (score >= 50) return { grade: 'C', label: 'Getting Started', emoji: '🚀' };
  return { grade: 'D', label: 'Newcomer', emoji: '👋' };
}

// =============================================================================
// CHUNK PROCESSING HELPERS (for large commit sets)
// =============================================================================

/**
 * Process commits in chunks to avoid blocking the main thread.
 * Returns intermediate results that can be merged.
 */
export function processCommitChunk(
  commits: CommitData[],
  chunkIndex: number,
  totalChunks: number
): {
  heatmapPartial: Map<string, { count: number; repos: Set<string> }>;
  byHour: number[];
  byDayOfWeek: number[];
  totalAdditions: number;
  totalDeletions: number;
  activeDates: Set<string>;
  contributors: Set<string>;
} {
  const heatmapPartial = new Map<string, { count: number; repos: Set<string> }>();
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  let totalAdditions = 0;
  let totalDeletions = 0;
  const activeDates = new Set<string>();
  const contributors = new Set<string>();

  for (const commit of commits) {
    // Heatmap
    let cell = heatmapPartial.get(commit.dateKey);
    if (!cell) {
      cell = { count: 0, repos: new Set() };
      heatmapPartial.set(commit.dateKey, cell);
    }
    cell.count++;
    cell.repos.add(commit.repoId);

    // Patterns
    byHour[commit.hourOfDay]++;
    byDayOfWeek[commit.dayOfWeek]++;

    // Totals
    totalAdditions += commit.additions;
    totalDeletions += commit.deletions;
    activeDates.add(commit.dateKey);
    contributors.add(commit.author.login || commit.author.email);
  }

  return {
    heatmapPartial,
    byHour,
    byDayOfWeek,
    totalAdditions,
    totalDeletions,
    activeDates,
    contributors,
  };
}

/**
 * Merge multiple chunk results into a single result.
 */
export function mergeChunkResults(
  chunks: ReturnType<typeof processCommitChunk>[]
): {
  heatmapMerged: Map<string, { count: number; repos: Set<string> }>;
  byHour: number[];
  byDayOfWeek: number[];
  totalAdditions: number;
  totalDeletions: number;
  activeDates: Set<string>;
  contributors: Set<string>;
} {
  const heatmapMerged = new Map<string, { count: number; repos: Set<string> }>();
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  let totalAdditions = 0;
  let totalDeletions = 0;
  const activeDates = new Set<string>();
  const contributors = new Set<string>();

  for (const chunk of chunks) {
    for (const [key, cell] of chunk.heatmapPartial) {
      let merged = heatmapMerged.get(key);
      if (!merged) {
        merged = { count: 0, repos: new Set() };
        heatmapMerged.set(key, merged);
      }
      merged.count += cell.count;
      for (const repo of cell.repos) {
        merged.repos.add(repo);
      }
    }

    for (let i = 0; i < 24; i++) byHour[i] += chunk.byHour[i];
    for (let i = 0; i < 7; i++) byDayOfWeek[i] += chunk.byDayOfWeek[i];
    totalAdditions += chunk.totalAdditions;
    totalDeletions += chunk.totalDeletions;
    for (const date of chunk.activeDates) activeDates.add(date);
    for (const c of chunk.contributors) contributors.add(c);
  }

  return {
    heatmapMerged,
    byHour,
    byDayOfWeek,
    totalAdditions,
    totalDeletions,
    activeDates,
    contributors,
  };
}
