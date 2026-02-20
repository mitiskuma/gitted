// src/lib/types.ts
// Shared types for the "gitted" project — Git Story, Wrapped & Gource visualization platform
//
// This file is the single source of truth for all shared TypeScript types.
// It is organized into logical sections. Do NOT split into multiple files.

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/** Processing pipeline status for data fetching and generation workflows. */
export enum ProcessingStatus {
  IDLE = 'idle',
  FETCHING = 'fetching',
  ANALYZING = 'analyzing',
  GENERATING = 'generating',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/** Granularity for time-series data in charts and analytics. */
export enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/** Gource visualization playback state. */
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  SEEKING = 'seeking',
}

/** Gource playback speed presets. */
export enum PlaybackSpeed {
  HALF = 0.5,
  NORMAL = 1,
  DOUBLE = 2,
  FAST = 5,
  ULTRA = 10,
}

/** Wrapped slideshow slide identifiers. */
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

/** Story generation phase for the AI narrative pipeline. */
export enum StoryPhase {
  IDLE = 'idle',
  BATCHING_COMMITS = 'batching-commits',
  SUMMARIZING = 'summarizing',
  GENERATING_NARRATIVE = 'generating-narrative',
  EXTRACTING_MILESTONES = 'extracting-milestones',
  COMPLETE = 'complete',
  ERROR = 'error',
  /** Narrative pipeline v2 phases */
  PREPROCESSING = 'preprocessing',
  ANALYZING_REPOS = 'analyzing-repos',
  CORRELATING = 'correlating',
  WRITING_CHAPTERS = 'writing-chapters',
  ENRICHING = 'enriching',
}

/** Sort options for repository listing. */
export enum RepoSortOption {
  NAME_ASC = 'name-asc',
  NAME_DESC = 'name-desc',
  STARS_DESC = 'stars-desc',
  UPDATED_DESC = 'updated-desc',
  COMMITS_DESC = 'commits-desc',
}

/** File extension categories for gource coloring. */
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

/** Day of week for analytics (0 = Sunday). */
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
// AUTHENTICATION & USER
// =============================================================================

/** GitHub user profile returned from the API. */
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  publicRepos: number;
  totalRepos: number;
  createdAt: string;
  email: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
}

/** Authentication state for GitHub and Claude connections. */
export interface AuthState {
  isGitHubConnected: boolean;
  isClaudeConnected: boolean;
  isFullyAuthenticated: boolean;
  githubToken: string | null;
  claudeToken: string | null;
  githubUser: GitHubUser | null;
  lastValidated: number | null;
  error: string | null;
}

/** Auth context action methods. */
export interface AuthActions {
  setClaudeToken: (token: string) => Promise<boolean>;
  initiateGitHubOAuth: () => void;
  handleGitHubCallback: (code: string) => Promise<void>;
  disconnectGitHub: () => void;
  clearClaudeToken: () => void;
  logout: () => void;
  validateTokens: () => Promise<void>;
}

// =============================================================================
// REPOSITORY
// =============================================================================

/** Repository metadata from GitHub API. */
export interface Repository {
  id: string;
  githubId: number;
  name: string;
  fullName: string;
  description: string | null;
  owner: RepositoryOwner;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  language: string | null;
  languages: Record<string, number>;
  starCount: number;
  forkCount: number;
  watcherCount: number;
  openIssueCount: number;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  htmlUrl: string;
  cloneUrl: string;
  commitCount: number | null;
  size: number;
  topics: string[];
  license: LicenseInfo | null;
}

/** Repository owner information. */
export interface RepositoryOwner {
  login: string;
  avatarUrl: string;
  isOrg: boolean;
  type: 'User' | 'Organization';
}

/** License information for a repository. */
export interface LicenseInfo {
  key: string;
  name: string;
  spdxId: string | null;
}

/** Repository with selection state for the connect page. */
export interface SelectableRepository extends Repository {
  isSelected: boolean;
  fetchStatus: 'unfetched' | 'fetching' | 'fetched' | 'error';
}

/** Repository filter criteria for the repo selector. */
export interface RepoFilter {
  searchQuery: string;
  language: string | null;
  visibility: 'all' | 'public' | 'private';
  includeForks: boolean;
  includeArchived: boolean;
  sortBy: RepoSortOption;
  ownerType: 'all' | 'user' | 'org';
}

