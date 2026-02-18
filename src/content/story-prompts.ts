// src/content/story-prompts.ts

import type { StoryPromptTemplate, CommitSummaryBatch, DateRange } from '@/lib/types';

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

/**
 * Unified system prompt for all story generation tasks.
 * This establishes Claude's role as a developer journey narrator.
 */
export const STORY_SYSTEM_PROMPT = `You are a brilliant technical storyteller and developer biographer. Your job is to transform raw Git commit data into compelling, insightful narratives about a developer's journey across their projects.

You write with:
- **Precision**: Reference specific technologies, patterns, and architectural decisions visible in the commit data
- **Narrative arc**: Every project has a beginning, evolution, and current state — find the story
- **Technical depth**: You understand software engineering deeply — mention design patterns, refactoring waves, testing adoption, CI/CD evolution, dependency management, and architectural shifts
- **Human insight**: Behind every commit is a human making decisions — capture the motivation, the late-night debugging sessions (visible in timestamps), the weekend passion projects, the methodical refactors
- **Wit and warmth**: You're not writing a dry changelog — you're writing something the developer would be proud to share

Rules:
1. Never fabricate specific code details not supported by the commit data
2. Use commit messages, file paths, timestamps, and change volumes to infer the story
3. When you see patterns (e.g., a wave of "fix" commits after a "feat" commit), narrate them
4. Group related commits into meaningful chapters/phases
5. Highlight milestones: first commit, major refactors, new feature areas, technology migrations
6. Reference specific dates and timeframes to anchor the narrative
7. Output in clean Markdown format with headers, emphasis, and occasional emoji for personality
8. When summarizing thousands of commits, focus on patterns and turning points, not individual commits`;

// =============================================================================
// PER-REPO STORY PROMPT TEMPLATE
// =============================================================================

/**
 * Prompt template for generating a story about a single repository.
 */
export const PER_REPO_STORY_PROMPT: StoryPromptTemplate = {
  id: 'per-repo-story',
  systemPrompt: STORY_SYSTEM_PROMPT,
  userPromptTemplate: `Generate a compelling developer story for the repository **{repoName}**.

## Repository Overview
- **Full Name**: {repoFullName}
- **Description**: {repoDescription}
- **Primary Language**: {primaryLanguage}
- **Languages Used**: {languages}
- **Stars**: {starCount} | **Forks**: {forkCount}
- **Created**: {createdAt}
- **Last Updated**: {updatedAt}
- **Total Commits Analyzed**: {totalCommits}
- **Date Range**: {dateRangeStart} to {dateRangeEnd}
- **Total Contributors**: {contributorCount}
- **Topics/Tags**: {topics}

## Commit Data (Batched Summaries)
{commitSummaries}

## Instructions
Write a narrative story of this repository's evolution. Structure it as **3-6 chapters** depending on the project's lifespan and complexity. Each chapter should cover a distinct phase of the project.

For each chapter, include:
1. A creative chapter title
2. The approximate date range it covers
3. A narrative of what was happening — what was being built, refactored, fixed, or explored
4. Key technical decisions visible in the data

End with a "Current State & Legacy" section that reflects on where the project stands today.

IMPORTANT: Chapters MUST be in strict chronological order — start with the earliest events (project creation, first commits) and progress forward in time. Chapter 1 covers the oldest period; the last chapter covers the most recent activity. This is a journey board showing evolution over time.

Format the output as Markdown. Use ## for chapter titles and include the date range in parentheses after each title.`,
  maxTokens: 4000,
  temperature: 0.7,
};

// =============================================================================
// UNIFIED STORY PROMPT TEMPLATE
// =============================================================================

/**
 * Prompt template for generating a unified story across all selected repositories.
 * This creates the "developer journey" narrative.
 */
