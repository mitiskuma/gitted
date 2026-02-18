// src/lib/types.ts
// Shared types for the "gitted" project — Git Story, Wrapped & Gource visualization platform

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/** Processing pipeline status */
export enum ProcessingStatus {
  IDLE = 'idle',
  FETCHING = 'fetching',
  ANALYZING = 'analyzing',
  GENERATING = 'generating',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/** Granularity for time-series data */
export enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/** Gource playback state */
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  SEEKING = 'seeking',
}

/** Gource playback speed presets */
export enum PlaybackSpeed {
  HALF = 0.5,
  NORMAL = 1,
  DOUBLE = 2,
  FAST = 5,
  ULTRA = 10,
}

/** Wrapped slide identifiers */
export enum WrappedSlideType {
  INTRO = 'intro',
  TOP_REPOS = 'top-repos',
  PRODUCTIVITY = 'productivity',
  LANGUAGE_EVOLUTION = 'language-evolution',
  STREAKS = 'streaks',
  MONTHLY_BREAKDOWN = 'monthly-breakdown',
  YEARLY_COMPARISON = 'yearly-comparison',
  SUPERLATIVES = 'superlatives',
  FINAL_SUMMARY = 'final-summary',
}

/** Authentication provider types */
export enum AuthProvider {
  GITHUB = 'github',
  CLAUDE = 'claude',
}

