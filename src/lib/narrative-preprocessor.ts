// src/lib/narrative-preprocessor.ts
// Pure local computation — zero API calls.
// Extracts intelligence signals from commit data for the narrative pipeline.
// Designed for performance: handles up to 450k commits using Maps and single-pass iteration.

import type { CommitData, Repository } from '@/lib/types';
import type {
  AdaptiveTimeWindow,
  WorkTheme,
  ThemeCategory,
  NarrativeEvent,
  NarrativeEventCategory,
  ContributorIntelligence,
  CrossRepoCorrelation,
  Discontinuity,
  WindowAnalysis,
  ScoredCommit,
  CommitIntelligenceResult,
} from '@/lib/narrative-types';

// =============================================================================
// CONFIG
// =============================================================================

interface PreprocessorConfig {
  /** Maximum number of interesting commits to return */
  maxInterestingCommits: number;
  /** Maximum number of events to detect */
  maxEvents: number;
  /** Gap threshold in days for abandonment detection */
  abandonmentGapDays: number;
  /** Gap threshold in days for commit gap scoring */
  commitGapDays: number;
  /** Minimum density before a window gets split */
  densitySplitThreshold: number;
  /** Maximum density before adjacent windows get merged */
  densityMergeThreshold: number;
}

const DEFAULT_CONFIG: PreprocessorConfig = {
  maxInterestingCommits: 200,
  maxEvents: 100,
  abandonmentGapDays: 90,
  commitGapDays: 14,
  densitySplitThreshold: 5,
  densityMergeThreshold: 1.0,
};

// =============================================================================
// UTILITY
// =============================================================================

const DAY_MS = 86400000;

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function toISO(ms: number): string {
  return new Date(ms).toISOString();
}

function daysBetween(a: number, b: number): number {
  return Math.max(1, Math.ceil(Math.abs(b - a) / DAY_MS));
}

function getDirectory(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '.' : filePath.slice(0, idx);
}

function getExtension(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx <= 0) return '';
  return filename.slice(dotIdx + 1).toLowerCase();
}

function generateId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

function getContributorId(commit: CommitData): string {
  return commit.author.login || commit.author.email || commit.author.name;
}

function getActiveDays(commits: CommitData[]): number {
  const days = new Set<string>();
  for (const c of commits) {
    days.add(c.dateKey);
  }
  return days.size;
}

// =============================================================================
// COMMIT SCORING
// =============================================================================

const LAUNCH_WORDS_RE = /\b(launch|deploy|release|ship|rewrite|migrate|v1|v2)\b/i;
const IMPACT_WORDS_RE = /\b(finally|breaking|major)\b/i;
const MERGE_RE = /^merge (branch|pull request|remote)/i;
const BUMP_RE = /\b(bump version|update dependencies|chore\(deps\))\b/i;
const CONVENTIONAL_RE = /^(feat|fix|chore|docs|style|refactor|test|ci|build|perf)\b/i;

/**
 * Score a single commit for narrative interestingness.
 * Returns { score, reasons }.
 */
function scoreCommitRaw(
  commit: CommitData,
  context: {
    isFirstInRepo: boolean;
    isLastBeforeGap: boolean;
    isFirstAfterGap: boolean;
    p95Changes: number;
    seenExtensions: Set<string>;
  }
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (context.isFirstInRepo) {
    score += 5;
    reasons.push('First commit in repo');
  }
  if (context.isLastBeforeGap) {
    score += 5;
    reasons.push('Last commit before long gap');
  }
  if (context.isFirstAfterGap) {
    score += 5;
    reasons.push('First commit after long gap');
  }
  if (LAUNCH_WORDS_RE.test(commit.messageHeadline)) {
    score += 3;
    reasons.push('Launch/deploy keyword');
  }
  if (commit.totalChanges > context.p95Changes && context.p95Changes > 0) {
    score += 3;
    reasons.push('Very large changeset');
  }
  if (IMPACT_WORDS_RE.test(commit.messageHeadline)) {
    score += 2;
    reasons.push('High-impact keyword');
  }
  if (commit.hourOfDay >= 2 && commit.hourOfDay <= 5) {
    score += 2;
    reasons.push('Late night commit (2-5am)');
  }

  // First new file extension in repo
  for (const file of commit.files) {
    const ext = getExtension(file.path);
    if (ext && !context.seenExtensions.has(ext)) {
      score += 2;
      reasons.push(`Introduced new extension: .${ext}`);
      context.seenExtensions.add(ext);
      break; // Only count once per commit
    }
  }

  if (commit.filesChanged > 20) {
    score += 2;
    reasons.push(`${commit.filesChanged} files changed`);
  }
  if (commit.message.length > 200) {
    score += 1;
    reasons.push('Detailed commit message');
  }
  if (MERGE_RE.test(commit.messageHeadline)) {
    score -= 3;
    reasons.push('Merge commit (penalty)');
  }
  if (BUMP_RE.test(commit.messageHeadline)) {
    score -= 2;
    reasons.push('Version bump (penalty)');
  }

  return { score, reasons };
}

// =============================================================================
// ADAPTIVE TIME WINDOWS
// =============================================================================

/**
 * Build intelligent time windows from all commits.
 * - Start with month boundaries
 * - Split dense months
 * - Merge sparse adjacent months
 */