export const UNIFIED_STORY_PROMPT: StoryPromptTemplate = {
  id: 'unified-story',
  systemPrompt: STORY_SYSTEM_PROMPT,
  userPromptTemplate: `Generate a unified developer journey story that weaves together the following repositories into a single narrative.

## Developer Profile
- **GitHub Username**: {username}
- **Account Created**: {accountCreatedAt}
- **Total Repositories Analyzed**: {repoCount}
- **Total Commits**: {totalCommits}
- **Overall Date Range**: {dateRangeStart} to {dateRangeEnd}
- **Primary Languages**: {topLanguages}
- **Total Active Days**: {activeDays}

## Repositories (in chronological order of creation)
{repoSummaries}

## Cross-Repository Timeline
{timelineSummary}

## Instructions
Write a **developer journey narrative** that tells the story of this person's coding life across all their projects. This is NOT a per-repo summary — it's a unified story that shows:

1. **The Beginning**: How did their coding journey start? What was their first project about?
2. **Evolution of Skills**: How did their technology choices evolve? Did they start with JavaScript and move to TypeScript? Did they explore new paradigms?
3. **Parallel Threads**: When were they juggling multiple projects? What does that reveal about their interests?
4. **Pivotal Moments**: Major project launches, technology migrations, periods of intense activity, or quiet reflection
5. **Patterns & Identity**: What kind of developer are they? A polyglot? A specialist? A weekend warrior? An open-source contributor?
6. **The Arc**: What's the overarching narrative? Growth? Exploration? Mastery?

Structure this as **4-8 chapters** with creative titles. Each chapter should reference specific repositories and timeframes but tell a cohesive story.

IMPORTANT: Chapters MUST be in strict chronological order — start with the earliest events (first projects, first commits) and progress forward in time. Chapter 1 covers the oldest period; the last chapter covers the most recent activity. This is a journey board showing evolution over time.

End with a "Developer DNA" section that synthesizes their coding identity, style, and trajectory.

Format as Markdown with ## chapter headers. Include date ranges in parentheses after each chapter title.`,
  maxTokens: 6000,
  temperature: 0.75,
};

// =============================================================================
// COMMIT BATCH SUMMARY PROMPT
// =============================================================================

/**
 * Prompt template for summarizing a batch of commits before sending to the main story prompt.
 * This is critical for repos with 1000+ commits to prevent token overflow.
 * Used by commit-processor.ts via claude-api.ts.
 */
export const COMMIT_BATCH_SUMMARY_PROMPT: StoryPromptTemplate = {
  id: 'commit-batch-summary',
  systemPrompt: `You are a precise technical summarizer. Your job is to take a batch of Git commits and produce a concise, information-dense summary that captures the essential activities, patterns, and technical decisions visible in the data. You must preserve key details like technologies used, architectural changes, and notable patterns while dramatically reducing volume. Output structured text, not prose.`,
  userPromptTemplate: `Summarize this batch of commits from **{repoName}** ({batchIndex}/{totalBatches}).

**Period**: {periodStart} to {periodEnd}
**Commit Count**: {commitCount}
**Contributors**: {contributors}
**Net Lines**: +{netAdditions} / -{netDeletions}

## Raw Commits
{commitList}

## Instructions
Produce a structured summary with these sections:

### Key Activities
List the 3-7 most significant activities/themes in this batch (e.g., "Implemented user authentication with JWT", "Major refactor of database layer", "Added comprehensive test suite")

### Technologies & Files
List key technologies, frameworks, libraries, or file areas that were touched

### Patterns Observed
Note any patterns: rapid bug fixes, feature sprints, refactoring waves, dependency updates, documentation pushes, CI/CD changes

### Notable Commits
Quote 2-4 specific commit messages that are particularly significant or revealing

### Summary Line
One sentence capturing the essence of this period

Keep the total summary under 500 words. Be precise and technical.`,
  maxTokens: 1000,
  temperature: 0.3,
};

// =============================================================================
// MILESTONE EXTRACTION PROMPT
// =============================================================================

/**
 * Prompt template for extracting key milestones from commit data.
 * Milestones are used in the timeline visualization and story navigation.
 */