/** Story generation phase */
export enum StoryPhase {
  IDLE = 'idle',
  BATCHING_COMMITS = 'batching-commits',
  SUMMARIZING = 'summarizing',
  GENERATING_NARRATIVE = 'generating-narrative',
  EXTRACTING_MILESTONES = 'extracting-milestones',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/** Sort options for repository listing */
export enum RepoSortOption {
  NAME_ASC = 'name-asc',
  NAME_DESC = 'name-desc',
  STARS_DESC = 'stars-desc',
  UPDATED_DESC = 'updated-desc',
  COMMITS_DESC = 'commits-desc',
}

/** File extension categories for gource coloring */
export enum FileCategory {
  CODE = 'code',
  MARKUP = 'markup',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  ASSET = 'asset',
  TEST = 'test',
  BUILD = 'build',
  DATA = 'data',
  OTHER = 'other',
}

/** Day of week for analytics */
export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

// =============================================================================
// AUTHENTICATION & USER MODELS
// =============================================================================

/** GitHub user profile */
export interface GitHubUser {
  /** GitHub user ID */
  id: number;
  /** GitHub login/username */
  login: string;
  /** Display name */
  name: string | null;
  /** Avatar URL */
  avatarUrl: string;
  /** Profile URL */
  profileUrl: string;
  /** User bio */
  bio: string | null;
  /** Public repository count */
  publicRepos: number;
  /** Total repository count (including private if authorized) */
  totalRepos: number;
  /** Account creation date */
  createdAt: string;
  /** User email (if available) */
  email: string | null;
  /** User's company */
  company: string | null;
  /** User's location */
  location: string | null;
  /** Followers count */
  followers: number;
  /** Following count */
  following: number;
}

/** Authentication state */
export interface AuthState {
  /** Whether the user is authenticated with GitHub */
  isGitHubConnected: boolean;
  /** Whether a valid Claude token is present */
  isClaudeConnected: boolean;
  /** Whether both authentications are complete */
  isFullyAuthenticated: boolean;
  /** GitHub access token (stored encrypted) */
  githubToken: string | null;
  /** Claude API/OAuth token */
  claudeToken: string | null;
  /** Authenticated GitHub user */
  githubUser: GitHubUser | null;
  /** Token validation timestamp */
  lastValidated: number | null;
  /** Authentication error message */
  error: string | null;
}

/** Auth context methods */
export interface AuthActions {
  /** Set the Claude API token */
  setClaudeToken: (token: string) => Promise<boolean>;
  /** Initiate GitHub OAuth flow */
  initiateGitHubOAuth: () => void;
  /** Handle GitHub OAuth callback */
  handleGitHubCallback: (code: string) => Promise<void>;
  /** Disconnect GitHub account */
  disconnectGitHub: () => void;
  /** Clear Claude token */
  clearClaudeToken: () => void;
  /** Full logout */
  logout: () => void;
  /** Validate stored tokens */
  validateTokens: () => Promise<void>;
}

// =============================================================================
// REPOSITORY MODELS
// =============================================================================

/** Repository metadata from GitHub API */
export interface Repository {
  /** Unique identifier (owner/name) */
  id: string;
  /** GitHub repo ID */
  githubId: number;
  /** Repository name */
  name: string;
  /** Full name (owner/repo) */
  fullName: string;
  /** Repository description */
  description: string | null;
  /** Repository owner */
  owner: RepositoryOwner;
  /** Whether the repo is private */
  isPrivate: boolean;
  /** Whether the repo is a fork */
  isFork: boolean;
  /** Whether the repo is archived */
  isArchived: boolean;
  /** Primary language */
  language: string | null;
  /** All languages with byte counts */
  languages: Record<string, number>;
  /** Star count */
  starCount: number;
  /** Fork count */
  forkCount: number;
  /** Watcher count */
  watcherCount: number;
  /** Open issue count */
  openIssueCount: number;
  /** Default branch name */
  defaultBranch: string;
  /** Repository creation date */
  createdAt: string;
  /** Last update date */
  updatedAt: string;
  /** Last push date */
  pushedAt: string;
  /** GitHub URL */
  htmlUrl: string;
  /** Clone URL */
  cloneUrl: string;
  /** Estimated commit count (from API or fetched) */
  commitCount: number | null;
  /** Size in KB */
  size: number;
  /** Topics/tags */
  topics: string[];
  /** License information */
  license: LicenseInfo | null;
}

/** Repository owner information */
export interface RepositoryOwner {
  /** Owner login */
  login: string;
  /** Owner avatar URL */
  avatarUrl: string;
  /** Whether owner is an organization */
  isOrg: boolean;
  /** Owner type */
  type: 'User' | 'Organization';
}

/** License information */
export interface LicenseInfo {
  /** License key (e.g., 'mit') */
  key: string;
  /** License name */
  name: string;
  /** SPDX identifier */
  spdxId: string | null;
}

/** Repository with selection state (for the connect page) */
export interface SelectableRepository extends Repository {
  /** Whether this repo is selected for analysis */
  isSelected: boolean;
  /** Fetch status of detailed data */
  fetchStatus: 'unfetched' | 'fetching' | 'fetched' | 'error';
}

/** Repository filter criteria */
export interface RepoFilter {
  /** Search query (matches name, description) */
  searchQuery: string;
  /** Filter by language */
  language: string | null;
  /** Filter by visibility */
  visibility: 'all' | 'public' | 'private';
  /** Filter by fork status */
  includeForks: boolean;
  /** Filter by archived status */
  includeArchived: boolean;
  /** Sort option */
  sortBy: RepoSortOption;
  /** Filter by owner type */
  ownerType: 'all' | 'user' | 'org';
}

// =============================================================================
// COMMIT & CONTRIBUTOR MODELS
// =============================================================================

/** Normalized commit data (processed from GitHub API) */
export interface CommitData {
  /** Unique commit SHA */
  sha: string;
  /** Short SHA (first 7 chars) */
  shortSha: string;
  /** Commit message (full) */
  message: string;
  /** Commit message (first line only) */
  messageHeadline: string;
  /** Commit author */
  author: CommitAuthor;
  /** Commit committer (may differ from author) */
  committer: CommitAuthor;
  /** Commit timestamp (ISO 8601) */
  timestamp: string;
  /** Commit timestamp as Unix epoch ms */
  timestampMs: number;
  /** Repository this commit belongs to */
  repoId: string;
  /** Repository name */
  repoName: string;
  /** Number of files changed */
  filesChanged: number;
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
  /** Total changes (additions + deletions) */
  totalChanges: number;
  /** Whether this is a merge commit */
  isMerge: boolean;
  /** Parent SHA(s) */
  parents: string[];
  /** Files modified in this commit */
  files: CommitFile[];
  /** GitHub URL for this commit */
  htmlUrl: string;
  /** Hour of day (0-23) in author's timezone */
  hourOfDay: number;
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: DayOfWeek;
  /** Year */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Day of month (1-31) */
  dayOfMonth: number;
  /** ISO week number */
  weekOfYear: number;
  /** Date string (YYYY-MM-DD) for heatmap keying */
  dateKey: string;
}

/** Commit author information */
export interface CommitAuthor {
  /** Author name */
  name: string;
  /** Author email */
  email: string;
  /** GitHub login (if available) */
  login: string | null;
  /** GitHub avatar URL (if available) */
  avatarUrl: string | null;
}

/** File changed in a commit */
export interface CommitFile {
  /** File path */
  path: string;
  /** File name (last segment of path) */
  filename: string;
  /** Directory path */
  directory: string;
  /** File extension */
  extension: string;
  /** Change status */
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied';
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
  /** Total changes */
  changes: number;
  /** Previous file path (if renamed) */
  previousPath: string | null;
  /** File category for coloring */
  category: FileCategory;
}

/** Contributor aggregated data */
export interface Contributor {
  /** Unique contributor identifier (login or email) */
  id: string;
  /** Display name */
  name: string;
  /** Email */
  email: string;
  /** GitHub login */
  login: string | null;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Total commit count across selected repos */
  totalCommits: number;
  /** Total additions */
  totalAdditions: number;
  /** Total deletions */
  totalDeletions: number;
  /** First commit date */
  firstCommitDate: string;
  /** Last commit date */
  lastCommitDate: string;
  /** Repos contributed to */
  repos: string[];
  /** Assigned color for gource visualization */
  color: string;
}

/** Raw commit batch for processing */
export interface CommitBatch {
  /** Repository ID this batch belongs to */
  repoId: string;
  /** Batch index */
  batchIndex: number;
  /** Total number of batches */
  totalBatches: number;
  /** Commits in this batch */
  commits: CommitData[];
  /** Whether this is the last batch */
  isLast: boolean;
}

// =============================================================================
// ANALYTICS MODELS
// =============================================================================

/** Complete analytics result for all selected repos */
export interface AnalyticsResult {
  /** Contribution heatmap data */
  heatmap: HeatmapData;
  /** Commit frequency time series */
  commitFrequency: CommitFrequencyData;
  /** Language breakdown */
  languageBreakdown: LanguageBreakdownData;
  /** Coding patterns (hours, days) */
  codingPatterns: CodingPatternsData;
  /** Streak information */
  streaks: StreakData;
  /** Productivity metrics */
  productivity: ProductivityData;
  /** Year-over-year comparison */
  yearOverYear: YearOverYearData;
  /** Monthly breakdown */
  monthlyBreakdown: MonthlyBreakdownData;
  /** Fun superlatives */
  superlatives: SuperlativesData;
  /** Top contributors */
  topContributors: Contributor[];
  /** Date range of analyzed data */
  dateRange: DateRange;
  /** Total stats summary */
  totals: TotalStats;
  /** Computation timestamp */
  computedAt: number;
}

/** Total aggregate statistics */
export interface TotalStats {
  /** Total commits across all repos */
  totalCommits: number;
  /** Total repositories analyzed */
  totalRepos: number;
  /** Total lines added */
  totalAdditions: number;
  /** Total lines deleted */
  totalDeletions: number;
  /** Total files changed */
  totalFilesChanged: number;
  /** Total active days (at least 1 commit) */
  activeDays: number;
  /** Total unique contributors */
  uniqueContributors: number;
  /** Average commits per active day */
  avgCommitsPerDay: number;
  /** Average commits per week */
  avgCommitsPerWeek: number;
}

/** Date range */
export interface DateRange {
  /** Start date (ISO 8601) */
  start: string;
  /** End date (ISO 8601) */
  end: string;
  /** Total days in range */
  totalDays: number;
}

/** Heatmap data (GitHub-style contribution calendar) */
export interface HeatmapData {
  /** Map of date string (YYYY-MM-DD) to commit count */
  cells: Record<string, HeatmapCell>;
  /** Maximum commit count for any single day */
  maxCount: number;
  /** Available years */
  years: number[];
}

/** Single heatmap cell */
export interface HeatmapCell {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Number of commits */
  count: number;
  /** Intensity level (0-4, for coloring) */
  level: 0 | 1 | 2 | 3 | 4;
  /** Repos with commits on this day */
  repos: string[];
}

/** Commit frequency time series data */
export interface CommitFrequencyData {
  /** Data points */
  series: CommitFrequencyPoint[];
  /** Per-repo series for overlay */
  perRepoSeries: Record<string, CommitFrequencyPoint[]>;
  /** Current granularity */
  granularity: TimeGranularity;
}

/** Single point in commit frequency series */
export interface CommitFrequencyPoint {
  /** Date/period label */
  label: string;
  /** Period start date */
  date: string;
  /** Commit count for this period */
  count: number;
  /** Additions in this period */
  additions: number;
  /** Deletions in this period */
  deletions: number;
}

/** Language breakdown data */
export interface LanguageBreakdownData {
  /** Languages sorted by byte count */
  languages: LanguageEntry[];
  /** Total bytes across all languages */
  totalBytes: number;
}

/** Single language entry */
export interface LanguageEntry {
  /** Language name */
  name: string;
  /** Total bytes */
  bytes: number;
  /** Percentage of total */
  percentage: number;
  /** Number of repos using this language */
  repoCount: number;
  /** Color associated with this language (GitHub language colors) */
  color: string;
}

/** Coding patterns data */
export interface CodingPatternsData {
  /** Commits by hour of day (0-23) */
  byHour: number[];
  /** Commits by day of week (0=Sun, 6=Sat) */
  byDayOfWeek: number[];
  /** Combined hour x day heatmap [day][hour] */
  hourDayMatrix: number[][];
  /** Peak coding hour */
  peakHour: number;
  /** Peak coding day */
  peakDay: DayOfWeek;
  /** Is user a night owl (most commits after 8pm) */
  isNightOwl: boolean;
  /** Is user an early bird (most commits before 9am) */
  isEarlyBird: boolean;
  /** Percentage of commits on weekends */
  weekendPercentage: number;
}

/** Streak data */
export interface StreakData {
  /** Longest consecutive days with commits */
  longestStreak: StreakInfo;
  /** Current streak (may be 0) */
  currentStreak: StreakInfo;
  /** Most commits in a single day */
  mostCommitsInDay: {
    date: string;
    count: number;
    repos: string[];
  };
  /** Top 5 longest streaks */
  topStreaks: StreakInfo[];
}

/** Individual streak information */
export interface StreakInfo {
  /** Number of consecutive days */
  length: number;
  /** Start date */
  startDate: string;
  /** End date */
  endDate: string;
  /** Total commits during streak */
  totalCommits: number;
}

/** Productivity metrics */
export interface ProductivityData {
  /** Most productive month ever */
  mostProductiveMonth: {
    label: string;
    year: number;
    month: number;
    commits: number;
  };
  /** Most productive day of week */
  mostProductiveDay: {
    day: DayOfWeek;
    dayName: string;
    avgCommits: number;
  };
  /** Average commits per active day */
  avgCommitsPerActiveDay: number;
  /** Average lines changed per commit */
  avgLinesPerCommit: number;
  /** Commit size distribution */
  commitSizeDistribution: {
    small: number;   // < 10 lines
    medium: number;  // 10-100 lines
    large: number;   // 100-500 lines
    huge: number;    // 500+ lines
  };
}

/** Year-over-year comparison data */
export interface YearOverYearData {
  /** Per-year stats */
  years: YearStats[];
  /** Whether multi-year data is available */
  hasMultipleYears: boolean;
  /** Growth percentages between consecutive years */
  growth: YearGrowth[];
}

/** Stats for a single year */
export interface YearStats {
  /** Year */
  year: number;
  /** Total commits */
  commits: number;
  /** Total additions */
  additions: number;
  /** Total deletions */
  deletions: number;
  /** Active days */
  activeDays: number;
  /** Repos contributed to */
  repoCount: number;
  /** Top language */
  topLanguage: string | null;
}

/** Growth between two consecutive years */
export interface YearGrowth {
  /** From year */
  fromYear: number;
  /** To year */
  toYear: number;
  /** Commit count change percentage */
  commitGrowth: number;
  /** Active days change percentage */
  activeDaysGrowth: number;
  /** Lines changed growth */
  linesGrowth: number;
}

/** Monthly breakdown data */
export interface MonthlyBreakdownData {
  /** Per-month data points */
  months: MonthStats[];
  /** Index of the peak month */
  peakMonthIndex: number;
}

/** Stats for a single month */
export interface MonthStats {
  /** Year */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Display label (e.g., "Jan 2024") */
  label: string;
  /** Total commits */
  commits: number;
  /** Total additions */
  additions: number;
  /** Total deletions */
  deletions: number;
  /** Top repo by commits */
  topRepo: string | null;
  /** Active days in this month */
  activeDays: number;
}

/** Fun superlatives computed from commit data */
export interface SuperlativesData {
  /** Night owl vs early bird */
  chronotype: 'night-owl' | 'early-bird' | 'balanced';
  /** Weekend warrior vs weekday warrior */
  weekendType: 'weekend-warrior' | 'weekday-warrior' | 'balanced';
  /** Most frequently used word in commit messages */
  favoriteCommitWord: {
    word: string;
    count: number;
  };
  /** Longest commit message */
  longestCommitMessage: {
    message: string;
    length: number;
    sha: string;
    repoId: string;
  };
  /** Shortest commit message (non-empty) */
  shortestCommitMessage: {
    message: string;
    length: number;
    sha: string;
    repoId: string;
  };
  /** Most active single hour ever */
  busiestHour: {
    date: string;
    hour: number;
    commits: number;
  };
  /** Repo with the most churn (additions + deletions) */
  mostChurnedRepo: {
    repoId: string;
    repoName: string;
    totalChanges: number;
  };
  /** Commit message sentiment (simple analysis) */
  commitMood: 'positive' | 'neutral' | 'negative';
  /** Number of "fix" commits */
  fixCommits: number;
  /** Number of "feat"/"feature" commits */
  featureCommits: number;
  /** Number of "refactor" commits */
  refactorCommits: number;
  /** Percentage of merge commits */
  mergePercentage: number;
  /** Custom badges/awards */
  badges: Badge[];
}

/** Achievement badge */
export interface Badge {
  /** Badge identifier */
  id: string;
  /** Badge display name */
  name: string;
  /** Badge description */
  description: string;
  /** Badge icon/emoji */
  icon: string;
  /** Criteria that earned this badge */
  criteria: string;
}

// =============================================================================
// STORY / AI GENERATION MODELS
// =============================================================================

/** AI-generated story for a repository or combined */
export interface GeneratedStory {
  /** Unique story identifier */
  id: string;
  /** Story type */
  type: 'repo' | 'unified';
  /** Repository ID (null for unified story) */
  repoId: string | null;
  /** Story title */
  title: string;
  /** Story subtitle */
  subtitle: string;
  /** Full story content (markdown) */
  content: string;
  /** Story chapters */
  chapters: StoryChapter[];
  /** Key milestones extracted */
  milestones: StoryMilestone[];
  /** Generation timestamp */
  generatedAt: number;
  /** Date range covered */
  dateRange: DateRange;
  /** Model used for generation */
  model: string;
}

/** Chapter within a story */
export interface StoryChapter {
  /** Chapter index */
  index: number;
  /** Chapter title */
  title: string;
  /** Chapter content (markdown) */
  content: string;
  /** Date range this chapter covers */
  dateRange: DateRange;
  /** Related repo IDs */
  repoIds: string[];
  /** Anchor ID for navigation */
  anchorId: string;
}

/** Milestone in the developer journey */
export interface StoryMilestone {
  /** Milestone date */
  date: string;
  /** Milestone title */
  title: string;
  /** Milestone description */
  description: string;
  /** Related repository */
  repoId: string | null;
  /** Related repo name */
  repoName: string | null;
  /** Milestone type */
  type: 'project-start' | 'major-release' | 'pivot' | 'breakthrough' | 'collaboration' | 'milestone' | 'achievement';
  /** Significance level (1-5) */
  significance: number;
  /** Related commit SHAs */
  relatedCommits: string[];
  /** Icon/emoji */
  icon: string;
}

/** Story generation progress */
export interface StoryGenerationProgress {
  /** Current phase */
  phase: StoryPhase;
  /** Overall progress (0-100) */
  overallProgress: number;
  /** Current step description */
  currentStep: string;
  /** Repos processed so far */
  reposProcessed: number;
  /** Total repos to process */
  totalRepos: number;
  /** Commits summarized so far */
  commitsSummarized: number;
  /** Total commits to summarize */
  totalCommits: number;
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining: number | null;
}

/** Commit summary for sending to Claude (batched/compressed) */
export interface CommitSummaryBatch {
  /** Repository ID */
  repoId: string;
  /** Repository name */
  repoName: string;
  /** Time period covered */
  period: DateRange;
  /** Number of commits in this batch */
  commitCount: number;
  /** Summarized commit messages (grouped/deduplicated) */
  messageSummary: string;
  /** Key files/directories changed */
  keyFilesChanged: string[];
  /** Net lines added */
  netAdditions: number;
  /** Net lines deleted */
  netDeletions: number;
  /** Contributors in this batch */
  contributors: string[];
  /** Notable patterns detected */
  patterns: string[];
}

/** Claude API prompt template */
export interface StoryPromptTemplate {
  /** Template identifier */
  id: string;
  /** System prompt */
  systemPrompt: string;
  /** User prompt template (with placeholders) */
  userPromptTemplate: string;
  /** Maximum tokens for response */
  maxTokens: number;
  /** Temperature setting */
  temperature: number;
}

// =============================================================================
// WRAPPED SLIDESHOW MODELS
// =============================================================================

/** Complete wrapped data for slideshow */
export interface WrappedData {
  /** User info */
  user: GitHubUser;
  /** Total stats */
  totals: TotalStats;
  /** Top repos by commits */
  topRepos: WrappedRepoStat[];
  /** Productivity data */
  productivity: ProductivityData;
  /** Language evolution over time */
  languageEvolution: LanguageEvolutionEntry[];
  /** Streak data */
  streaks: StreakData;
  /** Monthly breakdown */
  monthlyBreakdown: MonthlyBreakdownData;
  /** Year-over-year comparison */
  yearOverYear: YearOverYearData;
  /** Superlatives */
  superlatives: SuperlativesData;
  /** Date range */
  dateRange: DateRange;
  /** Year being wrapped */
  wrappedYear: number;
}

/** Repo stat for wrapped top repos slide */
export interface WrappedRepoStat {
  /** Repo ID */
  repoId: string;
  /** Repo name */
  repoName: string;
  /** Commit count */
  commits: number;
  /** Primary language */
  language: string | null;
  /** Language color */
  languageColor: string;
  /** Rank (1-based) */
  rank: number;
  /** Percentage of total commits */
  percentage: number;
}

/** Language evolution over time for wrapped */
export interface LanguageEvolutionEntry {
  /** Period label */
  period: string;
  /** Date */
  date: string;
  /** Language percentages at this point */
  languages: Record<string, number>;
}

/** Wrapped slide definition */
export interface WrappedSlide {
  /** Slide type */
  type: WrappedSlideType;
  /** Slide index */
  index: number;
  /** Background gradient colors */
  gradientColors: [string, string, string?];
  /** Auto-advance duration in ms (null = manual only) */
  autoAdvanceMs: number | null;
  /** Entrance animation type */
  animation: 'slide-up' | 'fade-in' | 'scale-pop' | 'slide-left';
  /** Whether this slide is shareable */
  shareable: boolean;
}

/** Wrapped slideshow state */
export interface WrappedSlideshowState {
  /** Current slide index */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Whether currently animating between slides */
  isAnimating: boolean;
  /** Whether auto-advance is enabled */
  autoAdvance: boolean;
  /** Direction of current transition */
  direction: 'forward' | 'backward';
  /** Slide definitions */
  slides: WrappedSlide[];
  /** Complete wrapped data */
  data: WrappedData | null;
}

// =============================================================================
// GOURCE VISUALIZATION MODELS
// =============================================================================

/** Gource visualization state */
export interface GourceState {
  /** Playback state */
  playback: PlaybackState;
  /** Playback speed multiplier */
  speed: PlaybackSpeed;
  /** Current simulation time (ms since epoch) */
  currentTime: number;
  /** Current displayed date */
  currentDate: string;
  /** Start time of the visualization */
  startTime: number;
  /** End time of the visualization */
  endTime: number;
  /** Total duration in ms */
  totalDuration: number;
  /** Progress (0-1) */
  progress: number;
  /** Currently viewed repo (null for combined view) */
  activeRepoId: string | null;
  /** Whether showing combined multi-repo view */
  isCombinedView: boolean;
  /** Camera state */
  camera: GourceCamera;
  /** Visualization settings */
  settings: GourceSettings;
}

/** Gource camera state */
export interface GourceCamera {
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Zoom level (1 = default) */
  zoom: number;
  /** Target X (for smooth interpolation) */
  targetX: number;
  /** Target Y (for smooth interpolation) */
  targetY: number;
  /** Target zoom */
  targetZoom: number;
  /** Whether user is manually controlling camera */
  isUserControlled: boolean;
}

/** Gource visualization settings */
export interface GourceSettings {
  /** Node (file) base size in pixels */
  nodeSize: number;
  /** Edge (directory connection) thickness */
  edgeThickness: number;
  /** Whether to show file/directory labels */
  showLabels: boolean;
  /** Whether to show contributor avatars */
  showAvatars: boolean;
  /** Background color (hex) */
  backgroundColor: string;
  /** Whether to show glow/bloom effects */
  showGlowEffects: boolean;
  /** Whether to show particle effects on commits */
  showParticles: boolean;
  /** Date filter range (null = show all) */
  dateFilter: DateRange | null;
  /** Contributor filter (null = show all) */
  contributorFilter: string[] | null;
  /** File extension color mapping overrides */
  extensionColors: Record<string, string>;
  /** Maximum visible nodes (for performance) */
  maxVisibleNodes: number;
  /** Whether to show the commit beam animation */
  showCommitBeams: boolean;
  /** Node fade-out time after last modification (ms in sim time) */
  nodeFadeTime: number;
  /** Branch spring stiffness */
  springStiffness: number;
  /** Node repulsion force */
  repulsionForce: number;
  /** Skip periods with no commits (auto-fast-forward through dead time) */
  skipDeadTime: boolean;
}

/** A node in the gource file tree */
export interface GourceNode {
  /** Unique node ID (file path) */
  id: string;
  /** Display name (filename or directory name) */
  name: string;
  /** Full path */
  path: string;
  /** Parent node ID (null for root) */
  parentId: string | null;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Child node IDs */
  children: string[];
  /** File extension (empty for directories) */
  extension: string;
  /** File category */
  category: FileCategory;
  /** Repository this node belongs to */
  repoId: string;
  /** Current position X */
  x: number;
  /** Current position Y */
  y: number;
  /** Target position X */
  targetX: number;
  /** Target position Y */
  targetY: number;
  /** Velocity X (for physics) */
  vx: number;
  /** Velocity Y (for physics) */
  vy: number;
  /** Node color (hex) */
  color: string;
  /** Current opacity (0-1) */
  opacity: number;
  /** Current scale (for animation) */
  scale: number;
  /** Last modification timestamp */
  lastModified: number;
  /** Number of times this file has been modified */
  modificationCount: number;
  /** Whether this node is currently visible */
  isVisible: boolean;
  /** Depth in the tree (root = 0) */
  depth: number;
  /** Angle in radial layout (radians) */
  angle: number;
  /** Radius from parent in radial layout */
  radius: number;
}

/** A commit event for gource animation */
export interface GourceCommitEvent {
  /** Commit SHA */
  sha: string;
  /** Timestamp (ms) */
  timestamp: number;
  /** Contributor ID */
  contributorId: string;
  /** Contributor name */
  contributorName: string;
  /** Contributor avatar URL */
  contributorAvatarUrl: string | null;
  /** Repository ID */
  repoId: string;
  /** Files affected (paths) */
  affectedFiles: GourceFileChange[];
  /** Whether this event has been processed */
  processed: boolean;
}

/** File change within a gource commit event */
export interface GourceFileChange {
  /** File path */
  path: string;
  /** Change type */
  type: 'add' | 'modify' | 'delete' | 'rename';
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
}

/** Active contributor avatar in the gource visualization */
export interface GourceContributor {
  /** Contributor ID */
  id: string;
  /** Display name */
  name: string;
  /** Avatar image URL */
  avatarUrl: string | null;
  /** Loaded avatar image element */
  avatarImage: HTMLImageElement | null;
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** Target X position (moving toward next commit) */
  targetX: number;
  /** Target Y position */
  targetY: number;
  /** Assigned color */
  color: string;
  /** Current opacity (fades when inactive) */
  opacity: number;
  /** Last active timestamp */
  lastActiveTime: number;
  /** Whether currently visible */
  isVisible: boolean;
}

/** Commit beam animation (line from contributor to file) */
export interface GourceBeam {
  /** Source X (contributor position) */
  fromX: number;
  /** Source Y */
  fromY: number;
  /** Target X (file position) */
  toX: number;
  /** Target Y */
  toY: number;
  /** Beam color */
  color: string;
  /** Animation progress (0-1) */
  progress: number;
  /** Beam opacity */
  opacity: number;
  /** Time to live (frames remaining) */
  ttl: number;
}

/** Particle effect for commit visualization */
export interface GourceParticle {
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Velocity X */
  vx: number;
  /** Velocity Y */
  vy: number;
  /** Particle color */
  color: string;
  /** Particle size */
  size: number;
  /** Opacity */
  opacity: number;
  /** Time to live (frames remaining) */
  ttl: number;
  /** Maximum TTL (for opacity calculation) */
  maxTtl: number;
}

// =============================================================================
// GAME ENGINE / LOOP TYPES
// =============================================================================

/** Core game loop state */
export interface GameLoopState {
  /** Whether the game loop is running */
  isRunning: boolean;
  /** Current frame count */
  frameCount: number;
  /** Time of last frame (ms) */
  lastFrameTime: number;
  /** Delta time since last frame (ms) */
  deltaTime: number;
  /** Frames per second */
  fps: number;
  /** Target FPS */
  targetFps: number;
  /** Accumulated time for fixed timestep */
  accumulator: number;
  /** Fixed timestep interval (ms) */
  fixedTimestep: number;
}

/** Game engine initialization options */
export interface GameEngineConfig {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Device pixel ratio for high-DPI */
  pixelRatio: number;
  /** Target FPS (default 60) */
  targetFps: number;
  /** Whether to enable debug overlay */
  debug: boolean;
}

/** Render context passed to render functions */
export interface RenderContext {
  /** 2D canvas context */
  ctx: CanvasRenderingContext2D;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Device pixel ratio */
  pixelRatio: number;
  /** Current delta time */
  deltaTime: number;
  /** Current frame count */
  frameCount: number;
  /** Current camera state */
  camera: GourceCamera;
}

// =============================================================================
// INPUT HANDLING
// =============================================================================

/** Input state for keyboard and mouse */
export interface InputState {
  /** Currently pressed keys */
  keysDown: Set<string>;
  /** Keys pressed this frame */
  keysPressed: Set<string>;
  /** Keys released this frame */
  keysReleased: Set<string>;
  /** Mouse X position (canvas-relative) */
  mouseX: number;
  /** Mouse Y position (canvas-relative) */
  mouseY: number;
  /** Whether primary mouse button is down */
  mouseDown: boolean;
  /** Mouse scroll delta this frame */
  scrollDelta: number;
  /** Whether mouse is over the canvas */
  mouseOver: boolean;
  /** Last mouse drag delta X */
  dragDeltaX: number;
  /** Last mouse drag delta Y */
  dragDeltaY: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Touch/pinch zoom delta */
  pinchDelta: number;
}

/** Keyboard shortcut definition */
export interface KeyboardShortcut {
  /** Key combination (e.g., "Space", "ArrowRight", "Ctrl+Z") */
  key: string;
  /** Description of the action */
  description: string;
  /** Action identifier */
  action: string;
  /** Whether this shortcut requires modifier key */
  modifier?: 'ctrl' | 'shift' | 'alt' | 'meta';
}

// =============================================================================
// APP STORE / GLOBAL STATE
// =============================================================================

/** Global application store state */
export interface AppStoreState {
  /** Selected repository IDs */
  selectedRepos: string[];
  /** Current processing status */
  processingStatus: ProcessingStatus;
  /** Current active view/page */
  currentView: string;
  /** Wrapped slideshow index */
  wrappedSlideIndex: number;
  /** Gource playback state */
  gourcePlaybackState: PlaybackState;
  /** Global error state */
  error: AppError | null;
  /** Whether the app has been initialized with data */
  isInitialized: boolean;
  /** Loading states for various async operations */
  loadingStates: Record<string, boolean>;
}

/** App store actions */
export interface AppStoreActions {
  /** Set selected repositories */
  setSelectedRepos: (repos: string[]) => void;
  /** Toggle a single repo selection */
  toggleRepoSelection: (repoId: string) => void;
  /** Set processing status */
  setProcessingStatus: (status: ProcessingStatus) => void;
  /** Set current view */
  setCurrentView: (view: string) => void;
  /** Set wrapped slide index */
  setWrappedSlideIndex: (index: number) => void;
  /** Set gource playback state */
  setGourcePlaybackState: (state: PlaybackState) => void;
  /** Set error */
  setError: (error: AppError | null) => void;
  /** Set initialized flag */
  setInitialized: (initialized: boolean) => void;
  /** Set a loading state */
  setLoading: (key: string, loading: boolean) => void;
  /** Reset store to initial state */
  reset: () => void;
  /** Initialize the app with song/level data (required before engine start) */
  initSong: (data: InitializationData) => void;
}

/** Combined app store type */
export type AppStore = AppStoreState & AppStoreActions;

/** Application error */
export interface AppError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Timestamp */
  timestamp: number;
}