// =============================================================================
// COMMITS & CONTRIBUTORS
// =============================================================================

/** Normalized commit data (processed from GitHub API). */
export interface CommitData {
  sha: string;
  shortSha: string;
  message: string;
  messageHeadline: string;
  author: CommitAuthor;
  committer: CommitAuthor;
  timestamp: string;
  timestampMs: number;
  repoId: string;
  repoName: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  totalChanges: number;
  isMerge: boolean;
  parents: string[];
  files: CommitFile[];
  htmlUrl: string;
  hourOfDay: number;
  dayOfWeek: DayOfWeek;
  year: number;
  month: number;
  dayOfMonth: number;
  weekOfYear: number;
  dateKey: string;
}

/** Commit author information. */
export interface CommitAuthor {
  name: string;
  email: string;
  login: string | null;
  avatarUrl: string | null;
}

/** File changed in a commit. */
export interface CommitFile {
  path: string;
  filename: string;
  directory: string;
  extension: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied';
  additions: number;
  deletions: number;
  changes: number;
  previousPath: string | null;
  category: FileCategory;
}

/** Contributor aggregated data across repos. */
export interface Contributor {
  id: string;
  name: string;
  email: string;
  login: string | null;
  avatarUrl: string | null;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  firstCommitDate: string;
  lastCommitDate: string;
  repos: string[];
  color: string;
}

/** Raw commit batch for processing pipelines. */
export interface CommitBatch {
  repoId: string;
  batchIndex: number;
  totalBatches: number;
  commits: CommitData[];
  isLast: boolean;
}

// =============================================================================
// ANALYTICS
// =============================================================================

/** Complete analytics result for all selected repos. */
export interface AnalyticsResult {
  heatmap: HeatmapData;
  commitFrequency: CommitFrequencyData;
  languageBreakdown: LanguageBreakdownData;
  codingPatterns: CodingPatternsData;
  streaks: StreakData;
  productivity: ProductivityData;
  yearOverYear: YearOverYearData;
  monthlyBreakdown: MonthlyBreakdownData;
  superlatives: SuperlativesData;
  topContributors: Contributor[];
  dateRange: DateRange;
  totals: TotalStats;
  computedAt: number;
}

/** Total aggregate statistics across all repos. */
export interface TotalStats {
  totalCommits: number;
  totalRepos: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  activeDays: number;
  uniqueContributors: number;
  avgCommitsPerDay: number;
  avgCommitsPerWeek: number;
}

/** Date range with start/end and total days. */
export interface DateRange {
  start: string;
  end: string;
  totalDays: number;
}

/** Heatmap data for GitHub-style contribution calendar. */
export interface HeatmapData {
  cells: Record<string, HeatmapCell>;
  maxCount: number;
  years: number[];
}

/** Single heatmap cell representing one day. */
export interface HeatmapCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  repos: string[];
}

/** Commit frequency time series data. */
export interface CommitFrequencyData {
  series: CommitFrequencyPoint[];
  perRepoSeries: Record<string, CommitFrequencyPoint[]>;
  granularity: TimeGranularity;
}

/** Single point in commit frequency series. */
export interface CommitFrequencyPoint {
  label: string;
  date: string;
  count: number;
  additions: number;
  deletions: number;
}

/** Language breakdown data for pie charts. */
export interface LanguageBreakdownData {
  languages: LanguageEntry[];
  totalBytes: number;
}

/** Single language entry with byte count and color. */
export interface LanguageEntry {
  name: string;
  bytes: number;
  percentage: number;
  repoCount: number;
  color: string;
}

/** Coding patterns data (hour/day distributions). */
export interface CodingPatternsData {
  byHour: number[];
  byDayOfWeek: number[];
  hourDayMatrix: number[][];
  peakHour: number;
  peakDay: DayOfWeek;
  isNightOwl: boolean;
  isEarlyBird: boolean;
  weekendPercentage: number;
}

/** Streak data including current and longest streaks. */
export interface StreakData {
  longestStreak: StreakInfo;
  currentStreak: StreakInfo;
  mostCommitsInDay: {
    date: string;
    count: number;
    repos: string[];
  };
  topStreaks: StreakInfo[];
}

/** Individual streak information. */
export interface StreakInfo {
  length: number;
  startDate: string;
  endDate: string;
  totalCommits: number;
}

