// src/lib/narrative-types.ts
// All TypeScript interfaces for the multi-pass narrative story generation system.

// =============================================================================
// ADAPTIVE TIME WINDOWS
// =============================================================================

/** Adaptive time window — not fixed batches, but intelligent boundaries */
export interface AdaptiveTimeWindow {
  id: string;
  startMs: number;
  endMs: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  commitCount: number;
  /** Commits per active day within this window */
  density: number;
}

// =============================================================================
// WORK THEMES
// =============================================================================

export type ThemeCategory =
  | 'feature-build'
  | 'bug-fix-campaign'
  | 'refactor-migration'
  | 'infrastructure'
  | 'testing'
  | 'documentation'
  | 'dependency-management'
  | 'initial-setup'
  | 'cleanup'
  | 'exploration'
  | 'release-prep'
  | 'mixed';

/** A detected work theme within a time window */
export interface WorkTheme {
  id: string;
  /** Human-readable label, e.g. "Authentication System Build-Out" */
  label: string;
  category: ThemeCategory;
  /** Directories involved */
  modules: string[];
  /** File extensions seen */
  extensions: string[];
  /** 2-5 most informative commit messages */
  representativeMessages: string[];
  commitCount: number;
  /** additions - deletions */
  netDelta: number;
  contributorIds: string[];
}

// =============================================================================
// NARRATIVE EVENTS
// =============================================================================

export type NarrativeEventCategory =
  | 'project-birth'
  | 'project-abandonment'
  | 'project-revival'
  | 'new-contributor'
  | 'contributor-departure'
  | 'collaboration-burst'
  | 'solo-sprint'
  | 'architecture-shift'
  | 'technology-adoption'
  | 'technology-removal'
  | 'major-feature-arc'
  | 'bug-fix-emergency'
  | 'great-refactor'
  | 'testing-adoption'
  | 'ci-cd-setup'
  | 'dependency-overhaul'
  | 'velocity-acceleration'
  | 'velocity-deceleration'
  | 'sprint'
  | 'drought'
  | 'parallel-development'
  | 'focus-shift'
  | 'pattern-replication';

/** A narrative event detected from patterns in the data */
export interface NarrativeEvent {
  id: string;
  timestampMs: number;
  date: string;
  category: NarrativeEventCategory;
  title: string;
  description: string;
  repoIds: string[];
  contributorIds: string[];
  /** 1-10 significance scale */
  significance: number;
  /** Evidence commit SHAs */
  evidenceCommits: string[];
  /** Evidence file paths */
  evidenceFiles: string[];
  /** Quantitative evidence string */
  quantitativeEvidence: string;
  /** Which window this event belongs to */
  windowId: string;
}

// =============================================================================
// CONTRIBUTOR INTELLIGENCE
// =============================================================================