/** Data required to initialize the app engine */
export interface InitializationData {
  /** Selected repositories with full data */
  repositories: Repository[];
  /** All fetched commits (normalized) */
  commits: CommitData[];
  /** Computed analytics (if available from cache) */
  analytics: AnalyticsResult | null;
  /** Generated stories (if available from cache) */
  stories: GeneratedStory[] | null;
  /** User info */
  user: GitHubUser;
}

// =============================================================================
// GIT DATA CONTEXT
// =============================================================================

/** Git data context state — single source of truth for all git data */
export interface GitDataState {
  /** All repositories (including unselected) */
  allRepositories: Repository[];
  /** Selected repositories with full details */
  selectedRepositories: Repository[];
  /** All commits indexed by repo ID */
  commitsByRepo: Record<string, CommitData[]>;
  /** All commits sorted by timestamp (unified view) */
  allCommitsSorted: CommitData[];
  /** Contributors map */
  contributors: Record<string, Contributor>;
  /** Computed analytics */
  analytics: AnalyticsResult | null;
  /** Generated stories */
  stories: GeneratedStory[];
  /** Unified story */
  unifiedStory: GeneratedStory | null;
  /** Wrapped data */
  wrappedData: WrappedData | null;
  /** Gource events (sorted by time) */
  gourceEvents: GourceCommitEvent[];
  /** Data fetch status per repo */
  fetchStatus: Record<string, RepoFetchStatus>;
  /** Whether initial data load is complete */
  isDataReady: boolean;
  /** Last data refresh timestamp */
  lastRefreshed: number | null;
}