/** Productivity metrics computed from commit data. */
export interface ProductivityData {
  mostProductiveMonth: {
    label: string;
    year: number;
    month: number;
    commits: number;
  };
  mostProductiveDay: {
    day: DayOfWeek;
    dayName: string;
    avgCommits: number;
  };
  avgCommitsPerActiveDay: number;
  avgLinesPerCommit: number;
  commitSizeDistribution: {
    small: number;   // < 10 lines
    medium: number;  // 10-100 lines
    large: number;   // 100-500 lines
    huge: number;    // 500+ lines
  };
}

/** Year-over-year comparison data. */
export interface YearOverYearData {
  years: YearStats[];
  hasMultipleYears: boolean;
  growth: YearGrowth[];
}

/** Stats for a single year. */
export interface YearStats {
  year: number;
  commits: number;
  additions: number;
  deletions: number;
  activeDays: number;
  repoCount: number;
  topLanguage: string | null;
}

/** Growth between two consecutive years. */
export interface YearGrowth {
  fromYear: number;
  toYear: number;
  commitGrowth: number;
  activeDaysGrowth: number;
  linesGrowth: number;
}

/** Monthly breakdown data for charts. */
export interface MonthlyBreakdownData {
  months: MonthStats[];
  peakMonthIndex: number;
}

/** Stats for a single month. */
export interface MonthStats {
  year: number;
  month: number;
  label: string;
  commits: number;
  additions: number;
  deletions: number;
  topRepo: string | null;
  activeDays: number;
}

/** Fun superlatives computed from commit data. */
export interface SuperlativesData {
  chronotype: 'night-owl' | 'early-bird' | 'balanced';
  weekendType: 'weekend-warrior' | 'weekday-warrior' | 'balanced';
  favoriteCommitWord: {
    word: string;
    count: number;
  };
  longestCommitMessage: {
    message: string;
    length: number;
    sha: string;
    repoId: string;
  };
  shortestCommitMessage: {
    message: string;
    length: number;
    sha: string;
    repoId: string;
  };
  busiestHour: {
    date: string;
    hour: number;
    commits: number;
  };
  mostChurnedRepo: {
    repoId: string;
    repoName: string;
    totalChanges: number;
  };
  commitMood: 'positive' | 'neutral' | 'negative';
  fixCommits: number;
  featureCommits: number;
  refactorCommits: number;
  mergePercentage: number;
  badges: Badge[];
}

/** Achievement badge awarded based on commit behavior. */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
}

// =============================================================================
// STORY / AI GENERATION
// =============================================================================

/** AI-generated story for a repository or combined. */
export interface GeneratedStory {
  id: string;
  type: 'repo' | 'unified';
  repoId: string | null;
  title: string;
  subtitle: string;
  content: string;
  chapters: StoryChapter[];
  milestones: StoryMilestone[];
  generatedAt: number;
  dateRange: DateRange;
  model: string;
}

/** Chapter within a generated story. */
export interface StoryChapter {
  index: number;
  title: string;
  content: string;
  dateRange: DateRange;
  repoIds: string[];
  anchorId: string;
}

/** Milestone in the developer journey. */
export interface StoryMilestone {
  date: string;
  title: string;
  description: string;
  repoId: string | null;
  repoName: string | null;
  type: 'project-start' | 'major-release' | 'pivot' | 'breakthrough' | 'collaboration' | 'milestone' | 'achievement';
  significance: number;
  relatedCommits: string[];
  icon: string;
}

/** Story generation progress tracking. */
export interface StoryGenerationProgress {
  phase: StoryPhase;
  overallProgress: number;
  currentStep: string;
  reposProcessed: number;
  totalRepos: number;
  commitsSummarized: number;
  totalCommits: number;
  estimatedTimeRemaining: number | null;
}

/** Compressed commit summary batch for Claude API input. */
export interface CommitSummaryBatch {
  repoId: string;
  repoName: string;
  period: DateRange;
  commitCount: number;
  messageSummary: string;
  keyFilesChanged: string[];
  netAdditions: number;
  netDeletions: number;
  contributors: string[];
  patterns: string[];
}

/** Claude API prompt template for story generation. */
export interface StoryPromptTemplate {
  id: string;
  systemPrompt: string;
  userPromptTemplate: string;
  maxTokens: number;
  temperature: number;
}