/** Rich contributor profile built from commit data */
export interface ContributorIntelligence {
  id: string;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  specializations: Array<{
    module: string;
    commitCount: number;
    percentage: number;
  }>;
  inferredRole:
    | 'fullstack'
    | 'frontend'
    | 'backend'
    | 'devops'
    | 'data'
    | 'generalist';
  avgCommitSize: number;
  commitsPerActiveDay: number;
  peakHours: number[];
  weekendPercentage: number;
  conventionalCommitRate: number;
  firstSeenDate: string;
  lastSeenDate: string;
  repoActivity: Array<{
    repoId: string;
    firstCommitDate: string;
    lastCommitDate: string;
    commitCount: number;
  }>;
  gaps: Array<{
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  collaborators: Array<{
    contributorId: string;
    sharedActiveDays: number;
    sharedRepos: string[];
  }>;
}

// =============================================================================
// CROSS-REPO CORRELATION
// =============================================================================

/** A detected correlation between two repositories */
export interface CrossRepoCorrelation {
  repoA: string;
  repoB: string;
  type:
    | 'temporal'
    | 'author-overlap'
    | 'semantic'
    | 'dependency'
    | 'complementary';
  /** 0-1 correlation strength */
  strength: number;
  evidence: string;
  sharedContributors: string[];
}

// =============================================================================
// DISCONTINUITIES
// =============================================================================

/** A gap, direction change, or velocity change in the timeline */
export interface Discontinuity {
  id: string;
  type: 'gap' | 'direction-change' | 'velocity-change';
  startDate: string;
  endDate: string | null;
  durationDays: number;
  repoIds: string[];
  description: string;
  /** 1-5 severity */
  severity: number;
}

// =============================================================================
// WINDOW ANALYSIS
// =============================================================================

/** Analysis result for a single time window */
export interface WindowAnalysis {
  window: AdaptiveTimeWindow;
  themes: WorkTheme[];
  dominantTheme: WorkTheme | null;
  events: NarrativeEvent[];
  repoBreakdown: Array<{
    repoId: string;
    repoName: string;
    commitCount: number;
    additions: number;
    deletions: number;
    topModules: string[];
    topContributors: string[];
  }>;
  metrics: {
    totalCommits: number;
    totalAdditions: number;
    totalDeletions: number;
    activeDays: number;
    uniqueContributors: number;
    uniqueRepos: number;
    relativeVelocity: number;
  };
  notableCommits: Array<{
    sha: string;
    message: string;
    author: string;
    repoId: string;
    reason: string;
  }>;
  /** 0-10 interestingness score */
  interestingnessScore: number;
}

// =============================================================================
// SCORED COMMITS
// =============================================================================

/** A commit scored for narrative interestingness */
export interface ScoredCommit {
  sha: string;
  shortSha: string;
  message: string;
  messageHeadline: string;
  authorName: string;
  authorLogin: string | null;
  timestamp: string;
  repoId: string;
  repoName: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  interestScore: number;
  scoreReasons: string[];
}

// =============================================================================
// COMMIT INTELLIGENCE RESULT (complete output)
// =============================================================================

/** Complete intelligence result from the preprocessor */
export interface CommitIntelligenceResult {
  meta: {
    totalCommits: number;
    totalRepos: number;
    dateRange: {
      start: string;
      end: string;
      totalDays: number;
    };
    uniqueContributors: number;
    analyzedAt: number;
    windowCount: number;
  };
  windows: WindowAnalysis[];
  narrativeEvents: NarrativeEvent[];
  contributors: ContributorIntelligence[];
  crossRepoCorrelations: CrossRepoCorrelation[];
  discontinuities: Discontinuity[];
  interestingCommits: ScoredCommit[];
  narrativeArc: {
    acts: Array<{
      number: number;
      suggestedTitle: string;
      windowIds: string[];
      keyEventIds: string[];
      characterization: string;
    }>;
    arcType: string;
    arcSummary: string;
  };
}

// =============================================================================
// PASS 1 OUTPUT: per-repo analysis from Claude
// =============================================================================

/** Claude's analysis of a single repository's narrative structure */
export interface RepoNarrativeAnalysis {
  repoId: string;
  arcs: Array<{
    id: string;
    title: string;
    dateRange: { start: string; end: string };
    type: string;
    intensity: number;
    keyEvents: string[];
    keyCommitShas: string[];
    contributors: string[];
  }>;
  turningPoints: Array<{
    date: string;
    title: string;
    significance: number;
    description: string;
    evidenceCommitShas: string[];
  }>;
  repoPersonality: string;
  narrativeHooks: string[];
}

// =============================================================================
// PASS 2 OUTPUT: chapter plan
// =============================================================================

/** Blueprint for a single chapter */
export interface ChapterBlueprint {
  id: string;
  index: number;
  title: string;
  dateRange: { start: string; end: string };
  repos: string[];
  narrativeFocus: string;
  keyMomentsToInclude: string[];
  contributorSpotlights: string[];
  moodProgression: string;
  suggestedLength: 'short' | 'medium' | 'long';
  chapterType:
    | 'origin'
    | 'growth'
    | 'crisis'
    | 'migration'
    | 'parallel'
    | 'silence-return'
    | 'collaboration'
    | 'current-state';
}

/** Complete chapter plan from Claude's correlation pass */
export interface NarrativeChapterPlan {
  overarchingArc: {
    title: string;
    theme: string;
    narrativeType: string;
  };
  chapters: ChapterBlueprint[];
  crossRepoConnections: Array<{
    type: string;
    fromRepo: string;
    toRepo: string;
    description: string;
    evidence: string;
  }>;
  milestones: Array<{
    date: string;
    title: string;
    description: string;
    type?: string;
    significance: number;
    relatedRepos: string[];
    relatedCommitShas: string[];
    icon: string;
    chapterId: string;
  }>;
  storyTitle: string;
  storySubtitle: string;
}

// =============================================================================
// FINAL ENRICHED STORY
// =============================================================================

/** An enriched story chapter with rich metadata */
export interface EnrichedStoryChapter {
  id: string;
  index: number;
  title: string;
  /** Rich markdown content */
  content: string;
  dateRange: { start: string; end: string; totalDays: number };
  repoIds: string[];
  anchorId: string;
  chapterType: string;
  moodProgression: string;
}

/** A contributor spotlight within a chapter */
export interface ContributorSpotlight {
  contributorId: string;
  contributorName: string;
  avatarUrl: string | null;
  /** Narrative text, e.g. "Alice spent 3 weeks deep in the auth system..." */
  narrative: string;
  repos: string[];
  commitCount: number;
  chapterId: string;
}

/** The final enriched generated story */
export interface EnrichedGeneratedStory {
  id: string;
  type: 'unified';
  title: string;
  subtitle: string;
  overarchingArc: {
    title: string;
    theme: string;
    narrativeType: string;
  };
  chapters: EnrichedStoryChapter[];
  milestones: Array<{
    date: string;
    title: string;
    description: string;
    type: string;
    significance: number;
    relatedRepos: string[];
    relatedCommitShas: string[];
    icon: string;
    chapterId: string;
  }>;
  crossRepoConnections: Array<{
    type: string;
    fromRepo: string;
    toRepo: string;
    description: string;
  }>;
  contributorSpotlights: ContributorSpotlight[];
  generatedAt: number;
  dateRange: { start: string; end: string; totalDays: number };
  model: string;
  passMetadata: {
    totalApiCalls: number;
    totalGenerationTimeMs: number;
  };
}

// =============================================================================
// PIPELINE PROGRESS
// =============================================================================

/** Progress tracking for the narrative pipeline */
export interface NarrativePipelineProgress {
  currentPass:
    | 'preprocessing'
    | 'analyzing'
    | 'correlating'
    | 'streaming'
    | 'writing'
    | 'enriching'
    | 'complete'
    | 'error';
  /** 0-100 overall progress */
  overallProgress: number;
  currentStep: string;
  chaptersCompleted: number;
  totalChapters: number;
  reposAnalyzed: number;
  totalRepos: number;
  error: string | null;
}