/** Fetch status for a single repository's data */
export interface RepoFetchStatus {
  /** Whether repo metadata is fetched */
  metadata: boolean;
  /** Whether commits are fetched */
  commits: boolean;
  /** Whether contributors are fetched */
  contributors: boolean;
  /** Whether languages are fetched */
  languages: boolean;
  /** Total commits found */
  totalCommits: number;
  /** Commits fetched so far */
  commitsFetched: number;
  /** Whether fetch is in progress */
  isFetching: boolean;
  /** Fetch error */
  error: string | null;
}

/** Git data context actions */
export interface GitDataActions {
  /** Set all repositories */
  setAllRepositories: (repos: Repository[]) => void;
  /** Set selected repositories */
  setSelectedRepositories: (repos: Repository[]) => void;
  /** Add commits for a repo */
  addCommits: (repoId: string, commits: CommitData[]) => void;
  /** Set analytics result */
  setAnalytics: (analytics: AnalyticsResult) => void;
  /** Add a generated story */
  addStory: (story: GeneratedStory) => void;
  /** Set the unified story */
  setUnifiedStory: (story: GeneratedStory) => void;
  /** Set wrapped data */
  setWrappedData: (data: WrappedData) => void;
  /** Set gource events */
  setGourceEvents: (events: GourceCommitEvent[]) => void;
  /** Update fetch status for a repo */
  updateFetchStatus: (repoId: string, status: Partial<RepoFetchStatus>) => void;
  /** Fetch data for selected repos */
  fetchSelectedRepoData: () => Promise<void>;
  /** Clear all data */
  clearData: () => void;
  /** Invalidate cache and refresh */
  refreshData: () => Promise<void>;
}