// =============================================================================
// WRAPPED SLIDESHOW
// =============================================================================

/** Complete wrapped data for the year-in-review slideshow. */
export interface WrappedData {
  user: GitHubUser;
  totals: TotalStats;
  topRepos: WrappedRepoStat[];
  productivity: ProductivityData;
  languageEvolution: LanguageEvolutionEntry[];
  streaks: StreakData;
  monthlyBreakdown: MonthlyBreakdownData;
  yearOverYear: YearOverYearData;
  superlatives: SuperlativesData;
  dateRange: DateRange;
  wrappedYear: number;
}

/** Repo stat for wrapped top repos slide. */
export interface WrappedRepoStat {
  repoId: string;
  repoName: string;
  commits: number;
  language: string | null;
  languageColor: string;
  rank: number;
  percentage: number;
}

/** Language evolution over time for wrapped. */
export interface LanguageEvolutionEntry {
  period: string;
  date: string;
  languages: Record<string, number>;
}

/** Wrapped slide definition with layout and animation config. */
export interface WrappedSlide {
  type: WrappedSlideType;
  index: number;
  gradientColors: [string, string, string?];
  autoAdvanceMs: number | null;
  animation: 'slide-up' | 'fade-in' | 'scale-pop' | 'slide-left';
  shareable: boolean;
}

/** Wrapped content templates for slide text and sharing. */
export interface WrappedContentTemplates {
  slideTitles: Record<WrappedSlideType, string>;
  slideSubtitles: Record<WrappedSlideType, string>;
  superlativeLabels: Record<string, string>;
  shareTextTemplates: Record<WrappedSlideType, string>;
  funFacts: string[];
}

// =============================================================================
// GOURCE VISUALIZATION
// =============================================================================

/** Gource visualization state (playback, camera, settings). */
export interface GourceState {
  playback: PlaybackState;
  speed: PlaybackSpeed;
  currentTime: number;
  currentDate: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  progress: number;
  activeRepoId: string | null;
  isCombinedView: boolean;
  camera: GourceCamera;
  settings: GourceSettings;
}

/** Gource camera state for panning and zooming. */
export interface GourceCamera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  isUserControlled: boolean;
}

/** Gource visualization settings. */
export interface GourceSettings {
  nodeSize: number;
  edgeThickness: number;
  showLabels: boolean;
  showAvatars: boolean;
  backgroundColor: string;
  showGlowEffects: boolean;
  showParticles: boolean;
  dateFilter: DateRange | null;
  contributorFilter: string[] | null;
  extensionColors: Record<string, string>;
  maxVisibleNodes: number;
  showCommitBeams: boolean;
  nodeFadeTime: number;
  springStiffness: number;
  repulsionForce: number;
  skipDeadTime: boolean;
}

/** A node in the gource file tree (file or directory). */
export interface GourceNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  isDirectory: boolean;
  children: string[];
  extension: string;
  category: FileCategory;
  repoId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  opacity: number;
  scale: number;
  lastModified: number;
  modificationCount: number;
  isVisible: boolean;
  depth: number;
  angle: number;
  radius: number;
}

/** A commit event for gource animation. */
export interface GourceCommitEvent {
  sha: string;
  timestamp: number;
  contributorId: string;
  contributorName: string;
  contributorAvatarUrl: string | null;
  repoId: string;
  affectedFiles: GourceFileChange[];
  processed: boolean;
}

/** File change within a gource commit event. */
export interface GourceFileChange {
  path: string;
  type: 'add' | 'modify' | 'delete' | 'rename';
  additions: number;
  deletions: number;
}

/** Active contributor avatar in the gource visualization. */
export interface GourceContributor {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarImage: HTMLImageElement | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  opacity: number;
  lastActiveTime: number;
  isVisible: boolean;
}

/** Commit beam animation (line from contributor to file). */
export interface GourceBeam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number;
  opacity: number;
  ttl: number;
}

/** Particle effect for commit visualization. */
export interface GourceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  opacity: number;
  ttl: number;
  maxTtl: number;
}

// =============================================================================
// GAME ENGINE / RENDER LOOP
// =============================================================================

/** Core game loop state for the visualization engine. */
export interface GameLoopState {
  isRunning: boolean;
  frameCount: number;
  lastFrameTime: number;
  deltaTime: number;
  fps: number;
  targetFps: number;
  accumulator: number;
  fixedTimestep: number;
}