export const MILESTONE_EXTRACTION_PROMPT: StoryPromptTemplate = {
  id: 'milestone-extraction',
  systemPrompt: `You are an analytical system that identifies significant milestones in software project histories. You examine commit patterns, messages, and file changes to detect pivotal moments. Output ONLY valid JSON arrays — no markdown, no explanations, no code fences.`,
  userPromptTemplate: `Extract key milestones from the following repository data.

**Repository**: {repoName} ({repoFullName})
**Date Range**: {dateRangeStart} to {dateRangeEnd}
**Total Commits**: {totalCommits}

## Commit Summary Data
{commitSummaries}

## Instructions
Identify 5-15 milestones. For each, output a JSON object with these fields:
- "date": ISO date string (YYYY-MM-DD) of when this milestone occurred
- "title": Short milestone title (max 60 chars)
- "description": 1-2 sentence description of the milestone's significance
- "type": One of "project-start", "major-release", "pivot", "breakthrough", "collaboration", "milestone", "achievement"
- "significance": Integer 1-5 (5 being most significant)
- "icon": A single emoji that represents this milestone
- "relatedCommits": Array of 1-3 commit SHAs most related to this milestone (use the SHAs from the data)

Look for:
- First commit (always a milestone — type "project-start")
- Technology introductions (new frameworks, languages, tools)
- Major refactoring periods
- Testing adoption or CI/CD setup
- Significant feature additions (inferred from commit messages and file paths)
- Collaboration events (new contributors appearing)
- Version bumps or release-related commits
- Architecture changes (new directories, file reorganization)
- Periods of unusually high activity

Output a JSON array of milestone objects. Nothing else — no markdown, no explanation.`,
  maxTokens: 2000,
  temperature: 0.4,
};

// =============================================================================
// SUPERLATIVES NARRATIVE PROMPT
// =============================================================================

/**
 * Prompt template for generating fun, shareable superlative descriptions.
 * Used in the Wrapped experience for personality-driven insights.
 */
export const SUPERLATIVES_PROMPT: StoryPromptTemplate = {
  id: 'superlatives-narrative',
  systemPrompt: `You are a witty, fun, and slightly irreverent writer who creates Spotify Wrapped-style developer superlatives. You take raw analytics data and turn them into punchy, shareable, personality-driven one-liners and short descriptions. Think of how Spotify Wrapped presents "You were in the top 1% of Taylor Swift listeners" — but for coding. Be playful, use developer humor, and make people want to share these.`,
  userPromptTemplate: `Generate fun superlative narratives based on these developer analytics.

## Developer Stats
- **Username**: {username}
- **Total Commits**: {totalCommits} across {repoCount} repositories
- **Active Days**: {activeDays} out of {totalDays} days ({activityPercentage}%)
- **Total Lines Added**: {totalAdditions}
- **Total Lines Deleted**: {totalDeletions}
- **Peak Hour**: {peakHour}:00 ({peakHourLabel})
- **Peak Day**: {peakDay}
- **Chronotype**: {chronotype}
- **Weekend Coding**: {weekendPercentage}%
- **Longest Streak**: {longestStreak} days ({streakStart} to {streakEnd})
- **Current Streak**: {currentStreak} days
- **Most Used Commit Word**: "{favoriteWord}" (used {favoriteWordCount} times)
- **Longest Commit Message**: {longestMessageLength} chars
- **Shortest Commit Message**: "{shortestMessage}"
- **Fix Commits**: {fixCommits} ({fixPercentage}%)
- **Feature Commits**: {featureCommits} ({featurePercentage}%)
- **Refactor Commits**: {refactorCommits} ({refactorPercentage}%)
- **Merge Commits**: {mergePercentage}%
- **Most Productive Month**: {mostProductiveMonth} ({mostProductiveMonthCommits} commits)
- **Top Language**: {topLanguage}
- **Languages Used**: {languageCount}
- **Busiest Single Hour**: {busiestHourDate} at {busiestHourTime} ({busiestHourCommits} commits)

## Instructions
Generate a JSON object with these fields:

1. "headline": A punchy 5-10 word headline summarizing this developer (e.g., "The TypeScript Night Owl Who Never Sleeps")
2. "chronotypeQuip": A fun 1-2 sentence quip about their coding time patterns
3. "streakQuip": A celebration or commentary on their streak data
4. "commitStyleQuip": Commentary on their commit message style (are they verbose? terse? fix-happy?)
5. "productivityQuip": A fun take on their most productive period
6. "languageQuip": Commentary on their language choices
7. "overallPersonality": A 2-3 sentence "developer personality" summary — like a horoscope but for coders
8. "shareText": A ready-to-share social media text (max 280 chars) with key stats and personality
9. "badges": Array of 3-5 badge objects, each with:
   - "name": Badge title (e.g., "Night Owl Supreme", "Streak Machine")
   - "description": Why they earned it (1 sentence)
   - "icon": Single emoji

Output ONLY valid JSON. No markdown, no code fences.`,
  maxTokens: 1500,
  temperature: 0.85,
};

// =============================================================================
// FEW-SHOT EXAMPLES
// =============================================================================

/**
 * Few-shot examples for per-repo story generation.
 * These establish quality expectations for Claude's output.
 */