// =============================================================================
// API TYPES
// =============================================================================

/** GitHub API pagination info */
export interface GitHubPagination {
  /** Current page */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total pages (if known) */
  totalPages: number | null;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Link header URLs */
  links: {
    next: string | null;
    prev: string | null;
    last: string | null;
    first: string | null;
  };
}

/** GitHub API rate limit info */
export interface GitHubRateLimit {
  /** Remaining requests */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Reset time (Unix timestamp) */
  resetAt: number;
  /** Whether we're rate limited */
  isLimited: boolean;
}

/** GitHub API request options */
export interface GitHubRequestOptions {
  /** GitHub access token */
  token: string;
  /** Page number for pagination */
  page?: number;
  /** Items per page */
  perPage?: number;
  /** Since date (ISO 8601) */
  since?: string;
  /** Until date (ISO 8601) */
  until?: string;
  /** Sort field */
  sort?: string;
  /** Sort direction */
  direction?: 'asc' | 'desc';
  /** Additional query parameters */
  params?: Record<string, string>;
}

/** Claude API request */
export interface ClaudeApiRequest {
  /** Model to use */
  model: string;
  /** Maximum tokens */
  maxTokens: number;
  /** System prompt */
  systemPrompt: string;
  /** User message content */
  userMessage: string;
  /** Temperature */
  temperature: number;
  /** Whether to stream the response */
  stream: boolean;
}

/** Claude API response (non-streaming) */
export interface ClaudeApiResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Tokens used */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Stop reason */
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
}

/** Claude API streaming chunk */
export interface ClaudeStreamChunk {
  /** Chunk type */
  type: 'content_block_delta' | 'message_start' | 'message_delta' | 'message_stop';
  /** Text content (for content_block_delta) */
  text?: string;
  /** Whether this is the final chunk */
  isFinal: boolean;
}

/** API route response wrapper */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  /** Pagination info (for list endpoints) */
  pagination?: GitHubPagination;
  /** Rate limit info */
  rateLimit?: GitHubRateLimit;
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/** Cached data entry */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  cachedAt: number;
  /** Time-to-live in ms */
  ttl: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Data version (for invalidation) */
  version: number;
}

/** Cache configuration */
export interface CacheConfig {
  /** Default TTL in ms */
  defaultTtl: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** IndexedDB database name */
  dbName: string;
  /** IndexedDB store name */
  storeName: string;
  /** Current cache version */
  version: number;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/** Props for the hero section component */
export interface HeroSectionProps {
  /** Main headline */
  headline: string;
  /** Subheadline */
  subheadline: string;
  /** CTA button text */
  ctaText: string;
  /** CTA button link */
  ctaLink: string;
}

/** Props for the feature overview cards */
export interface FeaturesOverviewProps {
  /** Feature items to display */
  features: FeatureItem[];
}

/** Feature item for landing page */
export interface FeatureItem {
  /** Feature icon name or emoji */
  icon: string;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
  /** Link to feature page */
  link: string;
  /** Gradient colors for card */
  gradientColors: [string, string];
}

/** Props for the repository selector component */
export interface RepositorySelectorProps {
  /** Available repositories */
  repositories: SelectableRepository[];
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: string[]) => void;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there are more repos to load */
  hasMore: boolean;
  /** Load more callback */
  onLoadMore: () => void;
  /** Current filter state */
  filter: RepoFilter;
  /** Filter change callback */
  onFilterChange: (filter: RepoFilter) => void;
}