/** Render context passed to render functions. */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelRatio: number;
  deltaTime: number;
  frameCount: number;
  camera: GourceCamera;
}

// =============================================================================
// APP STORE / GLOBAL STATE
// =============================================================================

/** Global application store state. */
export interface AppStoreState {
  selectedRepos: string[];
  processingStatus: ProcessingStatus;
  currentView: string;
  wrappedSlideIndex: number;
  gourcePlaybackState: PlaybackState;
  error: AppError | null;
  isInitialized: boolean;
  loadingStates: Record<string, boolean>;
}

/** App store actions for state mutations. */
export interface AppStoreActions {
  setSelectedRepos: (repos: string[]) => void;
  toggleRepoSelection: (repoId: string) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  setCurrentView: (view: string) => void;
  setWrappedSlideIndex: (index: number) => void;
  setGourcePlaybackState: (state: PlaybackState) => void;
  setError: (error: AppError | null) => void;
  setInitialized: (initialized: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  reset: () => void;
  initSong: (data: InitializationData) => void;
}

/** Combined app store type (state + actions). */
export type AppStore = AppStoreState & AppStoreActions;

/** Application error with recovery info. */
export interface AppError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  timestamp: number;
}

/** Data required to initialize the app engine. */
export interface InitializationData {
  repositories: Repository[];
  commits: CommitData[];
  analytics: AnalyticsResult | null;
  stories: GeneratedStory[] | null;
  user: GitHubUser;
}

// =============================================================================
// GIT DATA CONTEXT
// =============================================================================

/** Git data context state — single source of truth for all fetched git data. */
export interface GitDataState {
  allRepositories: Repository[];
  selectedRepositories: Repository[];
  commitsByRepo: Record<string, CommitData[]>;
  allCommitsSorted: CommitData[];
  contributors: Record<string, Contributor>;
  analytics: AnalyticsResult | null;
  stories: GeneratedStory[];
  unifiedStory: GeneratedStory | null;
  wrappedData: WrappedData | null;
  gourceEvents: GourceCommitEvent[];
  fetchStatus: Record<string, RepoFetchStatus>;
  isDataReady: boolean;
  lastRefreshed: number | null;
  totalReposToFetch: number;
  reposCompletedCount: number;
}

/** Fetch status for a single repository's data. */
export interface RepoFetchStatus {
  metadata: boolean;
  commits: boolean;
  contributors: boolean;
  languages: boolean;
  totalCommits: number;
  commitsFetched: number;
  isFetching: boolean;
  error: string | null;
}

/** Git data context actions. */
export interface GitDataActions {
  setAllRepositories: (repos: Repository[]) => void;
  setSelectedRepositories: (repos: Repository[]) => void;
  addCommits: (repoId: string, commits: CommitData[]) => void;
  setAnalytics: (analytics: AnalyticsResult) => void;
  addStory: (story: GeneratedStory) => void;
  setUnifiedStory: (story: GeneratedStory) => void;
  setWrappedData: (data: WrappedData) => void;
  setGourceEvents: (events: GourceCommitEvent[]) => void;
  updateFetchStatus: (repoId: string, status: Partial<RepoFetchStatus>) => void;
  fetchSelectedRepoData: () => Promise<void>;
  clearData: () => void;
  refreshData: () => Promise<void>;
}

// =============================================================================
// API TYPES
// =============================================================================

/** GitHub API pagination info parsed from link headers. */
export interface GitHubPagination {
  page: number;
  perPage: number;
  totalPages: number | null;
  hasMore: boolean;
  links: {
    next: string | null;
    prev: string | null;
    last: string | null;
    first: string | null;
  };
}

/** GitHub API rate limit info. */
export interface GitHubRateLimit {
  remaining: number;
  limit: number;
  resetAt: number;
  isLimited: boolean;
}

/** Claude API request payload. */
export interface ClaudeApiRequest {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  stream: boolean;
}

/** Claude API response (non-streaming). */
export interface ClaudeApiResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
}

/** Claude API streaming chunk. */
export interface ClaudeStreamChunk {
  type: 'content_block_delta' | 'message_start' | 'message_delta' | 'message_stop';
  text?: string;
  isFinal: boolean;
}