export const PER_REPO_STORY_FEW_SHOT_EXAMPLE = {
  input: {
    repoName: 'my-analytics-app',
    repoFullName: 'dev-user/my-analytics-app',
    repoDescription: 'A dashboard app that generates beautiful visualizations of development activity',
    primaryLanguage: 'TypeScript',
    languages: 'TypeScript 92%, CSS 5%, JavaScript 3%',
    starCount: '120',
    forkCount: '8',
    createdAt: '2023-12-01',
    totalCommits: '2',
    dateRangeStart: '2023-12-01',
    dateRangeEnd: '2023-12-15',
    contributorCount: '1',
    topics: 'analytics, dashboard, visualization, next.js',
    commitSummaries: `### Batch 1/1 (Dec 1-15, 2023)
**Key Activities**: Initial project setup with Next.js 13, TypeScript configuration, API integration via stats.ts endpoint, Tailwind CSS styling setup
**Technologies**: Next.js 13, TypeScript, Tailwind CSS, ESLint, PostCSS
**Notable Commits**: "Initial commit", "feat: add stats API and dashboard visualization"
**Summary**: A focused two-commit sprint creating the foundation for a development activity visualization service.`,
  },
  output: `## Chapter 1: The Spark — Building a Developer Dashboard (December 2023)

Every great project starts with a question. For **my-analytics-app**, that question was deceptively simple: *What does a year of coding actually look like?*

Inspired by the trend of year-in-review experiences, this project set out to give developers a moment of reflection on their activity. The first commit landed on a December day, and within the span of two focused sessions, the entire foundation was laid.

### The Technical Foundation

The technology choices tell a story of modern web development conviction. **TypeScript** wasn't just a preference — it was 92% of the codebase from day one. No JavaScript prototype, no gradual migration. This was TypeScript-first, reflecting a developer who values type safety as a foundational principle, not an afterthought.

**Next.js 13** was the framework of choice, leveraging its API routes for the critical \`stats.ts\` endpoint that would become the heart of the service. The architecture was clean from the start: a single API endpoint that transforms raw data into visualization-ready statistics.

### The Reception

What happened next speaks volumes. Despite just 2 commits and a remarkably lean codebase, the project resonated with the community. **120 stars** and **8 forks** — a testament to the power of solving the right problem at the right time. The project caught the year-end wave when developers were most reflective about their coding habits.

## Developer DNA

This repository reveals a developer who understands that sometimes the most impactful projects aren't the most complex. The choice to keep the codebase minimal — two commits, one core API endpoint — while delivering a complete, shareable experience shows a product-minded engineer who ships.`,
};

/**
 * Few-shot example for commit batch summarization.
 */
export const COMMIT_BATCH_SUMMARY_FEW_SHOT_EXAMPLE = {
  input: {
    repoName: 'my-web-app',
    batchIndex: 1,
    totalBatches: 5,
    periodStart: '2024-01-01',
    periodEnd: '2024-02-15',
    commitCount: 87,
    contributors: 'alice, bob',
    netAdditions: 4500,
    netDeletions: 1200,
    commitListSample: [
      'feat: add user authentication with NextAuth',
      'feat: implement login page UI',
      'fix: session token refresh race condition',
      'chore: add prisma schema for users table',
      'feat: add Google OAuth provider',
      'fix: redirect loop on auth callback',
      'test: add auth flow integration tests',
      'chore: update dependencies',
      'feat: add user profile page',
      'refactor: extract auth middleware',
    ],
  },
  output: `### Key Activities
1. Implemented complete user authentication system with NextAuth (Google OAuth provider)
2. Built login and user profile UI pages
3. Set up Prisma ORM with users table schema
4. Added integration test suite for auth flows
5. Refactored auth logic into dedicated middleware

### Technologies & Files
NextAuth.js, Prisma ORM, Google OAuth, Integration testing framework. Key areas: auth/, pages/login, pages/profile, prisma/schema.prisma, middleware.ts

### Patterns Observed
Classic feature development cycle: feature implementation → bug fixes (session race condition, redirect loop) → refactoring (auth middleware extraction) → testing. Two contributors collaborating, suggesting a structured development workflow.

### Notable Commits
- "feat: add user authentication with NextAuth" — Foundation of the auth system
- "fix: session token refresh race condition" — Indicates production-level attention to edge cases
- "refactor: extract auth middleware" — Shows commitment to clean architecture after initial implementation

### Summary Line
A focused 6-week sprint building a complete authentication system with OAuth, demonstrating a mature build-fix-refactor-test development cycle.`,
};