/** Props for contribution heatmap component */
export interface ContributionHeatmapProps {
  /** Heatmap data */
  data: HeatmapData;
  /** Selected year */
  year: number;
  /** Year change callback */
  onYearChange: (year: number) => void;
  /** Cell click callback */
  onCellClick?: (cell: HeatmapCell) => void;
}

/** Props for commit timeline chart */
export interface CommitTimelineChartProps {
  /** Frequency data */
  data: CommitFrequencyData;
  /** Granularity options available */
  granularityOptions: TimeGranularity[];
  /** Current granularity */
  granularity: TimeGranularity;
  /** Granularity change callback */
  onGranularityChange: (g: TimeGranularity) => void;
  /** Whether to show per-repo overlay lines */
  showPerRepo: boolean;
}

/** Props for the gource viewer component */
export interface GourceViewerProps {
  /** Commit events for visualization */
  events: GourceCommitEvent[];
  /** Repositories being visualized */
  repositories: Repository[];
  /** Contributors */
  contributors: Contributor[];
  /** Initial settings */
  settings?: Partial<GourceSettings>;
  /** Whether to show combined view */
  combinedView: boolean;
  /** Active repo ID (for single repo view) */
  activeRepoId?: string | null;
  /** Callback when playback state changes */
  onPlaybackChange?: (state: PlaybackState) => void;
  /** Callback when current date changes */
  onDateChange?: (date: string) => void;
}

/** Props for wrapped slide container */
export interface WrappedSlideContainerProps {
  /** Current slide index */
  currentSlide: number;
  /** Total slides */
  totalSlides: number;
  /** Slide change callback */
  onSlideChange: (index: number) => void;
  /** Animation direction */
  direction: 'forward' | 'backward';
  /** Children (active slide component) */
  children: React.ReactNode;
}

/** Props for individual wrapped slides */
export interface WrappedSlideProps {
  /** Wrapped data */
  data: WrappedData;
  /** Whether this slide is currently active */
  isActive: boolean;
  /** Animation state */
  animationState: 'entering' | 'active' | 'exiting' | 'hidden';
  /** Callback when slide animation completes */
  onAnimationComplete?: () => void;
}

/** Props for story milestone timeline */
export interface MilestoneTimelineProps {
  /** Milestones to display */
  milestones: StoryMilestone[];
  /** Repos for color coding */
  repositories: Repository[];
  /** Click handler for a milestone */
  onMilestoneClick?: (milestone: StoryMilestone) => void;
}

/** Props for the playback controls overlay */
export interface PlaybackControlsProps {
  /** Current playback state */
  playbackState: PlaybackState;
  /** Current speed */
  speed: PlaybackSpeed;
  /** Current date being displayed */
  currentDate: string;
  /** Play callback */
  onPlay: () => void;
  /** Pause callback */
  onPause: () => void;
  /** Speed change callback */
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** Fullscreen toggle callback */
  onFullscreenToggle: () => void;
  /** Whether currently fullscreen */
  isFullscreen: boolean;
}

/** Props for timeline scrubber */
export interface TimelineScrubberProps {
  /** Current progress (0-1) */
  progress: number;
  /** Seek callback */
  onSeek: (progress: number) => void;
  /** Start date */
  startDate: string;
  /** End date */
  endDate: string;
  /** Commit density histogram data (for track visualization) */
  commitDensity: number[];
  /** Milestone markers */
  milestones?: Array<{ position: number; label: string }>;
}

/** Props for contributor legend */
export interface ContributorLegendProps {
  /** Contributors to display */
  contributors: GourceContributor[];
  /** Currently highlighted contributor ID */
  highlightedId: string | null;
  /** Click handler */
  onContributorClick: (id: string) => void;
}

/** Props for repo detail header */
export interface RepoHeaderProps {
  /** Repository data */
  repository: Repository;
  /** Date range of analysis */
  dateRange: DateRange;
  /** Total commits analyzed */
  commitCount: number;
}

/** Props for stat cards */
export interface StatCardProps {
  /** Card label */
  label: string;
  /** Card value (formatted string) */
  value: string | number;
  /** Raw numeric value for animation */
  numericValue?: number;
  /** Icon name or emoji */
  icon: string;
  /** Sparkline data points (optional) */
  sparklineData?: number[];
  /** Value color variant */
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  /** Gradient background colors */
  gradientColors?: [string, string];
  /** Subtitle or secondary info */
  subtitle?: string;
}

/** Props for share dialog */
export interface ShareDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Title of content being shared */
  title: string;
  /** Share text */
  shareText: string;
  /** Share URL */
  shareUrl: string;
  /** Element ref to capture for image generation */
  captureRef?: React.RefObject<HTMLElement | null>;
  /** Available share targets */
  targets: ('twitter' | 'linkedin' | 'copy-link' | 'download-image')[];
}

/** Props for the navigation cards on dashboard */
export interface NavigationCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Icon or preview element */
  icon: string;
  /** Link destination */
  href: string;
  /** Gradient colors */
  gradientColors: [string, string];
  /** Whether this feature is ready/available */
  isReady: boolean;
}

/** Props for the Claude OAuth input component */
export interface ClaudeOAuthInputProps {
  /** Current token value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Verify callback */
  onVerify: () => Promise<boolean>;
  /** Whether token is verified */
  isVerified: boolean;
  /** Whether verification is in progress */
  isVerifying: boolean;
  /** Error message */
  error: string | null;
}

/** Props for the GitHub OAuth connect component */
export interface GitHubOAuthConnectProps {
  /** Whether connected */
  isConnected: boolean;
  /** Connected user info */
  user: GitHubUser | null;
  /** Connect callback */
  onConnect: () => void;
  /** Disconnect callback */
  onDisconnect: () => void;
  /** Whether connection is in progress */
  isConnecting: boolean;
}