/** Generic API route response wrapper. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  pagination?: GitHubPagination;
  rateLimit?: GitHubRateLimit;
}

// =============================================================================
// CACHE
// =============================================================================

/** Cached data entry with TTL. */
export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: number;
  ttl: number;
  expiresAt: number;
  version: number;
}

/** Cache configuration for IndexedDB. */
export interface CacheConfig {
  defaultTtl: number;
  maxEntries: number;
  dbName: string;
  storeName: string;
  version: number;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/** Props for the hero section on the landing page. */
export interface HeroSectionProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
}

/** Props for the repository selector component. */
export interface RepositorySelectorProps {
  repositories: SelectableRepository[];
  onSelectionChange: (selectedIds: string[]) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  filter: RepoFilter;
  onFilterChange: (filter: RepoFilter) => void;
}

/** Props for contribution heatmap component. */
export interface ContributionHeatmapProps {
  data: HeatmapData;
  year: number;
  onYearChange: (year: number) => void;
  onCellClick?: (cell: HeatmapCell) => void;
}

/** Props for the gource viewer component. */
export interface GourceViewerProps {
  events: GourceCommitEvent[];
  repositories: Repository[];
  contributors: Contributor[];
  settings?: Partial<GourceSettings>;
  combinedView: boolean;
  activeRepoId?: string | null;
  onPlaybackChange?: (state: PlaybackState) => void;
  onDateChange?: (date: string) => void;
}

/** Props for wrapped slide container. */
export interface WrappedSlideContainerProps {
  currentSlide: number;
  totalSlides: number;
  onSlideChange: (index: number) => void;
  direction: 'forward' | 'backward';
  children: React.ReactNode;
}

/** Props for individual wrapped slides. */
export interface WrappedSlideProps {
  data: WrappedData;
  isActive: boolean;
  animationState: 'entering' | 'active' | 'exiting' | 'hidden';
  onAnimationComplete?: () => void;
}

/** Props for story milestone timeline. */
export interface MilestoneTimelineProps {
  milestones: StoryMilestone[];
  repositories: Repository[];
  onMilestoneClick?: (milestone: StoryMilestone) => void;
}

/** Props for the playback controls overlay. */
export interface PlaybackControlsProps {
  playbackState: PlaybackState;
  speed: PlaybackSpeed;
  currentDate: string;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onFullscreenToggle: () => void;
  isFullscreen: boolean;
}

/** Props for timeline scrubber. */
export interface TimelineScrubberProps {
  progress: number;
  onSeek: (progress: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  startDate: string;
  endDate: string;
  commitDensity: number[];
  milestones?: Array<{ position: number; label: string }>;
}

/** Props for contributor legend. */
export interface ContributorLegendProps {
  contributors: GourceContributor[];
  highlightedId: string | null;
  onContributorClick: (id: string) => void;
}

/** Props for share dialog. */
export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  shareText: string;
  shareUrl: string;
  captureRef?: React.RefObject<HTMLElement | null>;
  targets: ('twitter' | 'linkedin' | 'copy-link' | 'download-image')[];
}

/** Props for the navigation cards on dashboard. */
export interface NavigationCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  gradientColors: [string, string];
  isReady: boolean;
}

/** Props for the Claude OAuth input component. */
export interface ClaudeOAuthInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerify: () => Promise<boolean>;
  isVerified: boolean;
  isVerifying: boolean;
  error: string | null;
}

/** Props for the GitHub OAuth connect component. */
export interface GitHubOAuthConnectProps {
  isConnected: boolean;
  user: GitHubUser | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}

/** Props for selected repos summary bar. */
export interface SelectedReposSummaryProps {
  selectedCount: number;
  estimatedCommits: number;
  canGenerate: boolean;
  onGenerate: () => void;
  processingEstimate: string;
}

/** Feature item for landing page cards. */
export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  link: string;
  gradientColors: [string, string];
}

/** How it works step for the landing page. */
export interface HowItWorksStep {
  step: number;
  icon: string;
  title: string;
  description: string;
}