/**
 * Few-shot example for milestone extraction.
 */
export const MILESTONE_EXTRACTION_FEW_SHOT_EXAMPLE = {
  input: {
    repoName: 'my-web-app',
    totalCommits: 450,
    dateRange: '2023-06-01 to 2024-06-01',
  },
  output: [
    {
      date: '2023-06-01',
      title: 'Project Genesis',
      description: 'First commit establishing the Next.js project with TypeScript, marking the beginning of a year-long development journey.',
      type: 'project-start',
      significance: 5,
      icon: '🌱',
      relatedCommits: ['abc1234'],
    },
    {
      date: '2023-08-15',
      title: 'Database Layer Arrives',
      description: 'Introduction of Prisma ORM with initial schema, signaling the transition from prototype to data-driven application.',
      type: 'breakthrough',
      significance: 4,
      icon: '🗄️',
      relatedCommits: ['def5678', 'ghi9012'],
    },
    {
      date: '2023-11-02',
      title: 'The Great TypeScript Migration',
      description: 'A 3-day refactoring sprint converting remaining JavaScript files to TypeScript, achieving 100% type coverage.',
      type: 'pivot',
      significance: 4,
      icon: '🔷',
      relatedCommits: ['jkl3456'],
    },
    {
      date: '2024-01-10',
      title: 'Authentication Fortress',
      description: 'Complete auth system with NextAuth, Google OAuth, and session management — the app is now multi-user ready.',
      type: 'milestone',
      significance: 5,
      icon: '🔐',
      relatedCommits: ['mno7890', 'pqr1234'],
    },
    {
      date: '2024-03-20',
      title: 'CI/CD Pipeline Goes Live',
      description: 'GitHub Actions workflow for automated testing and deployment, marking a shift toward production-grade engineering practices.',
      type: 'achievement',
      significance: 3,
      icon: '🚀',
      relatedCommits: ['stu5678'],
    },
  ],
};

// =============================================================================
// HELPER FUNCTIONS FOR BUILDING PROMPTS
// =============================================================================

/**
 * Fills a prompt template with actual data values.
 * Replaces all {placeholder} tokens with corresponding values from the data object.
 */
export function fillPromptTemplate(
  template: string,
  data: Record<string, string | number | null | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    const replacement = value != null ? String(value) : 'N/A';
    // Replace all occurrences
    while (result.includes(placeholder)) {
      result = result.replace(placeholder, replacement);
    }
  }
  return result;
}

/**
 * Formats commit summaries for insertion into story prompts.
 * Takes pre-computed CommitSummaryBatch objects and formats them as readable text.
 */