function buildAdaptiveWindows(
  allCommits: CommitData[],
  config: PreprocessorConfig
): AdaptiveTimeWindow[] {
  if (allCommits.length === 0) return [];

  // Sort by timestamp
  const sorted = allCommits.slice().sort((a, b) => a.timestampMs - b.timestampMs);
  const firstMs = sorted[0].timestampMs;
  const lastMs = sorted[sorted.length - 1].timestampMs;

  // Step 1: Build month buckets
  interface MonthBucket {
    year: number;
    month: number;
    startMs: number;
    endMs: number;
    commits: CommitData[];
  }

  const buckets: MonthBucket[] = [];
  const bucketMap = new Map<string, MonthBucket>();

  for (const commit of sorted) {
    const d = new Date(commit.timestampMs);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${month}`;

    let bucket = bucketMap.get(key);
    if (!bucket) {
      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      bucket = { year, month, startMs: start, endMs: end, commits: [] };
      bucketMap.set(key, bucket);
      buckets.push(bucket);
    }
    bucket.commits.push(commit);
  }

  // Sort buckets chronologically
  buckets.sort((a, b) => a.startMs - b.startMs);

  // Step 2: Build initial windows
  let windows: AdaptiveTimeWindow[] = buckets.map((bucket, i) => {
    const activeDays = getActiveDays(bucket.commits);
    const density = activeDays > 0 ? bucket.commits.length / activeDays : 0;
    return {
      id: generateId('w', i),
      startMs: bucket.startMs,
      endMs: bucket.endMs,
      startDate: toISO(bucket.startMs),
      endDate: toISO(bucket.endMs),
      durationDays: daysBetween(bucket.startMs, bucket.endMs),
      commitCount: bucket.commits.length,
      density,
    };
  });

  // Step 3: Split dense windows (density > threshold)
  const splitResult: AdaptiveTimeWindow[] = [];
  let windowIndex = 0;
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    if (w.density > config.densitySplitThreshold && w.commitCount > 20) {
      // Split into two halves
      const midMs = Math.floor((w.startMs + w.endMs) / 2);
      const bucket = buckets[i];
      const firstHalf = bucket.commits.filter(c => c.timestampMs <= midMs);
      const secondHalf = bucket.commits.filter(c => c.timestampMs > midMs);

      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const ad1 = getActiveDays(firstHalf);
        const ad2 = getActiveDays(secondHalf);
        splitResult.push({
          id: generateId('w', windowIndex++),
          startMs: w.startMs,
          endMs: midMs,
          startDate: toISO(w.startMs),
          endDate: toISO(midMs),
          durationDays: daysBetween(w.startMs, midMs),
          commitCount: firstHalf.length,
          density: ad1 > 0 ? firstHalf.length / ad1 : 0,
        });
        splitResult.push({
          id: generateId('w', windowIndex++),
          startMs: midMs + 1,
          endMs: w.endMs,
          startDate: toISO(midMs + 1),
          endDate: toISO(w.endMs),
          durationDays: daysBetween(midMs + 1, w.endMs),
          commitCount: secondHalf.length,
          density: ad2 > 0 ? secondHalf.length / ad2 : 0,
        });
        continue;
      }
    }
    splitResult.push({ ...w, id: generateId('w', windowIndex++) });
  }

  // Step 4: Merge sparse adjacent windows (both density < threshold)
  const merged: AdaptiveTimeWindow[] = [];
  windowIndex = 0;
  for (let i = 0; i < splitResult.length; i++) {
    const current = splitResult[i];
    if (
      merged.length > 0 &&
      current.density < config.densityMergeThreshold &&
      merged[merged.length - 1].density < config.densityMergeThreshold
    ) {
      const prev = merged[merged.length - 1];
      prev.endMs = current.endMs;
      prev.endDate = current.endDate;
      prev.durationDays = daysBetween(prev.startMs, prev.endMs);
      prev.commitCount += current.commitCount;
      const totalActiveDays = Math.max(1, prev.durationDays * 0.3); // estimate
      prev.density = prev.commitCount / totalActiveDays;
    } else {
      merged.push({ ...current, id: generateId('w', windowIndex++) });
    }
  }

  return merged;
}

// =============================================================================
// WORK THEME DETECTION
// =============================================================================

function detectWorkThemes(
  commits: CommitData[],
  windowId: string
): WorkTheme[] {
  if (commits.length === 0) return [];

  // Cluster by top-level directory
  const dirClusters = new Map<
    string,
    {
      commits: CommitData[];
      extensions: Set<string>;
      messages: string[];
      contributors: Set<string>;
      additions: number;
      deletions: number;
    }
  >();

  for (const commit of commits) {
    const dirs = new Set<string>();
    for (const file of commit.files) {
      const dir = getDirectory(file.path);
      const topDir = dir.split('/')[0] || '.';
      dirs.add(topDir);
    }

    for (const dir of dirs) {
      let cluster = dirClusters.get(dir);
      if (!cluster) {
        cluster = {
          commits: [],
          extensions: new Set(),
          messages: [],
          contributors: new Set(),
          additions: 0,
          deletions: 0,
        };
        dirClusters.set(dir, cluster);
      }
      cluster.commits.push(commit);
      cluster.messages.push(commit.messageHeadline);
      cluster.contributors.add(getContributorId(commit));
      cluster.additions += commit.additions;
      cluster.deletions += commit.deletions;
      for (const file of commit.files) {
        const ext = getExtension(file.path);
        if (ext) cluster.extensions.add(ext);
      }
    }
  }

  // Build themes from the top clusters
  const themes: WorkTheme[] = [];
  let themeIdx = 0;

  const entries = Array.from(dirClusters.entries())
    .sort((a, b) => b[1].commits.length - a[1].commits.length)
    .slice(0, 5);

  for (const [dir, cluster] of entries) {
    if (cluster.commits.length < 2) continue;

    const category = inferThemeCategory(cluster.messages);
    const label = inferThemeLabel(dir, category, cluster.messages);

    // Pick 2-5 most informative messages (longest non-merge, unique)
    const seen = new Set<string>();
    const repMessages: string[] = [];
    const sortedMsgs = cluster.messages
      .filter(m => !MERGE_RE.test(m) && m.length > 5)
      .sort((a, b) => b.length - a.length);
    for (const msg of sortedMsgs) {
      const norm = msg.toLowerCase().trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        repMessages.push(msg);
        if (repMessages.length >= 5) break;
      }
    }

    themes.push({
      id: generateId(`${windowId}-theme`, themeIdx++),
      label,
      category,
      modules: [dir],
      extensions: Array.from(cluster.extensions),
      representativeMessages: repMessages.slice(0, 5),
      commitCount: cluster.commits.length,
      netDelta: cluster.additions - cluster.deletions,
      contributorIds: Array.from(cluster.contributors),
    });
  }

  return themes;
}

function inferThemeCategory(messages: string[]): ThemeCategory {
  let feat = 0, fix = 0, refactor = 0, test = 0, docs = 0, chore = 0, ci = 0;
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    if (/^feat/i.test(msg) || /\b(add|implement|create|new)\b/i.test(lower)) feat++;
    if (/^fix/i.test(msg) || /\b(bug|fix|patch|resolve)\b/i.test(lower)) fix++;
    if (/^refactor/i.test(msg) || /\b(refactor|restructure|reorganize|rename)\b/i.test(lower)) refactor++;
    if (/^test/i.test(msg) || /\b(test|spec|coverage)\b/i.test(lower)) test++;
    if (/^docs/i.test(msg) || /\b(readme|documentation|doc)\b/i.test(lower)) docs++;
    if (/^chore/i.test(msg) || /\b(deps|dependency|update|bump)\b/i.test(lower)) chore++;
    if (/^ci/i.test(msg) || /\b(ci|pipeline|workflow|deploy|docker)\b/i.test(lower)) ci++;
  }

  const total = messages.length;
  if (feat / total > 0.4) return 'feature-build';
  if (fix / total > 0.4) return 'bug-fix-campaign';
  if (refactor / total > 0.3) return 'refactor-migration';
  if (test / total > 0.3) return 'testing';
  if (docs / total > 0.3) return 'documentation';
  if (chore / total > 0.3) return 'dependency-management';
  if (ci / total > 0.3) return 'infrastructure';
  return 'mixed';
}

function inferThemeLabel(
  directory: string,
  category: ThemeCategory,
  messages: string[]
): string {
  const categoryLabels: Record<ThemeCategory, string> = {
    'feature-build': 'Feature Development',
    'bug-fix-campaign': 'Bug Fix Campaign',
    'refactor-migration': 'Refactoring',
    'infrastructure': 'Infrastructure',
    'testing': 'Testing',
    'documentation': 'Documentation',
    'dependency-management': 'Dependency Management',
    'initial-setup': 'Initial Setup',
    'cleanup': 'Cleanup',
    'exploration': 'Exploration',
    'release-prep': 'Release Preparation',
    'mixed': 'Active Development',
  };

  const base = categoryLabels[category];
  if (directory !== '.') {
    return `${base} in ${directory}/`;
  }
  return base;
}

// =============================================================================
// NARRATIVE EVENT DETECTION
// =============================================================================

function detectNarrativeEvents(
  windows: AdaptiveTimeWindow[],
  commitsByRepo: Record<string, CommitData[]>,
  config: PreprocessorConfig
): NarrativeEvent[] {
  const events: NarrativeEvent[] = [];
  let eventIdx = 0;

  // === Project lifecycle events ===
  for (const [repoId, commits] of Object.entries(commitsByRepo)) {
    if (commits.length === 0) continue;
    const sorted = commits.slice().sort((a, b) => a.timestampMs - b.timestampMs);
    const repoName = sorted[0].repoName;
    const firstCommit = sorted[0];
    const windowId = findWindowForTimestamp(windows, firstCommit.timestampMs);

    // Project birth
    events.push({
      id: generateId('event', eventIdx++),
      timestampMs: firstCommit.timestampMs,
      date: toDateStr(firstCommit.timestampMs),
      category: 'project-birth',
      title: `${repoName} is born`,
      description: `The first commit in ${repoName}: "${firstCommit.messageHeadline}"`,
      repoIds: [repoId],
      contributorIds: [getContributorId(firstCommit)],
      significance: 8,
      evidenceCommits: [firstCommit.sha],
      evidenceFiles: firstCommit.files.slice(0, 5).map(f => f.path),
      quantitativeEvidence: `${firstCommit.additions} lines added across ${firstCommit.filesChanged} files`,
      windowId,
    });

    // Detect gaps for abandonment/revival
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestampMs - sorted[i - 1].timestampMs;
      const gapDays = gap / DAY_MS;

      if (gapDays >= config.abandonmentGapDays) {
        const abandonWid = findWindowForTimestamp(windows, sorted[i - 1].timestampMs);
        events.push({
          id: generateId('event', eventIdx++),
          timestampMs: sorted[i - 1].timestampMs,
          date: toDateStr(sorted[i - 1].timestampMs),
          category: 'project-abandonment',
          title: `${repoName} goes silent`,
          description: `${Math.round(gapDays)} days of silence after "${sorted[i - 1].messageHeadline}"`,
          repoIds: [repoId],
          contributorIds: [getContributorId(sorted[i - 1])],
          significance: 6,
          evidenceCommits: [sorted[i - 1].sha],
          evidenceFiles: [],
          quantitativeEvidence: `${Math.round(gapDays)} day gap`,
          windowId: abandonWid,
        });

        const revivalWid = findWindowForTimestamp(windows, sorted[i].timestampMs);
        events.push({
          id: generateId('event', eventIdx++),
          timestampMs: sorted[i].timestampMs,
          date: toDateStr(sorted[i].timestampMs),
          category: 'project-revival',
          title: `${repoName} is revived`,
          description: `After ${Math.round(gapDays)} days of silence, development resumes: "${sorted[i].messageHeadline}"`,
          repoIds: [repoId],
          contributorIds: [getContributorId(sorted[i])],
          significance: 7,
          evidenceCommits: [sorted[i].sha],
          evidenceFiles: sorted[i].files.slice(0, 5).map(f => f.path),
          quantitativeEvidence: `Revival after ${Math.round(gapDays)} day gap`,
          windowId: revivalWid,
        });
      }
    }

    // New contributor detection
    const contributorFirstSeen = new Map<string, CommitData>();
    for (const commit of sorted) {
      const cid = getContributorId(commit);
      if (!contributorFirstSeen.has(cid)) {
        contributorFirstSeen.set(cid, commit);
      }
    }

    // Skip the first contributor (they created the repo)
    let skipFirst = true;
    for (const [cid, commit] of contributorFirstSeen) {
      if (skipFirst) { skipFirst = false; continue; }
      const wid = findWindowForTimestamp(windows, commit.timestampMs);
      events.push({
        id: generateId('event', eventIdx++),
        timestampMs: commit.timestampMs,
        date: toDateStr(commit.timestampMs),
        category: 'new-contributor',
        title: `${commit.author.name} joins ${repoName}`,
        description: `New contributor ${commit.author.name} makes their first commit: "${commit.messageHeadline}"`,
        repoIds: [repoId],
        contributorIds: [cid],
        significance: 5,
        evidenceCommits: [commit.sha],
        evidenceFiles: [],
        quantitativeEvidence: `First commit by ${commit.author.name}`,
        windowId: wid,
      });
    }

    // Technology adoption: first time a new file extension appears
    const seenExt = new Set<string>();
    const interestingExts = new Set([
      'ts', 'tsx', 'py', 'go', 'rs', 'rb', 'java', 'kt', 'swift',
      'vue', 'svelte', 'test', 'spec', 'prisma', 'proto', 'graphql',
      'dockerfile', 'yml', 'yaml',
    ]);

    for (const commit of sorted) {
      for (const file of commit.files) {
        const ext = getExtension(file.path);
        if (ext && interestingExts.has(ext) && !seenExt.has(ext)) {
          seenExt.add(ext);
          if (seenExt.size > 1) {
            // Skip the very first extension
            const wid = findWindowForTimestamp(windows, commit.timestampMs);
            events.push({
              id: generateId('event', eventIdx++),
              timestampMs: commit.timestampMs,
              date: toDateStr(commit.timestampMs),
              category: 'technology-adoption',
              title: `.${ext} files appear in ${repoName}`,
              description: `The first .${ext} file arrives: ${file.path}`,
              repoIds: [repoId],
              contributorIds: [getContributorId(commit)],
              significance: 4,
              evidenceCommits: [commit.sha],
              evidenceFiles: [file.path],
              quantitativeEvidence: `First .${ext} file`,
              windowId: wid,
            });
          }
        }
      }
    }
  }

  // === Velocity events from windows ===
  if (windows.length >= 3) {
    // Compute rolling average density
    for (let i = 2; i < windows.length; i++) {
      const rollingAvg = (windows[i - 2].density + windows[i - 1].density) / 2;
      const current = windows[i];

      if (rollingAvg > 0 && current.density > rollingAvg * 3 && current.commitCount > 10) {
        events.push({
          id: generateId('event', eventIdx++),
          timestampMs: current.startMs,
          date: toDateStr(current.startMs),
          category: 'sprint',
          title: 'Development sprint',
          description: `Commit velocity surged to ${current.density.toFixed(1)} commits/active-day, ${(current.density / rollingAvg).toFixed(1)}x the rolling average`,
          repoIds: [],
          contributorIds: [],
          significance: 6,
          evidenceCommits: [],
          evidenceFiles: [],
          quantitativeEvidence: `${current.commitCount} commits, ${current.density.toFixed(1)} per active day`,
          windowId: current.id,
        });
      }

      if (rollingAvg > 1 && current.density < rollingAvg * 0.2 && current.commitCount < 5) {
        events.push({
          id: generateId('event', eventIdx++),
          timestampMs: current.startMs,
          date: toDateStr(current.startMs),
          category: 'drought',
          title: 'Development slowdown',
          description: `Activity dropped to ${current.density.toFixed(1)} commits/active-day after averaging ${rollingAvg.toFixed(1)}`,
          repoIds: [],
          contributorIds: [],
          significance: 4,
          evidenceCommits: [],
          evidenceFiles: [],
          quantitativeEvidence: `${current.commitCount} commits total`,
          windowId: current.id,
        });
      }
    }
  }

  // Sort by significance descending, truncate
  events.sort((a, b) => b.significance - a.significance);
  return events.slice(0, config.maxEvents);
}

function findWindowForTimestamp(
  windows: AdaptiveTimeWindow[],
  ts: number
): string {
  for (const w of windows) {
    if (ts >= w.startMs && ts <= w.endMs) return w.id;
  }
  // Fallback: closest window
  if (windows.length === 0) return 'w-0';
  let closest = windows[0];
  let closestDist = Math.abs(ts - closest.startMs);
  for (let i = 1; i < windows.length; i++) {
    const dist = Math.abs(ts - windows[i].startMs);
    if (dist < closestDist) {
      closest = windows[i];
      closestDist = dist;
    }
  }
  return closest.id;
}

// =============================================================================
// CONTRIBUTOR PROFILES
// =============================================================================

function buildContributorProfiles(
  commitsByRepo: Record<string, CommitData[]>
): ContributorIntelligence[] {
  const profileMap = new Map<
    string,
    {
      name: string;
      login: string | null;
      avatarUrl: string | null;
      commits: CommitData[];
      repos: Map<string, CommitData[]>;
      moduleCounts: Map<string, number>;
      hourCounts: number[];
      weekendCount: number;
      conventionalCount: number;
      activeDates: Set<string>;
    }
  >();

  for (const [repoId, commits] of Object.entries(commitsByRepo)) {
    for (const commit of commits) {
      const cid = getContributorId(commit);
      let profile = profileMap.get(cid);
      if (!profile) {
        profile = {
          name: commit.author.name,
          login: commit.author.login,
          avatarUrl: commit.author.avatarUrl,
          commits: [],
          repos: new Map(),
          moduleCounts: new Map(),
          hourCounts: new Array(24).fill(0),
          weekendCount: 0,
          conventionalCount: 0,
          activeDates: new Set(),
        };
        profileMap.set(cid, profile);
      }

      profile.commits.push(commit);
      profile.activeDates.add(commit.dateKey);

      if (!profile.repos.has(repoId)) {
        profile.repos.set(repoId, []);
      }
      profile.repos.get(repoId)!.push(commit);

      profile.hourCounts[commit.hourOfDay]++;

      if (commit.dayOfWeek === 0 || commit.dayOfWeek === 6) {
        profile.weekendCount++;
      }

      if (CONVENTIONAL_RE.test(commit.messageHeadline)) {
        profile.conventionalCount++;
      }

      // Module tracking
      for (const file of commit.files) {
        const dir = getDirectory(file.path);
        const topDir = dir.split('/')[0] || '.';
        profile.moduleCounts.set(topDir, (profile.moduleCounts.get(topDir) || 0) + 1);
      }
    }
  }

  const profiles: ContributorIntelligence[] = [];

  for (const [cid, profile] of profileMap) {
    const allCommits = profile.commits.sort((a, b) => a.timestampMs - b.timestampMs);
    const totalCommits = allCommits.length;
    if (totalCommits === 0) continue;

    const totalChanges = allCommits.reduce(
      (sum, c) => sum + c.additions + c.deletions,
      0
    );
    const activeDays = profile.activeDates.size;

    // Specializations
    const sortedModules = Array.from(profile.moduleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const totalModuleCommits = sortedModules.reduce((s, [, c]) => s + c, 0);
    const specializations = sortedModules.map(([module, count]) => ({
      module,
      commitCount: count,
      percentage: totalModuleCommits > 0 ? Math.round((count / totalModuleCommits) * 100) : 0,
    }));

    // Peak hours (top 3)
    const peakHours = profile.hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);

    // Infer role from file extensions
    const inferredRole = inferRole(profile.commits);

    // Gaps
    const gaps: Array<{ startDate: string; endDate: string; durationDays: number }> = [];
    for (let i = 1; i < allCommits.length; i++) {
      const gapDays = (allCommits[i].timestampMs - allCommits[i - 1].timestampMs) / DAY_MS;
      if (gapDays > 30) {
        gaps.push({
          startDate: toDateStr(allCommits[i - 1].timestampMs),
          endDate: toDateStr(allCommits[i].timestampMs),
          durationDays: Math.round(gapDays),
        });
      }
    }

    // Repo activity
    const repoActivity = Array.from(profile.repos.entries()).map(([repoId, repoCommits]) => {
      const sorted = repoCommits.sort((a, b) => a.timestampMs - b.timestampMs);
      return {
        repoId,
        firstCommitDate: toDateStr(sorted[0].timestampMs),
        lastCommitDate: toDateStr(sorted[sorted.length - 1].timestampMs),
        commitCount: sorted.length,
      };
    });

    profiles.push({
      id: cid,
      name: profile.name,
      login: profile.login,
      avatarUrl: profile.avatarUrl,
      specializations,
      inferredRole,
      avgCommitSize: totalCommits > 0 ? Math.round(totalChanges / totalCommits) : 0,
      commitsPerActiveDay: activeDays > 0 ? Math.round((totalCommits / activeDays) * 10) / 10 : 0,
      peakHours,
      weekendPercentage: totalCommits > 0 ? Math.round((profile.weekendCount / totalCommits) * 100) : 0,
      conventionalCommitRate: totalCommits > 0 ? Math.round((profile.conventionalCount / totalCommits) * 100) : 0,
      firstSeenDate: toDateStr(allCommits[0].timestampMs),
      lastSeenDate: toDateStr(allCommits[allCommits.length - 1].timestampMs),
      repoActivity,
      gaps: gaps.slice(0, 10),
      collaborators: [], // populated below
    });
  }

  // Build collaborator relationships
  const profileById = new Map(profiles.map(p => [p.id, p]));
  for (const profile of profiles) {
    const activeDatesSet = profileMap.get(profile.id)?.activeDates;
    if (!activeDatesSet) continue;

    for (const other of profiles) {
      if (other.id === profile.id) continue;
      const otherDates = profileMap.get(other.id)?.activeDates;
      if (!otherDates) continue;

      let shared = 0;
      for (const date of activeDatesSet) {
        if (otherDates.has(date)) shared++;
      }

      if (shared > 2) {
        const sharedRepos = profile.repoActivity
          .filter(ra => other.repoActivity.some(ob => ob.repoId === ra.repoId))
          .map(ra => ra.repoId);

        if (sharedRepos.length > 0) {
          profile.collaborators.push({
            contributorId: other.id,
            sharedActiveDays: shared,
            sharedRepos,
          });
        }
      }
    }

    // Sort by shared days, keep top 5
    profile.collaborators.sort((a, b) => b.sharedActiveDays - a.sharedActiveDays);
    profile.collaborators = profile.collaborators.slice(0, 5);
  }

  return profiles;
}

function inferRole(
  commits: CommitData[]
): 'fullstack' | 'frontend' | 'backend' | 'devops' | 'data' | 'generalist' {
  let frontend = 0, backend = 0, devops = 0, data = 0;
  const frontendExts = new Set(['tsx', 'jsx', 'vue', 'svelte', 'css', 'scss', 'html']);
  const backendExts = new Set(['py', 'go', 'java', 'rb', 'php', 'rs', 'cs']);
  const devopsExts = new Set(['yml', 'yaml', 'dockerfile', 'tf', 'sh']);
  const dataExts = new Set(['sql', 'csv', 'parquet', 'r', 'ipynb']);

  for (const commit of commits) {
    for (const file of commit.files) {
      const ext = getExtension(file.path);
      if (frontendExts.has(ext)) frontend++;
      if (backendExts.has(ext)) backend++;
      if (devopsExts.has(ext)) devops++;
      if (dataExts.has(ext)) data++;
    }
  }

  const total = frontend + backend + devops + data;
  if (total === 0) return 'generalist';

  if (frontend / total > 0.6) return 'frontend';
  if (backend / total > 0.6) return 'backend';
  if (devops / total > 0.4) return 'devops';
  if (data / total > 0.4) return 'data';
  if (frontend > 0 && backend > 0) return 'fullstack';
  return 'generalist';
}

// =============================================================================
// CROSS-REPO CORRELATIONS
// =============================================================================

function detectCrossRepoCorrelations(
  commitsByRepo: Record<string, CommitData[]>,
  repositories: Repository[]
): CrossRepoCorrelation[] {
  const repoIds = Object.keys(commitsByRepo);
  if (repoIds.length < 2) return [];

  const correlations: CrossRepoCorrelation[] = [];

  // Build per-repo active date sets and contributor sets
  const repoActiveDates = new Map<string, Set<string>>();
  const repoContributors = new Map<string, Set<string>>();

  for (const [repoId, commits] of Object.entries(commitsByRepo)) {
    const dates = new Set<string>();
    const contribs = new Set<string>();
    for (const c of commits) {
      dates.add(c.dateKey);
      contribs.add(getContributorId(c));
    }
    repoActiveDates.set(repoId, dates);
    repoContributors.set(repoId, contribs);
  }

  for (let i = 0; i < repoIds.length; i++) {
    for (let j = i + 1; j < repoIds.length; j++) {
      const repoA = repoIds[i];
      const repoB = repoIds[j];

      const datesA = repoActiveDates.get(repoA)!;
      const datesB = repoActiveDates.get(repoB)!;
      const contribsA = repoContributors.get(repoA)!;
      const contribsB = repoContributors.get(repoB)!;

      // Temporal correlation: shared active days
      let sharedDays = 0;
      for (const d of datesA) {
        if (datesB.has(d)) sharedDays++;
      }
      const minDays = Math.min(datesA.size, datesB.size);
      const temporalStrength = minDays > 0 ? sharedDays / minDays : 0;

      if (temporalStrength > 0.2) {
        correlations.push({
          repoA,
          repoB,
          type: 'temporal',
          strength: Math.round(temporalStrength * 100) / 100,
          evidence: `${sharedDays} shared active days out of ${minDays} minimum`,
          sharedContributors: [],
        });
      }

      // Author overlap
      const sharedContribs: string[] = [];
      for (const c of contribsA) {
        if (contribsB.has(c)) sharedContribs.push(c);
      }
      if (sharedContribs.length > 0) {
        const overlapStrength =
          sharedContribs.length / Math.min(contribsA.size, contribsB.size);
        correlations.push({
          repoA,
          repoB,
          type: 'author-overlap',
          strength: Math.round(overlapStrength * 100) / 100,
          evidence: `${sharedContribs.length} shared contributors`,
          sharedContributors: sharedContribs,
        });
      }
    }
  }

  // Sort by strength
  correlations.sort((a, b) => b.strength - a.strength);
  return correlations.slice(0, 50);
}

// =============================================================================
// DISCONTINUITY DETECTION
// =============================================================================

function detectDiscontinuities(
  commitsByRepo: Record<string, CommitData[]>,
  windows: AdaptiveTimeWindow[]
): Discontinuity[] {
  const discontinuities: Discontinuity[] = [];
  let idx = 0;

  for (const [repoId, commits] of Object.entries(commitsByRepo)) {
    if (commits.length < 5) continue;
    const sorted = commits.slice().sort((a, b) => a.timestampMs - b.timestampMs);

    for (let i = 1; i < sorted.length; i++) {
      const gapDays = (sorted[i].timestampMs - sorted[i - 1].timestampMs) / DAY_MS;
      if (gapDays > 21) {
        discontinuities.push({
          id: generateId('disc', idx++),
          type: 'gap',
          startDate: toDateStr(sorted[i - 1].timestampMs),
          endDate: toDateStr(sorted[i].timestampMs),
          durationDays: Math.round(gapDays),
          repoIds: [repoId],
          description: `${Math.round(gapDays)} day gap in ${sorted[0].repoName}`,
          severity: gapDays > 90 ? 5 : gapDays > 60 ? 4 : gapDays > 30 ? 3 : 2,
        });
      }
    }
  }

  // Velocity changes between adjacent windows
  for (let i = 1; i < windows.length; i++) {
    const prev = windows[i - 1];
    const curr = windows[i];
    if (prev.density > 0 && curr.density > 0) {
      const ratio = curr.density / prev.density;
      if (ratio > 4 || ratio < 0.25) {
        discontinuities.push({
          id: generateId('disc', idx++),
          type: 'velocity-change',
          startDate: toDateStr(prev.startMs),
          endDate: toDateStr(curr.endMs),
          durationDays: daysBetween(prev.startMs, curr.endMs),
          repoIds: [],
          description: ratio > 4
            ? `Velocity jumped ${ratio.toFixed(1)}x`
            : `Velocity dropped to ${(ratio * 100).toFixed(0)}%`,
          severity: ratio > 8 || ratio < 0.1 ? 4 : 3,
        });
      }
    }
  }

  discontinuities.sort((a, b) => b.severity - a.severity);
  return discontinuities.slice(0, 30);
}

// =============================================================================
// WINDOW ANALYSIS
// =============================================================================

function analyzeWindow(
  window: AdaptiveTimeWindow,
  allCommits: CommitData[],
  events: NarrativeEvent[]
): WindowAnalysis {
  const windowCommits = allCommits.filter(
    c => c.timestampMs >= window.startMs && c.timestampMs <= window.endMs
  );

  const themes = detectWorkThemes(windowCommits, window.id);
  const windowEvents = events.filter(e => e.windowId === window.id);

  // Repo breakdown
  const repoMap = new Map<
    string,
    {
      repoName: string;
      count: number;
      additions: number;
      deletions: number;
      modules: Map<string, number>;
      contributors: Set<string>;
    }
  >();

  for (const commit of windowCommits) {
    let entry = repoMap.get(commit.repoId);
    if (!entry) {
      entry = {
        repoName: commit.repoName,
        count: 0,
        additions: 0,
        deletions: 0,
        modules: new Map(),
        contributors: new Set(),
      };
      repoMap.set(commit.repoId, entry);
    }
    entry.count++;
    entry.additions += commit.additions;
    entry.deletions += commit.deletions;
    entry.contributors.add(getContributorId(commit));
    for (const file of commit.files) {
      const dir = getDirectory(file.path).split('/')[0] || '.';
      entry.modules.set(dir, (entry.modules.get(dir) || 0) + 1);
    }
  }

  const repoBreakdown = Array.from(repoMap.entries()).map(([repoId, entry]) => ({
    repoId,
    repoName: entry.repoName,
    commitCount: entry.count,
    additions: entry.additions,
    deletions: entry.deletions,
    topModules: Array.from(entry.modules.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m]) => m),
    topContributors: Array.from(entry.contributors).slice(0, 5),
  }));

  const activeDays = getActiveDays(windowCommits);
  const uniqueContributors = new Set(windowCommits.map(c => getContributorId(c)));
  const uniqueRepos = new Set(windowCommits.map(c => c.repoId));
  const totalAdditions = windowCommits.reduce((s, c) => s + c.additions, 0);
  const totalDeletions = windowCommits.reduce((s, c) => s + c.deletions, 0);

  // Interestingness score
  let interestingness = 0;
  interestingness += Math.min(windowEvents.length * 1.5, 5); // events
  interestingness += Math.min(uniqueRepos.size * 0.5, 2); // multi-repo
  interestingness += Math.min(uniqueContributors.size * 0.3, 2); // collaboration
  if (window.density > 3) interestingness += 1; // high density

  // Notable commits (top 5 by score)
  const notableCommits = windowCommits
    .map(c => ({
      sha: c.sha,
      message: c.messageHeadline,
      author: c.author.name,
      repoId: c.repoId,
      totalChanges: c.totalChanges,
    }))
    .sort((a, b) => b.totalChanges - a.totalChanges)
    .slice(0, 5)
    .map(c => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      repoId: c.repoId,
      reason: `${c.totalChanges} lines changed`,
    }));

  return {
    window,
    themes,
    dominantTheme: themes.length > 0 ? themes[0] : null,
    events: windowEvents,
    repoBreakdown,
    metrics: {
      totalCommits: windowCommits.length,
      totalAdditions,
      totalDeletions,
      activeDays,
      uniqueContributors: uniqueContributors.size,
      uniqueRepos: uniqueRepos.size,
      relativeVelocity: window.density,
    },
    notableCommits,
    interestingnessScore: Math.min(10, Math.round(interestingness * 10) / 10),
  };
}

// =============================================================================
// NARRATIVE ARC SUGGESTION
// =============================================================================

function suggestNarrativeArc(
  windowAnalyses: WindowAnalysis[],
  events: NarrativeEvent[]
): CommitIntelligenceResult['narrativeArc'] {
  if (windowAnalyses.length === 0) {
    return {
      acts: [],
      arcType: 'single-chapter',
      arcSummary: 'Not enough data to suggest a narrative arc.',
    };
  }

  // Divide windows into 3 acts
  const third = Math.ceil(windowAnalyses.length / 3);
  const act1Windows = windowAnalyses.slice(0, third);
  const act2Windows = windowAnalyses.slice(third, third * 2);
  const act3Windows = windowAnalyses.slice(third * 2);

  const acts = [
    {
      number: 1,
      suggestedTitle: 'The Beginning',
      windowIds: act1Windows.map(w => w.window.id),
      keyEventIds: events
        .filter(e => act1Windows.some(w => w.window.id === e.windowId))
        .slice(0, 5)
        .map(e => e.id),
      characterization: summarizeAct(act1Windows),
    },
    {
      number: 2,
      suggestedTitle: 'The Building',
      windowIds: act2Windows.map(w => w.window.id),
      keyEventIds: events
        .filter(e => act2Windows.some(w => w.window.id === e.windowId))
        .slice(0, 5)
        .map(e => e.id),
      characterization: summarizeAct(act2Windows),
    },
    {
      number: 3,
      suggestedTitle: 'The Current State',
      windowIds: act3Windows.map(w => w.window.id),
      keyEventIds: events
        .filter(e => act3Windows.some(w => w.window.id === e.windowId))
        .slice(0, 5)
        .map(e => e.id),
      characterization: summarizeAct(act3Windows),
    },
  ];

  // Determine arc type
  const avgInterestingness = windowAnalyses.reduce(
    (s, w) => s + w.interestingnessScore,
    0
  ) / windowAnalyses.length;

  let arcType = 'steady-growth';
  const hasBirths = events.some(e => e.category === 'project-birth');
  const hasAbandonment = events.some(e => e.category === 'project-abandonment');
  const hasRevival = events.some(e => e.category === 'project-revival');
  const hasSprints = events.some(e => e.category === 'sprint');

  if (hasAbandonment && hasRevival) arcType = 'phoenix-rising';
  else if (hasSprints) arcType = 'sprint-driven';
  else if (windowAnalyses.length > 10) arcType = 'long-journey';
  else if (hasBirths && windowAnalyses.length <= 3) arcType = 'new-beginning';

  return {
    acts,
    arcType,
    arcSummary: `A ${arcType} narrative across ${windowAnalyses.length} time periods with ${events.length} key events.`,
  };
}

function summarizeAct(windows: WindowAnalysis[]): string {
  if (windows.length === 0) return 'No activity in this period.';
  const totalCommits = windows.reduce((s, w) => s + w.metrics.totalCommits, 0);
  const repos = new Set<string>();
  for (const w of windows) {
    for (const rb of w.repoBreakdown) repos.add(rb.repoName);
  }
  return `${totalCommits} commits across ${repos.size} repos: ${Array.from(repos).slice(0, 3).join(', ')}`;
}

// =============================================================================
// TOKEN-BUDGETED SERIALIZATION
// =============================================================================

/**
 * Serialize the intelligence result for a prompt, respecting a token budget.
 * Allocates more tokens to high-interestingness windows.
 */
export function serializeForPrompt(
  result: CommitIntelligenceResult,
  maxTokens: number = 60000
): string {
  const maxChars = maxTokens * 4; // rough estimate
  const parts: string[] = [];

  // Meta (always include)
  parts.push(`## Overview
Total commits: ${result.meta.totalCommits}
Repos: ${result.meta.totalRepos}
Date range: ${result.meta.dateRange.start} to ${result.meta.dateRange.end} (${result.meta.dateRange.totalDays} days)
Contributors: ${result.meta.uniqueContributors}
Time windows: ${result.meta.windowCount}
Arc type: ${result.narrativeArc.arcType}
`);

  // Contributors (compact)
  if (result.contributors.length > 0) {
    parts.push(`## Contributors`);
    for (const c of result.contributors.slice(0, 10)) {
      parts.push(
        `- ${c.name}${c.login ? ` (@${c.login})` : ''}: ${c.inferredRole}, ` +
        `${c.repoActivity.length} repos, ` +
        `peak hours ${c.peakHours.join('/')}, ` +
        `${c.weekendPercentage}% weekend, ` +
        `${c.commitsPerActiveDay} commits/active-day, ` +
        `first: ${c.firstSeenDate}, last: ${c.lastSeenDate}` +
        (c.gaps.length > 0 ? `, ${c.gaps.length} gap(s) (longest: ${c.gaps[0].durationDays}d)` : '')
      );
    }
    parts.push('');
  }

  // Narrative events (always include all)
  if (result.narrativeEvents.length > 0) {
    parts.push(`## Key Events`);
    for (const e of result.narrativeEvents) {
      parts.push(
        `- [${e.date}] ${e.category}: ${e.title} (significance: ${e.significance}/10) — ${e.description}` +
        (e.evidenceCommits.length > 0 ? ` [SHA: ${e.evidenceCommits[0].slice(0, 7)}]` : '')
      );
    }
    parts.push('');
  }

  // Cross-repo correlations
  if (result.crossRepoCorrelations.length > 0) {
    parts.push(`## Cross-Repo Connections`);
    for (const c of result.crossRepoCorrelations.slice(0, 10)) {
      parts.push(`- ${c.repoA} <-> ${c.repoB}: ${c.type} (strength: ${c.strength}) — ${c.evidence}`);
    }
    parts.push('');
  }

  // Discontinuities
  if (result.discontinuities.length > 0) {
    parts.push(`## Discontinuities`);
    for (const d of result.discontinuities.slice(0, 10)) {
      parts.push(`- ${d.type}: ${d.description} (${d.startDate}${d.endDate ? ` to ${d.endDate}` : ''}, severity: ${d.severity}/5)`);
    }
    parts.push('');
  }

  // Windows: allocate detail proportional to interestingness
  parts.push(`## Time Windows`);
  const totalInterestingness = result.windows.reduce(
    (s, w) => s + w.interestingnessScore,
    0
  );

  let usedChars = parts.join('\n').length;
  const remainingChars = maxChars - usedChars - 2000; // Reserve space for interesting commits

  for (const wa of result.windows) {
    const budgetRatio =
      totalInterestingness > 0
        ? wa.interestingnessScore / totalInterestingness
        : 1 / result.windows.length;
    const windowBudget = Math.max(200, Math.floor(remainingChars * budgetRatio));

    if (wa.interestingnessScore >= 4) {
      // High interest: full details
      let detail = `\n### ${wa.window.startDate.slice(0, 10)} to ${wa.window.endDate.slice(0, 10)} ` +
        `(${wa.metrics.totalCommits} commits, ${wa.metrics.uniqueRepos} repos, ` +
        `${wa.metrics.uniqueContributors} contributors, ` +
        `density: ${wa.window.density.toFixed(1)}, ` +
        `interest: ${wa.interestingnessScore}/10)\n`;

      if (wa.dominantTheme) {
        detail += `Theme: ${wa.dominantTheme.label} (${wa.dominantTheme.category})\n`;
        if (wa.dominantTheme.representativeMessages.length > 0) {
          detail += `Sample messages:\n`;
          for (const msg of wa.dominantTheme.representativeMessages.slice(0, 3)) {
            detail += `  > "${msg}"\n`;
          }
        }
      }

      for (const nc of wa.notableCommits.slice(0, 3)) {
        detail += `Notable: "${nc.message}" by ${nc.author} — ${nc.reason}\n`;
      }

      if (detail.length > windowBudget) {
        detail = detail.slice(0, windowBudget) + '...\n';
      }

      parts.push(detail);
    } else if (wa.interestingnessScore >= 2) {
      // Medium interest: summary line
      parts.push(
        `\n${wa.window.startDate.slice(0, 10)} to ${wa.window.endDate.slice(0, 10)}: ` +
        `${wa.metrics.totalCommits} commits, ${wa.metrics.uniqueRepos} repos` +
        (wa.dominantTheme ? `, theme: ${wa.dominantTheme.label}` : '') +
        ` (interest: ${wa.interestingnessScore}/10)`
      );
    } else {
      // Low interest: minimal
      parts.push(
        `${wa.window.startDate.slice(0, 10)}-${wa.window.endDate.slice(0, 10)}: ` +
        `${wa.metrics.totalCommits} commits (quiet period)`
      );
    }
  }

  // Interesting commits
  if (result.interestingCommits.length > 0) {
    parts.push(`\n## Most Interesting Commits`);
    for (const sc of result.interestingCommits.slice(0, 20)) {
      parts.push(
        `- [${sc.timestamp.slice(0, 10)}] ${sc.shortSha} "${sc.messageHeadline}" ` +
        `by ${sc.authorName} in ${sc.repoName} ` +
        `(+${sc.additions}/-${sc.deletions}, ${sc.filesChanged} files, score: ${sc.interestScore}) ` +
        `[${sc.scoreReasons.join(', ')}]`
      );
    }
  }

  let serialized = parts.join('\n');

  // Final truncation safety
  if (serialized.length > maxChars) {
    serialized = serialized.slice(0, maxChars) + '\n\n[Truncated to fit token budget]';
  }

  return serialized;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Analyze commit intelligence from all repositories.
 * Pure local computation — zero API calls.
 *
 * @param commitsByRepo - Map of repoId -> CommitData[]
 * @param repositories - Repository metadata
 * @param config - Optional configuration overrides
 * @returns Complete intelligence result
 */
export function analyzeCommitIntelligence(
  commitsByRepo: Record<string, CommitData[]>,
  repositories: Repository[],
  config?: Partial<PreprocessorConfig>
): CommitIntelligenceResult {
  const cfg: PreprocessorConfig = { ...DEFAULT_CONFIG, ...config };

  // Flatten all commits
  const allCommits: CommitData[] = [];
  for (const commits of Object.values(commitsByRepo)) {
    for (const c of commits) {
      allCommits.push(c);
    }
  }

  if (allCommits.length === 0) {
    return {
      meta: {
        totalCommits: 0,
        totalRepos: 0,
        dateRange: { start: '', end: '', totalDays: 0 },
        uniqueContributors: 0,
        analyzedAt: Date.now(),
        windowCount: 0,
      },
      windows: [],
      narrativeEvents: [],
      contributors: [],
      crossRepoCorrelations: [],
      discontinuities: [],
      interestingCommits: [],
      narrativeArc: { acts: [], arcType: 'empty', arcSummary: 'No data.' },
    };
  }

  // Sort all commits by time
  allCommits.sort((a, b) => a.timestampMs - b.timestampMs);

  const firstTs = allCommits[0].timestampMs;
  const lastTs = allCommits[allCommits.length - 1].timestampMs;
  const uniqueContributors = new Set<string>();
  for (const c of allCommits) {
    uniqueContributors.add(getContributorId(c));
  }

  // Step 1: Build adaptive time windows
  const windows = buildAdaptiveWindows(allCommits, cfg);

  // Step 2: Detect narrative events
  const narrativeEvents = detectNarrativeEvents(windows, commitsByRepo, cfg);

  // Step 3: Build contributor profiles
  const contributors = buildContributorProfiles(commitsByRepo);

  // Step 4: Cross-repo correlations
  const crossRepoCorrelations = detectCrossRepoCorrelations(
    commitsByRepo,
    repositories
  );

  // Step 5: Discontinuities
  const discontinuities = detectDiscontinuities(commitsByRepo, windows);

  // Step 6: Score interesting commits
  const interestingCommits = scoreInterestingCommits(
    commitsByRepo,
    cfg
  );

  // Step 7: Analyze each window
  const windowAnalyses = windows.map(w =>
    analyzeWindow(w, allCommits, narrativeEvents)
  );

  // Step 8: Suggest narrative arc
  const narrativeArc = suggestNarrativeArc(windowAnalyses, narrativeEvents);

  return {
    meta: {
      totalCommits: allCommits.length,
      totalRepos: Object.keys(commitsByRepo).length,
      dateRange: {
        start: toISO(firstTs),
        end: toISO(lastTs),
        totalDays: daysBetween(firstTs, lastTs),
      },
      uniqueContributors: uniqueContributors.size,
      analyzedAt: Date.now(),
      windowCount: windowAnalyses.length,
    },
    windows: windowAnalyses,
    narrativeEvents,
    contributors,
    crossRepoCorrelations,
    discontinuities,
    interestingCommits,
    narrativeArc,
  };
}

// =============================================================================
// COMMIT SCORING (bulk)
// =============================================================================

function scoreInterestingCommits(
  commitsByRepo: Record<string, CommitData[]>,
  config: PreprocessorConfig
): ScoredCommit[] {
  const scoredCommits: ScoredCommit[] = [];

  for (const [repoId, commits] of Object.entries(commitsByRepo)) {
    if (commits.length === 0) continue;

    const sorted = commits.slice().sort((a, b) => a.timestampMs - b.timestampMs);

    // Compute p95 total changes
    const changes = sorted.map(c => c.totalChanges).sort((a, b) => a - b);
    const p95Index = Math.floor(changes.length * 0.95);
    const p95Changes = changes[p95Index] || 0;

    // Track seen extensions per repo
    const seenExtensions = new Set<string>();
    for (const commit of sorted) {
      for (const file of commit.files) {
        const ext = getExtension(file.path);
        if (ext) seenExtensions.add(ext);
      }
    }
    // Reset so we can track "first new" properly
    const scoringExtensions = new Set<string>();

    // Precompute gap information
    const isLastBeforeGap = new Set<number>();
    const isFirstAfterGap = new Set<number>();
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = (sorted[i].timestampMs - sorted[i - 1].timestampMs) / DAY_MS;
      if (gapDays > config.commitGapDays) {
        isLastBeforeGap.add(i - 1);
        isFirstAfterGap.add(i);
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const commit = sorted[i];
      const { score, reasons } = scoreCommitRaw(commit, {
        isFirstInRepo: i === 0,
        isLastBeforeGap: isLastBeforeGap.has(i),
        isFirstAfterGap: isFirstAfterGap.has(i),
        p95Changes,
        seenExtensions: scoringExtensions,
      });

      if (score >= 2) {
        scoredCommits.push({
          sha: commit.sha,
          shortSha: commit.shortSha,
          message: commit.message,
          messageHeadline: commit.messageHeadline,
          authorName: commit.author.name,
          authorLogin: commit.author.login,
          timestamp: commit.timestamp,
          repoId: commit.repoId,
          repoName: commit.repoName,
          additions: commit.additions,
          deletions: commit.deletions,
          filesChanged: commit.filesChanged,
          interestScore: score,
          scoreReasons: reasons,
        });
      }
    }
  }

  // Sort by score descending and truncate
  scoredCommits.sort((a, b) => b.interestScore - a.interestScore);
  return scoredCommits.slice(0, config.maxInterestingCommits);
}