/** Props for selected repos summary bar */
export interface SelectedReposSummaryProps {
  /** Number of selected repos */
  selectedCount: number;
  /** Estimated total commits */
  estimatedCommits: number;
  /** Whether generate button should be enabled */
  canGenerate: boolean;
  /** Generate callback */
  onGenerate: () => void;
  /** Processing estimate text */
  processingEstimate: string;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/** Return type of useGitHubAuth hook */
export interface UseGitHubAuthReturn {
  /** Initiate OAuth flow */
  initiateOAuth: () => void;
  /** Whether connected to GitHub */
  isConnected: boolean;
  /** Connected user */
  user: GitHubUser | null;
  /** User's repositories */
  repos: Repository[];
  /** Disconnect from GitHub */
  disconnect: () => void;
  /** Whether OAuth is in progress */
  isLoading: boolean;
  /** Auth error */
  error: string | null;
}

/** Return type of useRepoFetcher hook */
export interface UseRepoFetcherReturn {
  /** Fetched repositories */
  repos: SelectableRepository[];
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether there are more repos to load */
  hasMore: boolean;
  /** Load more repositories */
  loadMore: () => void;
  /** Search repositories */
  search: (query: string) => void;
  /** Apply filters */
  filter: (filter: Partial<RepoFilter>) => void;
  /** Current filter state */
  currentFilter: RepoFilter;
  /** Total repo count */
  totalCount: number;
  /** Error */
  error: string | null;
}

/** Return type of useAnalytics hook */
export interface UseAnalyticsReturn {
  /** Contribution heatmap data */
  heatmap: HeatmapData | null;
  /** Commit frequency data */
  commitFrequency: CommitFrequencyData | null;
  /** Language breakdown */
  languageBreakdown: LanguageBreakdownData | null;
  /** Coding patterns */
  codingPatterns: CodingPatternsData | null;
  /** Streak data */
  streaks: StreakData | null;
  /** Productivity metrics */
  productivity: ProductivityData | null;
  /** Year-over-year data */
  yearOverYear: YearOverYearData | null;
  /** Superlatives */
  superlatives: SuperlativesData | null;
  /** Full analytics result */
  analytics: AnalyticsResult | null;
  /** Whether analytics are being computed */
  isComputing: boolean;
  /** Error during computation */
  error: string | null;
}

/** Return type of useGourcePlayback hook */
export interface UseGourcePlaybackReturn {
  /** Whether currently playing */
  isPlaying: boolean;
  /** Current playback speed */
  speed: PlaybackSpeed;
  /** Current simulation time (ms) */
  currentTime: number;
  /** Total duration (ms) */
  totalDuration: number;
  /** Current progress (0-1) */
  progress: number;
  /** Play the visualization */
  play: () => void;
  /** Pause the visualization */
  pause: () => void;
  /** Set playback speed */
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Seek to a specific progress (0-1) */
  seek: (progress: number) => void;
  /** Current date string being displayed */
  currentDate: string;
  /** Playback state */
  state: PlaybackState;
}

/** Return type of useWrappedSlideshow hook */
export interface UseWrappedSlideshowReturn {
  /** Current slide index */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Go to next slide */
  next: () => void;
  /** Go to previous slide */
  prev: () => void;
  /** Go to specific slide */
  goTo: (index: number) => void;
  /** Whether currently animating */
  isAnimating: boolean;
  /** Data for current slide */
  slideData: WrappedSlide | null;
  /** Transition direction */
  direction: 'forward' | 'backward';
  /** Whether auto-advance is active */
  autoAdvance: boolean;
  /** Toggle auto-advance */
  toggleAutoAdvance: () => void;
}

/** Return type of useStoryGenerator hook */
export interface UseStoryGeneratorReturn {
  /** Per-repo stories */
  stories: GeneratedStory[];
  /** Unified developer journey story */
  unifiedStory: GeneratedStory | null;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Generation progress */
  progress: StoryGenerationProgress;
  /** Start generating stories */
  generateStory: () => Promise<void>;
  /** Regenerate stories */
  regenerate: () => Promise<void>;
  /** Error during generation */
  error: string | null;
}

// =============================================================================
// AUDIO TYPES (minimal, for ambient/UI sounds)
// =============================================================================

/** Audio manager state */
export interface AudioManagerState {
  /** Whether audio system is initialized */
  isInitialized: boolean;
  /** Whether a sound is loaded */
  isLoaded: boolean;
  /** Current volume (0-1) */
  volume: number;
  /** Whether muted */
  isMuted: boolean;
  /** Currently loaded sound URL */
  loadedUrl: string | null;
}

/** Sound effect identifiers */
export enum SoundEffect {
  SLIDE_TRANSITION = 'slide-transition',
  COUNTER_TICK = 'counter-tick',
  CONFETTI = 'confetti',
  REVEAL = 'reveal',
  CLICK = 'click',
  SUCCESS = 'success',
  WHOOSH = 'whoosh',
  POP = 'pop',
}

// =============================================================================
// THEME TYPES
// =============================================================================

/** Theme configuration */
export interface ThemeConfig {
  /** Color palette */
  colors: ThemeColors;
  /** Gradient definitions */
  gradients: ThemeGradients;
  /** Animation tokens */
  animations: ThemeAnimations;
  /** Typography scale */
  typography: ThemeTypography;
}

/** Theme color palette */
export interface ThemeColors {
  /** Primary brand color */
  primary: string;
  /** Secondary brand color */
  secondary: string;
  /** Accent color */
  accent: string;
  /** Background colors */
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  /** Text colors */
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  /** Semantic colors */
  success: string;
  danger: string;
  warning: string;
  info: string;
  /** Gource-specific colors */
  gource: {
    nodeDefault: string;
    edgeDefault: string;
    beamDefault: string;
    particleDefault: string;
  };
}

/** Theme gradient definitions */
export interface ThemeGradients {
  /** Primary gradient */
  primary: string;
  /** Secondary gradient */
  secondary: string;
  /** Wrapped card gradient */
  wrapped: string;
  /** Hero section gradient */
  hero: string;
  /** Card glow gradient */
  cardGlow: string;
  /** Per-wrapped-slide gradients */
  wrappedSlides: Record<WrappedSlideType, string>;
}

/** Animation tokens */
export interface ThemeAnimations {
  /** Duration tokens */
  duration: {
    fast: string;
    normal: string;
    slow: string;
    glacial: string;
  };
  /** Easing functions */
  easing: {
    default: string;
    bounce: string;
    smooth: string;
    snap: string;
  };
}

/** Typography scale */
export interface ThemeTypography {
  /** Font families */
  fontFamily: {
    body: string;
    heading: string;
    mono: string;
  };
  /** Font size scale */
  fontSize: Record<string, string>;
  /** Font weight scale */
  fontWeight: Record<string, number>;
  /** Line height scale */
  lineHeight: Record<string, string>;
}

// =============================================================================
// CONTENT TYPES
// =============================================================================

/** Landing page content */
export interface LandingContent {
  /** Hero section content */
  hero: {
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
  };
  /** Feature items */
  features: FeatureItem[];
  /** How it works steps */
  howItWorks: HowItWorksStep[];
  /** CTA section */
  cta: {
    headline: string;
    subheadline: string;
    buttonText: string;
    buttonLink: string;
  };
  /** Social proof stats */
  socialProof: SocialProofStat[];
}

/** How it works step */
export interface HowItWorksStep {
  /** Step number */
  step: number;
  /** Step icon/emoji */
  icon: string;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
}

/** Social proof stat */
export interface SocialProofStat {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Whether to animate the counter */
  animate: boolean;
}

/** Wrapped content templates */
export interface WrappedContentTemplates {
  /** Slide title templates (with {placeholder} syntax) */
  slideTitles: Record<WrappedSlideType, string>;
  /** Slide subtitle templates */
  slideSubtitles: Record<WrappedSlideType, string>;
  /** Superlative labels */
  superlativeLabels: Record<string, string>;
  /** Share text templates */
  shareTextTemplates: Record<WrappedSlideType, string>;
  /** Fun facts templates */
  funFacts: string[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Pagination state */
export interface PaginationState {
  /** Current page */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total items */
  total: number;
  /** Total pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

/** Generic async operation state */
export interface AsyncState<T> {
  /** The data */
  data: T | null;
  /** Whether loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether the operation has completed at least once */
  isReady: boolean;
}

/** Sort configuration */
export interface SortConfig<T = string> {
  /** Field to sort by */
  field: T;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Coordinate point */
export interface Point {
  x: number;
  y: number;
}

/** Rectangle bounds */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Color in various formats */
export interface Color {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Quadtree bounding box for spatial indexing */
export interface QuadTreeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Quadtree node for spatial queries */
export interface QuadTreeNode<T> {
  bounds: QuadTreeBounds;
  data: T[];
  children: QuadTreeNode<T>[] | null;
  depth: number;
  maxDepth: number;
  maxItems: number;
}

/** WebWorker message for offloading computation */
export interface WorkerMessage<T = unknown> {
  /** Message type */
  type: string;
  /** Message payload */
  payload: T;
  /** Unique request ID for correlating responses */
  requestId: string;
}

/** WebWorker response */
export interface WorkerResponse<T = unknown> {
  /** Response type */
  type: string;
  /** Response payload */
  payload: T;
  /** Corresponding request ID */
  requestId: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Processing duration in ms */
  duration: number;
}

/** Debounced function type */
export type DebouncedFunction<T extends (...args: unknown[]) => unknown> = T & {
  cancel: () => void;
  flush: () => void;
};

/** Deep partial utility type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Make specific keys required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Extract the resolved type of a Promise */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/** Nullable type */
export type Nullable<T> = T | null;

/** Map of language name to hex color */
export type LanguageColorMap = Record<string, string>;

/** GitHub language colors (common ones) */
export const GITHUB_LANGUAGE_COLORS: LanguageColorMap = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  R: '#198CE7',
  MATLAB: '#e16737',
  Perl: '#0298c3',
  Zig: '#ec915c',
  Nim: '#ffc200',
  OCaml: '#3be133',
  Clojure: '#db5855',
  Erlang: '#B83998',
} as const;

/** File extension to category mapping */
export const FILE_EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  ts: FileCategory.CODE,
  tsx: FileCategory.CODE,
  js: FileCategory.CODE,
  jsx: FileCategory.CODE,
  py: FileCategory.CODE,
  java: FileCategory.CODE,
  go: FileCategory.CODE,
  rs: FileCategory.CODE,
  cpp: FileCategory.CODE,
  c: FileCategory.CODE,
  cs: FileCategory.CODE,
  rb: FileCategory.CODE,
  php: FileCategory.CODE,
  swift: FileCategory.CODE,
  kt: FileCategory.CODE,
  dart: FileCategory.CODE,
  scala: FileCategory.CODE,
  ex: FileCategory.CODE,
  exs: FileCategory.CODE,
  hs: FileCategory.CODE,
  lua: FileCategory.CODE,
  r: FileCategory.CODE,
  sql: FileCategory.CODE,
  html: FileCategory.MARKUP,
  htm: FileCategory.MARKUP,
  xml: FileCategory.MARKUP,
  svg: FileCategory.MARKUP,
  vue: FileCategory.MARKUP,
  svelte: FileCategory.MARKUP,
  md: FileCategory.DOCUMENTATION,
  mdx: FileCategory.DOCUMENTATION,
  txt: FileCategory.DOCUMENTATION,
  rst: FileCategory.DOCUMENTATION,
  adoc: FileCategory.DOCUMENTATION,
  doc: FileCategory.DOCUMENTATION,
  pdf: FileCategory.DOCUMENTATION,
  json: FileCategory.CONFIG,
  yaml: FileCategory.CONFIG,
  yml: FileCategory.CONFIG,
  toml: FileCategory.CONFIG,
  ini: FileCategory.CONFIG,
  env: FileCategory.CONFIG,
  cfg: FileCategory.CONFIG,
  conf: FileCategory.CONFIG,
  gitignore: FileCategory.CONFIG,
  eslintrc: FileCategory.CONFIG,
  prettierrc: FileCategory.CONFIG,
  editorconfig: FileCategory.CONFIG,
  dockerignore: FileCategory.CONFIG,
  css: FileCategory.ASSET,
  scss: FileCategory.ASSET,
  sass: FileCategory.ASSET,
  less: FileCategory.ASSET,
  png: FileCategory.ASSET,
  jpg: FileCategory.ASSET,
  jpeg: FileCategory.ASSET,
  gif: FileCategory.ASSET,
  ico: FileCategory.ASSET,
  webp: FileCategory.ASSET,
  woff: FileCategory.ASSET,
  woff2: FileCategory.ASSET,
  ttf: FileCategory.ASSET,
  otf: FileCategory.ASSET,
  mp3: FileCategory.ASSET,
  wav: FileCategory.ASSET,
  mp4: FileCategory.ASSET,
  webm: FileCategory.ASSET,
  test: FileCategory.TEST,
  spec: FileCategory.TEST,
  snap: FileCategory.TEST,
  Makefile: FileCategory.BUILD,
  Dockerfile: FileCategory.BUILD,
  Jenkinsfile: FileCategory.BUILD,
  gradle: FileCategory.BUILD,
  cmake: FileCategory.BUILD,
  csv: FileCategory.DATA,
  tsv: FileCategory.DATA,
  parquet: FileCategory.DATA,
  db: FileCategory.DATA,
  sqlite: FileCategory.DATA,
} as const;

/** Default gource settings */
export const DEFAULT_GOURCE_SETTINGS: GourceSettings = {
  nodeSize: 7,
  edgeThickness: 1.2,
  showLabels: true,
  showAvatars: true,
  backgroundColor: '#080810',
  showGlowEffects: true,
  showParticles: true,
  dateFilter: null,
  contributorFilter: null,
  extensionColors: {},
  maxVisibleNodes: 5000,
  showCommitBeams: true,
  nodeFadeTime: 25000,
  springStiffness: 0.015,
  repulsionForce: 120,
  skipDeadTime: true,
} as const;

/** Default camera state */
export const DEFAULT_CAMERA: GourceCamera = {
  x: 0,
  y: 0,
  zoom: 1,
  targetX: 0,
  targetY: 0,
  targetZoom: 1,
  isUserControlled: false,
} as const;

/** Wrapped slide definitions with defaults */
export const WRAPPED_SLIDE_DEFINITIONS: WrappedSlide[] = [
  { type: WrappedSlideType.INTRO, index: 0, gradientColors: ['#1a1a2e', '#16213e'], autoAdvanceMs: 5000, animation: 'fade-in', shareable: true },
  { type: WrappedSlideType.TOP_REPOS, index: 1, gradientColors: ['#0f3460', '#533483'], autoAdvanceMs: 7000, animation: 'slide-up', shareable: true },
  { type: WrappedSlideType.PRODUCTIVITY, index: 2, gradientColors: ['#1b1b2f', '#162447'], autoAdvanceMs: 6000, animation: 'scale-pop', shareable: true },
  { type: WrappedSlideType.LANGUAGE_EVOLUTION, index: 3, gradientColors: ['#2d132c', '#801336'], autoAdvanceMs: 8000, animation: 'slide-left', shareable: true },
  { type: WrappedSlideType.STREAKS, index: 4, gradientColors: ['#1a1a2e', '#e94560'], autoAdvanceMs: 6000, animation: 'slide-up', shareable: true },
  { type: WrappedSlideType.MONTHLY_BREAKDOWN, index: 5, gradientColors: ['#0c0032', '#190061'], autoAdvanceMs: 8000, animation: 'fade-in', shareable: true },
  { type: WrappedSlideType.YEARLY_COMPARISON, index: 6, gradientColors: ['#240046', '#3c096c'], autoAdvanceMs: 7000, animation: 'scale-pop', shareable: true },
  { type: WrappedSlideType.SUPERLATIVES, index: 7, gradientColors: ['#10002b', '#5a189a'], autoAdvanceMs: 8000, animation: 'slide-up', shareable: true },
  { type: WrappedSlideType.FINAL_SUMMARY, index: 8, gradientColors: ['#1a1a2e', '#7b2ff7', '#c084fc'], autoAdvanceMs: null, animation: 'scale-pop', shareable: true },
] as const;

/** Keyboard shortcuts for the application */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'Space', description: 'Play/Pause gource', action: 'gource-toggle-playback' },
  { key: 'ArrowRight', description: 'Next wrapped slide', action: 'wrapped-next' },
  { key: 'ArrowLeft', description: 'Previous wrapped slide', action: 'wrapped-prev' },
  { key: 'ArrowUp', description: 'Speed up gource', action: 'gource-speed-up' },
  { key: 'ArrowDown', description: 'Slow down gource', action: 'gource-speed-down' },
  { key: 'f', description: 'Toggle fullscreen', action: 'toggle-fullscreen' },
  { key: 'r', description: 'Reset camera', action: 'gource-reset-camera' },
  { key: 'Escape', description: 'Exit fullscreen / close modal', action: 'escape' },
  { key: '+', description: 'Zoom in', action: 'gource-zoom-in' },
  { key: '-', description: 'Zoom out', action: 'gource-zoom-out' },
  { key: 'l', description: 'Toggle labels', action: 'gource-toggle-labels' },
  { key: 'a', description: 'Toggle avatars', action: 'gource-toggle-avatars' },
] as const;

/** File category colors for gource visualization */
export const FILE_CATEGORY_COLORS: Record<FileCategory, string> = {
  [FileCategory.CODE]: '#60a5fa',
  [FileCategory.MARKUP]: '#f97316',
  [FileCategory.CONFIG]: '#a78bfa',
  [FileCategory.DOCUMENTATION]: '#34d399',
  [FileCategory.ASSET]: '#fb923c',
  [FileCategory.TEST]: '#fbbf24',
  [FileCategory.BUILD]: '#f472b6',
  [FileCategory.DATA]: '#2dd4bf',
  [FileCategory.OTHER]: '#94a3b8',
} as const;