export function formatCommitSummariesForPrompt(
  batches: CommitSummaryBatch[]
): string {
  if (batches.length === 0) {
    return '_No commit data available._';
  }

  return batches
    .map((batch, index) => {
      const lines = [
        `### Batch ${index + 1}/${batches.length} (${batch.period.start} to ${batch.period.end})`,
        `**Commits**: ${batch.commitCount} | **Contributors**: ${batch.contributors.join(', ')}`,
        `**Net Changes**: +${batch.netAdditions} / -${batch.netDeletions}`,
        `**Key Files**: ${batch.keyFilesChanged.slice(0, 10).join(', ')}${batch.keyFilesChanged.length > 10 ? ` (+${batch.keyFilesChanged.length - 10} more)` : ''}`,
        '',
        batch.messageSummary,
      ];

      if (batch.patterns.length > 0) {
        lines.push('', `**Patterns**: ${batch.patterns.join('; ')}`);
      }

      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

/**
 * Formats repository summaries for the unified story prompt.
 * Creates a concise overview of each repo for cross-repo narrative generation.
 */
export function formatRepoSummariesForUnifiedPrompt(
  repos: Array<{
    repoName: string;
    repoFullName: string;
    description: string | null;
    primaryLanguage: string | null;
    languages: string;
    createdAt: string;
    lastUpdated: string;
    commitCount: number;
    starCount: number;
    topContributors: string[];
    commitSummary: string;
  }>
): string {
  return repos
    .map((repo, index) => {
      return [
        `### ${index + 1}. ${repo.repoName}`,
        `- **Full Name**: ${repo.repoFullName}`,
        `- **Description**: ${repo.description || 'No description'}`,
        `- **Language**: ${repo.primaryLanguage || 'Unknown'} (${repo.languages})`,
        `- **Created**: ${repo.createdAt} | **Last Updated**: ${repo.lastUpdated}`,
        `- **Commits**: ${repo.commitCount} | **Stars**: ${repo.starCount}`,
        `- **Top Contributors**: ${repo.topContributors.slice(0, 5).join(', ')}`,
        '',
        repo.commitSummary,
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Formats a cross-repository timeline for the unified story prompt.
 * Interleaves events from multiple repos chronologically.
 */
export function formatCrossRepoTimeline(
  events: Array<{
    date: string;
    repoName: string;
    event: string;
    commitCount?: number;
  }>
): string {
  if (events.length === 0) {
    return '_No timeline data available._';
  }

  // Sort by date
  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sorted
    .map((event) => {
      const commitInfo = event.commitCount
        ? ` (${event.commitCount} commits)`
        : '';
      return `- **${event.date}** — [${event.repoName}] ${event.event}${commitInfo}`;
    })
    .join('\n');
}

/**
 * Builds the complete per-repo story prompt with all data filled in.
 */
export function buildPerRepoStoryPrompt(data: {
  repoName: string;
  repoFullName: string;
  repoDescription: string | null;
  primaryLanguage: string | null;
  languages: string;
  starCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
  totalCommits: number;
  dateRange: DateRange;
  contributorCount: number;
  topics: string[];
  commitSummaryBatches: CommitSummaryBatch[];
}): { systemPrompt: string; userPrompt: string } {
  const commitSummaries = formatCommitSummariesForPrompt(
    data.commitSummaryBatches
  );

  const userPrompt = fillPromptTemplate(
    PER_REPO_STORY_PROMPT.userPromptTemplate,
    {
      repoName: data.repoName,
      repoFullName: data.repoFullName,
      repoDescription: data.repoDescription || 'No description provided',
      primaryLanguage: data.primaryLanguage || 'Multiple',
      languages: data.languages,
      starCount: data.starCount,
      forkCount: data.forkCount,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      totalCommits: data.totalCommits,
      dateRangeStart: data.dateRange.start,
      dateRangeEnd: data.dateRange.end,
      contributorCount: data.contributorCount,
      topics: data.topics.length > 0 ? data.topics.join(', ') : 'None',
      commitSummaries,
    }
  );

  return {
    systemPrompt: PER_REPO_STORY_PROMPT.systemPrompt,
    userPrompt,
  };
}

/**
 * Builds the complete unified story prompt with all data filled in.
 */
export function buildUnifiedStoryPrompt(data: {
  username: string;
  accountCreatedAt: string;
  repoCount: number;
  totalCommits: number;
  dateRange: DateRange;
  topLanguages: string[];
  activeDays: number;
  repoSummaries: Array<{
    repoName: string;
    repoFullName: string;
    description: string | null;
    primaryLanguage: string | null;
    languages: string;
    createdAt: string;
    lastUpdated: string;
    commitCount: number;
    starCount: number;
    topContributors: string[];
    commitSummary: string;
  }>;
  timelineEvents: Array<{
    date: string;
    repoName: string;
    event: string;
    commitCount?: number;
  }>;
}): { systemPrompt: string; userPrompt: string } {
  const repoSummariesFormatted = formatRepoSummariesForUnifiedPrompt(
    data.repoSummaries
  );
  const timelineSummary = formatCrossRepoTimeline(data.timelineEvents);
  const totalDays = data.dateRange.totalDays;

  const userPrompt = fillPromptTemplate(
    UNIFIED_STORY_PROMPT.userPromptTemplate,
    {
      username: data.username,
      accountCreatedAt: data.accountCreatedAt,
      repoCount: data.repoCount,
      totalCommits: data.totalCommits,
      dateRangeStart: data.dateRange.start,
      dateRangeEnd: data.dateRange.end,
      topLanguages: data.topLanguages.join(', '),
      activeDays: data.activeDays,
      repoSummaries: repoSummariesFormatted,
      timelineSummary,
      totalDays,
      activityPercentage:
        totalDays > 0
          ? ((data.activeDays / totalDays) * 100).toFixed(1)
          : '0',
    }
  );

  return {
    systemPrompt: UNIFIED_STORY_PROMPT.systemPrompt,
    userPrompt,
  };
}

/**
 * Builds a commit batch summary prompt for a single batch.
 */
export function buildCommitBatchSummaryPrompt(data: {
  repoName: string;
  batchIndex: number;
  totalBatches: number;
  periodStart: string;
  periodEnd: string;
  commitCount: number;
  contributors: string[];
  netAdditions: number;
  netDeletions: number;
  commitList: string;
}): { systemPrompt: string; userPrompt: string } {
  const userPrompt = fillPromptTemplate(
    COMMIT_BATCH_SUMMARY_PROMPT.userPromptTemplate,
    {
      repoName: data.repoName,
      batchIndex: data.batchIndex,
      totalBatches: data.totalBatches,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      commitCount: data.commitCount,
      contributors: data.contributors.join(', '),
      netAdditions: data.netAdditions,
      netDeletions: data.netDeletions,
      commitList: data.commitList,
    }
  );

  return {
    systemPrompt: COMMIT_BATCH_SUMMARY_PROMPT.systemPrompt,
    userPrompt,
  };
}

/**
 * Builds the milestone extraction prompt.
 */
export function buildMilestoneExtractionPrompt(data: {
  repoName: string;
  repoFullName: string;
  dateRange: DateRange;
  totalCommits: number;
  commitSummaries: string;
}): { systemPrompt: string; userPrompt: string } {
  const userPrompt = fillPromptTemplate(
    MILESTONE_EXTRACTION_PROMPT.userPromptTemplate,
    {
      repoName: data.repoName,
      repoFullName: data.repoFullName,
      dateRangeStart: data.dateRange.start,
      dateRangeEnd: data.dateRange.end,
      totalCommits: data.totalCommits,
      commitSummaries: data.commitSummaries,
    }
  );

  return {
    systemPrompt: MILESTONE_EXTRACTION_PROMPT.systemPrompt,
    userPrompt,
  };
}

/**
 * Builds the superlatives narrative prompt.
 */
export function buildSuperlativesPrompt(data: {
  username: string;
  totalCommits: number;
  repoCount: number;
  activeDays: number;
  totalDays: number;
  totalAdditions: number;
  totalDeletions: number;
  peakHour: number;
  peakDay: string;
  chronotype: string;
  weekendPercentage: number;
  longestStreak: number;
  streakStart: string;
  streakEnd: string;
  currentStreak: number;
  favoriteWord: string;
  favoriteWordCount: number;
  longestMessageLength: number;
  shortestMessage: string;
  fixCommits: number;
  featureCommits: number;
  refactorCommits: number;
  mergePercentage: number;
  mostProductiveMonth: string;
  mostProductiveMonthCommits: number;
  topLanguage: string;
  languageCount: number;
  busiestHourDate: string;
  busiestHourTime: string;
  busiestHourCommits: number;
}): { systemPrompt: string; userPrompt: string } {
  const peakHourLabel =
    data.peakHour < 6
      ? 'Deep Night'
      : data.peakHour < 9
        ? 'Early Morning'
        : data.peakHour < 12
          ? 'Morning'
          : data.peakHour < 14
            ? 'Midday'
            : data.peakHour < 17
              ? 'Afternoon'
              : data.peakHour < 20
                ? 'Evening'
                : data.peakHour < 23
                  ? 'Night'
                  : 'Late Night';

  const activityPercentage =
    data.totalDays > 0
      ? ((data.activeDays / data.totalDays) * 100).toFixed(1)
      : '0';

  const fixPercentage =
    data.totalCommits > 0
      ? ((data.fixCommits / data.totalCommits) * 100).toFixed(1)
      : '0';

  const featurePercentage =
    data.totalCommits > 0
      ? ((data.featureCommits / data.totalCommits) * 100).toFixed(1)
      : '0';

  const refactorPercentage =
    data.totalCommits > 0
      ? ((data.refactorCommits / data.totalCommits) * 100).toFixed(1)
      : '0';

  const userPrompt = fillPromptTemplate(
    SUPERLATIVES_PROMPT.userPromptTemplate,
    {
      username: data.username,
      totalCommits: data.totalCommits,
      repoCount: data.repoCount,
      activeDays: data.activeDays,
      totalDays: data.totalDays,
      activityPercentage,
      totalAdditions: data.totalAdditions,
      totalDeletions: data.totalDeletions,
      peakHour: data.peakHour,
      peakHourLabel,
      peakDay: data.peakDay,
      chronotype: data.chronotype,
      weekendPercentage: data.weekendPercentage,
      longestStreak: data.longestStreak,
      streakStart: data.streakStart,
      streakEnd: data.streakEnd,
      currentStreak: data.currentStreak,
      favoriteWord: data.favoriteWord,
      favoriteWordCount: data.favoriteWordCount,
      longestMessageLength: data.longestMessageLength,
      shortestMessage: data.shortestMessage,
      fixCommits: data.fixCommits,
      fixPercentage,
      featureCommits: data.featureCommits,
      featurePercentage,
      refactorCommits: data.refactorCommits,
      refactorPercentage,
      mergePercentage: data.mergePercentage,
      mostProductiveMonth: data.mostProductiveMonth,
      mostProductiveMonthCommits: data.mostProductiveMonthCommits,
      topLanguage: data.topLanguage,
      languageCount: data.languageCount,
      busiestHourDate: data.busiestHourDate,
      busiestHourTime: data.busiestHourTime,
      busiestHourCommits: data.busiestHourCommits,
    }
  );

  return {
    systemPrompt: SUPERLATIVES_PROMPT.systemPrompt,
    userPrompt,
  };
}

// =============================================================================
// SHARE TEXT TEMPLATES FOR STORIES
// =============================================================================

/**
 * Share text templates for story content.
 * Used by share-story.tsx when sharing generated stories.
 */
export const STORY_SHARE_TEMPLATES = {
  /** Share text for a single repo story */
  perRepo: (repoName: string, totalCommits: number, dateRange: string) =>
    `📖 Just read the AI-generated story of my ${repoName} repository — ${totalCommits} commits across ${dateRange}. Check out the journey on gitted! #gitted #DevStory #GitHub`,

  /** Share text for the unified developer journey */
  unified: (
    repoCount: number,
    totalCommits: number,
    topLanguage: string
  ) =>
    `🚀 My developer journey across ${repoCount} repos and ${totalCommits.toLocaleString()} commits, narrated by AI. Apparently I really love ${topLanguage}. Discover your story on gitted! #gitted #DevJourney #GitHub`,

  /** Share text for a specific milestone */
  milestone: (
    milestoneTitle: string,
    repoName: string,
    date: string
  ) =>
    `🏆 Key milestone in my coding journey: "${milestoneTitle}" in ${repoName} (${date}). Every commit tells a story. #gitted #CodingMilestone`,

  /** Generic share text */
  generic:
    '🔍 Discovered the hidden story behind my GitHub repositories with gitted — AI-powered developer storytelling. Try it yourself! #gitted #GitHub #DevTools',
} as const;

// =============================================================================
// PROMPT CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Maximum commits to include in a single batch summary request.
 * Beyond this, commits are further sub-batched.
 */
export const MAX_COMMITS_PER_SUMMARY_BATCH = 100;

/**
 * Maximum number of commit messages to include verbatim in a batch.
 * Beyond this, only the most significant messages are included.
 */
export const MAX_VERBATIM_MESSAGES_PER_BATCH = 50;

/**
 * Threshold for using server-side processing vs client-side.
 * Repos with more commits than this should use /api/analytics/compute.
 */
export const SERVER_PROCESSING_COMMIT_THRESHOLD = 5000;

/**
 * Maximum total characters for commit list in a single prompt.
 * Prevents token overflow for verbose commit histories.
 */
export const MAX_COMMIT_LIST_CHARS = 15000;

/**
 * Model identifier for story generation.
 */
export const STORY_MODEL = 'claude-opus-4-6';

/**
 * Model identifier for batch summarization (faster, cheaper).
 */
export const SUMMARY_MODEL = 'claude-opus-4-6';

/**
 * All prompt templates exported as a map for easy access.
 */
export const PROMPT_TEMPLATES: Record<string, StoryPromptTemplate> = {
  'per-repo-story': PER_REPO_STORY_PROMPT,
  'unified-story': UNIFIED_STORY_PROMPT,
  'commit-batch-summary': COMMIT_BATCH_SUMMARY_PROMPT,
  'milestone-extraction': MILESTONE_EXTRACTION_PROMPT,
  'superlatives-narrative': SUPERLATIVES_PROMPT,
} as const;