/** Social proof stat for the landing page. */
export interface SocialProofStat {
  label: string;
  value: string | number;
  animate: boolean;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/** Return type of useGitHubAuth hook. */
export interface UseGitHubAuthReturn {
  initiateOAuth: () => void;
  isConnected: boolean;
  user: GitHubUser | null;
  repos: Repository[];
  disconnect: () => void;
  isLoading: boolean;
  error: string | null;
}

/** Return type of useRepoFetcher hook. */
export interface UseRepoFetcherReturn {
  repos: SelectableRepository[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  search: (query: string) => void;
  filter: (filter: Partial<RepoFilter>) => void;
  currentFilter: RepoFilter;
  totalCount: number;
  error: string | null;
}

/** Return type of useAnalytics hook. */
export interface UseAnalyticsReturn {
  heatmap: HeatmapData | null;
  commitFrequency: CommitFrequencyData | null;
  languageBreakdown: LanguageBreakdownData | null;
  codingPatterns: CodingPatternsData | null;
  streaks: StreakData | null;
  productivity: ProductivityData | null;
  yearOverYear: YearOverYearData | null;
  superlatives: SuperlativesData | null;
  analytics: AnalyticsResult | null;
  isComputing: boolean;
  error: string | null;
}

/** Return type of useGourcePlayback hook. */
export interface UseGourcePlaybackReturn {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentTime: number;
  totalDuration: number;
  progress: number;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seek: (progress: number) => void;
  currentDate: string;
  state: PlaybackState;
}

/** Return type of useWrappedSlideshow hook. */
export interface UseWrappedSlideshowReturn {
  currentSlide: number;
  totalSlides: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  isAnimating: boolean;
  slideData: WrappedSlide | null;
  direction: 'forward' | 'backward';
  autoAdvance: boolean;
  toggleAutoAdvance: () => void;
}

/** Return type of useStoryGenerator hook. */
export interface UseStoryGeneratorReturn {
  stories: GeneratedStory[];
  unifiedStory: GeneratedStory | null;
  isGenerating: boolean;
  progress: StoryGenerationProgress;
  generateStory: () => Promise<void>;
  regenerate: () => Promise<void>;
  error: string | null;
}

// =============================================================================
// THEME
// =============================================================================

/** Theme configuration with colors, gradients, animations, and typography. */
export interface ThemeConfig {
  colors: ThemeColors;
  gradients: ThemeGradients;
  animations: ThemeAnimations;
  typography: ThemeTypography;
}

/** Theme color palette. */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  success: string;
  danger: string;
  warning: string;
  info: string;
  gource: {
    nodeDefault: string;
    edgeDefault: string;
    beamDefault: string;
    particleDefault: string;
  };
}

/** Theme gradient definitions. */
export interface ThemeGradients {
  primary: string;
  secondary: string;
  wrapped: string;
  hero: string;
  cardGlow: string;
  wrappedSlides: Record<WrappedSlideType, string>;
}

/** Animation tokens (durations and easing functions). */
export interface ThemeAnimations {
  duration: {
    fast: string;
    normal: string;
    slow: string;
    glacial: string;
  };
  easing: {
    default: string;
    bounce: string;
    smooth: string;
    snap: string;
  };
}

/** Typography scale (font families, sizes, weights). */
export interface ThemeTypography {
  fontFamily: {
    body: string;
    heading: string;
    mono: string;
  };
  fontSize: Record<string, string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, string>;
}

// =============================================================================
// CONTENT TYPES
// =============================================================================

/** Landing page content structure. */
export interface LandingContent {
  hero: {
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
  };
  features: FeatureItem[];
  howItWorks: HowItWorksStep[];
  cta: {
    headline: string;
    subheadline: string;
    buttonText: string;
    buttonLink: string;
  };
  socialProof: SocialProofStat[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** 2D coordinate point. */
export interface Point {
  x: number;
  y: number;
}

/** Rectangle bounds. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Quadtree bounding box for spatial indexing. */
export interface QuadTreeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Map of language name to hex color. */
export type LanguageColorMap = Record<string, string>;

// =============================================================================
// CONSTANTS
// =============================================================================

/** GitHub language colors (common languages). */
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

/** File extension to category mapping. */
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

/** Default gource visualization settings. */
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

/** Default camera state. */
export const DEFAULT_CAMERA: GourceCamera = {
  x: 0,
  y: 0,
  zoom: 1,
  targetX: 0,
  targetY: 0,
  targetZoom: 1,
  isUserControlled: false,
} as const;

/** Wrapped slide definitions with layout and animation defaults. */
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

/** File category colors for gource visualization. */
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
