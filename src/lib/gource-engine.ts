import type {
  CommitData,
  GourceNode,
  GourceCommitEvent,
  GourceContributor,
  GourceBeam,
  GourceParticle,
  GourceSettings,
  GourceCamera,
  GourceState,
  GourceFileChange,
  GameLoopState,
  Repository,
  Contributor,
  PlaybackState as PlaybackStateEnum,
  FileCategory,
  Bounds,
  Point,
} from '@/lib/types';

import {
  DEFAULT_GOURCE_SETTINGS,
  DEFAULT_CAMERA,
  FILE_CATEGORY_COLORS,
  FILE_EXTENSION_CATEGORIES,
  GITHUB_LANGUAGE_COLORS,
  PlaybackState,
  PlaybackSpeed,
  FileCategory as FileCategoryEnum,
} from '@/lib/types';

// =============================================================================
// HELPER UTILITIES
// =============================================================================

function hexToRgba(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // Handle hsl/hsla colors — convert to rgba via temp canvas
  if (color.startsWith('hsl')) {
    return hslToRgba(color, alpha);
  }
  // Handle rgb/rgba — inject alpha
  if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
    }
  }
  // Fallback
  return `rgba(128, 128, 128, ${alpha})`;
}

function hexToRgb(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#') && color.length >= 7) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    };
  }
  return { r: 128, g: 128, b: 128 };
}

// Cached canvas for HSL → RGB conversion
let _colorCtx: CanvasRenderingContext2D | null = null;
function hslToRgba(hsl: string, alpha: number): string {
  if (!_colorCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _colorCtx = c.getContext('2d')!;
  }
  _colorCtx.fillStyle = hsl;
  const computed = _colorCtx.fillStyle; // browser normalizes to #rrggbb
  const r = parseInt(computed.slice(1, 3), 16);
  const g = parseInt(computed.slice(3, 5), 16);
  const b = parseInt(computed.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getFileExtension(path: string): string {
  const parts = path.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

function getFileCategory(extension: string): FileCategory {
  return FILE_EXTENSION_CATEGORIES[extension] ?? FileCategoryEnum.OTHER;
}

function getDirectoryPath(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

function dateToString(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toISOString().split('T')[0];
}

function generateColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash % 360);
  const s = 60 + Math.abs((hash >> 8) % 30);
  const l = 55 + Math.abs((hash >> 16) % 20);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// =============================================================================
// LANGUAGE COLOR MAPPING (extension -> language -> GitHub color)
// =============================================================================

/** Map file extensions to their language name for GITHUB_LANGUAGE_COLORS lookup */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  pyw: 'Python',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  c: 'C',
  h: 'C',
  cs: 'C#',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  kts: 'Kotlin',
  dart: 'Dart',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'CSS',
  sass: 'CSS',
  less: 'CSS',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  vue: 'Vue',
  svelte: 'Svelte',
  scala: 'Scala',
  ex: 'Elixir',
  exs: 'Elixir',
  hs: 'Haskell',
  lua: 'Lua',
  r: 'R',
  m: 'MATLAB',
  pl: 'Perl',
  pm: 'Perl',
  zig: 'Zig',
  nim: 'Nim',
  ml: 'OCaml',
  mli: 'OCaml',
  clj: 'Clojure',
  cljs: 'Clojure',
  erl: 'Erlang',
};

/** Get the language color for a file extension, falling back to category color */
function getLanguageColor(extension: string): string | null {
  const language = EXTENSION_TO_LANGUAGE[extension];
  if (language && GITHUB_LANGUAGE_COLORS[language]) {
    return GITHUB_LANGUAGE_COLORS[language];
  }
  return null;
}

// Repo color palette for multi-repo differentiation
const REPO_COLORS = [
  '#60a5fa', '#f97316', '#a78bfa', '#34d399',
  '#fb923c', '#f472b6', '#fbbf24', '#2dd4bf',
  '#818cf8', '#e879f9', '#38bdf8', '#4ade80',
  '#c084fc', '#f43f5e', '#14b8a6', '#eab308',
];

// =============================================================================
// SYNTHETIC FILE GENERATION
// =============================================================================

/** Common directory structures per language */
const LANGUAGE_DIR_TEMPLATES: Record<string, string[][]> = {
  TypeScript: [
    ['src', 'components'], ['src', 'hooks'], ['src', 'lib'], ['src', 'utils'],
    ['src', 'app'], ['src', 'pages'], ['src', 'services'], ['src', 'types'],
    ['src', 'context'], ['src', 'styles'], ['tests'], ['src', 'api'],
  ],
  JavaScript: [
    ['src', 'components'], ['src', 'utils'], ['src', 'helpers'], ['src', 'lib'],
    ['src', 'pages'], ['src', 'services'], ['src', 'store'], ['src', 'hooks'],
    ['public'], ['scripts'], ['tests'], ['src', 'api'],
  ],
  Python: [
    ['src'], ['src', 'models'], ['src', 'views'], ['src', 'utils'],
    ['src', 'services'], ['tests'], ['scripts'], ['src', 'api'],
    ['src', 'core'], ['src', 'db'], ['config'],
  ],
  Go: [
    ['cmd'], ['internal'], ['pkg'], ['internal', 'handlers'],
    ['internal', 'models'], ['internal', 'services'], ['api'],
    ['pkg', 'utils'], ['tests'], ['internal', 'middleware'],
  ],
  Rust: [
    ['src'], ['src', 'models'], ['src', 'handlers'], ['src', 'utils'],
    ['src', 'services'], ['tests'], ['benches'], ['src', 'api'],
  ],
  Java: [
    ['src', 'main', 'java'], ['src', 'main', 'resources'],
    ['src', 'test', 'java'], ['src', 'main', 'java', 'models'],
    ['src', 'main', 'java', 'services'], ['src', 'main', 'java', 'controllers'],
  ],
  Ruby: [
    ['app', 'models'], ['app', 'controllers'], ['app', 'views'],
    ['app', 'helpers'], ['lib'], ['spec'], ['config'], ['db'],
  ],
  default: [
    ['src'], ['src', 'core'], ['src', 'utils'], ['lib'],
    ['tests'], ['config'], ['docs'], ['scripts'],
  ],
};

/** Common file names per language */
const LANGUAGE_FILE_TEMPLATES: Record<string, Array<{ name: string; ext: string }>> = {
  TypeScript: [
    { name: 'index', ext: 'ts' }, { name: 'app', ext: 'tsx' }, { name: 'utils', ext: 'ts' },
    { name: 'types', ext: 'ts' }, { name: 'hooks', ext: 'ts' }, { name: 'config', ext: 'ts' },
    { name: 'api', ext: 'ts' }, { name: 'store', ext: 'ts' }, { name: 'context', ext: 'tsx' },
    { name: 'layout', ext: 'tsx' }, { name: 'page', ext: 'tsx' }, { name: 'route', ext: 'ts' },
    { name: 'middleware', ext: 'ts' }, { name: 'schema', ext: 'ts' }, { name: 'service', ext: 'ts' },
    { name: 'handler', ext: 'ts' }, { name: 'button', ext: 'tsx' }, { name: 'card', ext: 'tsx' },
    { name: 'modal', ext: 'tsx' }, { name: 'header', ext: 'tsx' }, { name: 'sidebar', ext: 'tsx' },
    { name: 'auth', ext: 'ts' }, { name: 'db', ext: 'ts' }, { name: 'constants', ext: 'ts' },
  ],
  JavaScript: [
    { name: 'index', ext: 'js' }, { name: 'app', ext: 'jsx' }, { name: 'utils', ext: 'js' },
    { name: 'config', ext: 'js' }, { name: 'server', ext: 'js' }, { name: 'routes', ext: 'js' },
    { name: 'helpers', ext: 'js' }, { name: 'store', ext: 'js' }, { name: 'api', ext: 'js' },
    { name: 'middleware', ext: 'js' }, { name: 'controller', ext: 'js' }, { name: 'model', ext: 'js' },
    { name: 'component', ext: 'jsx' }, { name: 'service', ext: 'js' }, { name: 'handler', ext: 'js' },
  ],
  Python: [
    { name: '__init__', ext: 'py' }, { name: 'main', ext: 'py' }, { name: 'utils', ext: 'py' },
    { name: 'models', ext: 'py' }, { name: 'views', ext: 'py' }, { name: 'config', ext: 'py' },
    { name: 'settings', ext: 'py' }, { name: 'urls', ext: 'py' }, { name: 'admin', ext: 'py' },
    { name: 'serializers', ext: 'py' }, { name: 'tasks', ext: 'py' }, { name: 'tests', ext: 'py' },
    { name: 'schemas', ext: 'py' }, { name: 'services', ext: 'py' }, { name: 'api', ext: 'py' },
  ],
  Go: [
    { name: 'main', ext: 'go' }, { name: 'handler', ext: 'go' }, { name: 'model', ext: 'go' },
    { name: 'service', ext: 'go' }, { name: 'router', ext: 'go' }, { name: 'middleware', ext: 'go' },
    { name: 'config', ext: 'go' }, { name: 'utils', ext: 'go' }, { name: 'db', ext: 'go' },
    { name: 'types', ext: 'go' }, { name: 'errors', ext: 'go' }, { name: 'server', ext: 'go' },
  ],
  Rust: [
    { name: 'main', ext: 'rs' }, { name: 'lib', ext: 'rs' }, { name: 'mod', ext: 'rs' },
    { name: 'config', ext: 'rs' }, { name: 'utils', ext: 'rs' }, { name: 'error', ext: 'rs' },
    { name: 'handler', ext: 'rs' }, { name: 'model', ext: 'rs' }, { name: 'service', ext: 'rs' },
    { name: 'types', ext: 'rs' }, { name: 'db', ext: 'rs' }, { name: 'api', ext: 'rs' },
  ],
  Java: [
    { name: 'Application', ext: 'java' }, { name: 'Controller', ext: 'java' },
    { name: 'Service', ext: 'java' }, { name: 'Repository', ext: 'java' },
    { name: 'Model', ext: 'java' }, { name: 'Config', ext: 'java' },
    { name: 'Utils', ext: 'java' }, { name: 'Handler', ext: 'java' },
    { name: 'Exception', ext: 'java' }, { name: 'Dto', ext: 'java' },
  ],
  Ruby: [
    { name: 'application', ext: 'rb' }, { name: 'routes', ext: 'rb' },
    { name: 'schema', ext: 'rb' }, { name: 'migration', ext: 'rb' },
    { name: 'model', ext: 'rb' }, { name: 'controller', ext: 'rb' },
    { name: 'helper', ext: 'rb' }, { name: 'config', ext: 'rb' },
    { name: 'spec', ext: 'rb' }, { name: 'service', ext: 'rb' },
  ],
  default: [
    { name: 'index', ext: 'ts' }, { name: 'main', ext: 'ts' }, { name: 'config', ext: 'json' },
    { name: 'utils', ext: 'ts' }, { name: 'helpers', ext: 'ts' }, { name: 'types', ext: 'ts' },
    { name: 'README', ext: 'md' }, { name: 'styles', ext: 'css' }, { name: 'app', ext: 'tsx' },
  ],
};

/** Config / meta files that appear alongside code */
const COMMON_CONFIG_FILES = [
  'package.json', 'tsconfig.json', '.gitignore', 'README.md', '.env',
  'Dockerfile', 'docker-compose.yml', '.eslintrc.js', '.prettierrc',
  'Makefile', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile',
];

/** Deterministic seeded random for consistent file generation per commit */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

/** Infer type of commit from message */
function inferCommitType(message: string): 'add' | 'modify' | 'delete' {
  const lower = message.toLowerCase();
  if (lower.startsWith('remove') || lower.startsWith('delete') || lower.includes('cleanup') || lower.includes('deprecate')) {
    return 'delete';
  }
  if (lower.startsWith('add') || lower.startsWith('create') || lower.startsWith('init') ||
      lower.startsWith('feat') || lower.startsWith('new') || lower.includes('implement') ||
      lower.includes('introduce') || lower.includes('setup') || lower.includes('scaffold')) {
    return 'add';
  }
  return 'modify';
}

/**
 * Generate synthetic file paths for a commit when the API didn't return file details.
 * Uses the commit SHA as seed for deterministic, varied results.
 */
function generateSyntheticFiles(
  commit: CommitData,
  repoLanguage: string | null,
): GourceFileChange[] {
  const rng = seededRandom(commit.sha);
  const lang = repoLanguage || 'default';
  const dirs = LANGUAGE_DIR_TEMPLATES[lang] || LANGUAGE_DIR_TEMPLATES['default'];
  const fileTemplates = LANGUAGE_FILE_TEMPLATES[lang] || LANGUAGE_FILE_TEMPLATES['default'];
  const commitType = inferCommitType(commit.message);

  // Determine how many files to generate
  const fileCount = Math.max(1, Math.min(commit.filesChanged || Math.ceil(rng() * 4 + 1), 12));

  const results: GourceFileChange[] = [];
  const usedPaths = new Set<string>();

  for (let i = 0; i < fileCount; i++) {
    // Pick a directory
    const dirParts = dirs[Math.floor(rng() * dirs.length)];
    const dirPath = dirParts.join('/');

    // Pick a file -- with some variety from commit-specific hashing
    let fileTemplate: { name: string; ext: string };

    // Occasionally generate a config / meta file at root
    if (rng() < 0.1 && i > 0) {
      const configFile = COMMON_CONFIG_FILES[Math.floor(rng() * COMMON_CONFIG_FILES.length)];
      const path = `${commit.repoName}/${configFile}`;
      if (!usedPaths.has(path)) {
        usedPaths.add(path);
        results.push({
          path,
          type: commitType === 'delete' ? 'delete' : 'modify',
          additions: Math.floor(rng() * commit.additions / fileCount) + 1,
          deletions: Math.floor(rng() * commit.deletions / fileCount),
        });
      }
      continue;
    }

    fileTemplate = fileTemplates[Math.floor(rng() * fileTemplates.length)];

    // Add variety: sometimes suffix with a number or word from commit message
    let fileName = fileTemplate.name;
    if (rng() < 0.4) {
      // Extract a word from the commit message to make filenames more unique
      const words = commit.messageHeadline
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && w.length < 20);
      if (words.length > 0) {
        const word = words[Math.floor(rng() * words.length)];
        fileName = word.charAt(0).toLowerCase() + word.slice(1);
      }
    } else if (rng() < 0.3) {
      // Add numeric suffix for variety
      fileName = `${fileName}${Math.floor(rng() * 20) + 1}`;
    }

    const path = `${commit.repoName}/${dirPath}/${fileName}.${fileTemplate.ext}`;

    if (usedPaths.has(path)) continue;
    usedPaths.add(path);

    const addPortion = Math.floor(rng() * Math.max(1, commit.additions) / fileCount) + 1;
    const delPortion = Math.floor(rng() * Math.max(0, commit.deletions) / fileCount);

    results.push({
      path,
      type: commitType,
      additions: addPortion,
      deletions: delPortion,
    });
  }

  // Ensure at least one file
  if (results.length === 0) {
    const dirParts = dirs[0];
    const ft = fileTemplates[0];
    results.push({
      path: `${commit.repoName}/${dirParts.join('/')}/${ft.name}.${ft.ext}`,
      type: commitType,
      additions: Math.max(1, commit.additions),
      deletions: commit.deletions,
    });
  }

  return results;
}

// =============================================================================
// GOURCE ENGINE
// =============================================================================

export interface GourceEngineCallbacks {
  onFrame?: (state: GourceState) => void;
  onDateChange?: (date: string) => void;
  onPlaybackChange?: (state: PlaybackStateEnum) => void;
  onStatsUpdate?: (stats: { fps: number; nodeCount: number; edgeCount: number; beamCount: number }) => void;
}

export interface GourceEngineData {
  commits: CommitData[];
  repositories: Repository[];
  contributors: Contributor[];
}

export class GourceEngine {
  // ---- Data ----
  private commitEvents: GourceCommitEvent[] = [];
  private repositories: Repository[] = [];
  private repoColorMap: Map<string, string> = new Map();

  // ---- Scene Graph ----
  private nodes: Map<string, GourceNode> = new Map();
  private contributors: Map<string, GourceContributor> = new Map();
  private beams: GourceBeam[] = [];
  private particles: GourceParticle[] = [];

  // ---- State ----
  private state: GourceState;
  private settings: GourceSettings;
  private camera: GourceCamera;
  private loopState: GameLoopState;

  // ---- Playback ----
  private currentEventIndex: number = 0;
  private simulationTime: number = 0;
  private startTime: number = 0;
  private endTime: number = 0;
  private autoSpeedFactor: number = 1;

  // ---- Rendering ----
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private pixelRatio: number = 1;
  private animationFrameId: number | null = null;

  // ---- Callbacks ----
  private callbacks: GourceEngineCallbacks = {};

  // ---- Avatar Cache ----
  private avatarImages: Map<string, HTMLImageElement> = new Map();
  private avatarLoadingSet: Set<string> = new Set();

  // ---- Performance ----
  private frameTimestamps: number[] = [];
  private lastStatsUpdate: number = 0;

  // ---- Layout Scheduling ----
  private layoutDirty: boolean = true;
  private lastLayoutRecompute: number = 0;

  // ---- Repo Language Map (for synthetic file generation) ----
  private repoLanguageMap: Map<string, string | null> = new Map();

  constructor(data: GourceEngineData) {
    this.settings = { ...DEFAULT_GOURCE_SETTINGS };
    this.camera = { ...DEFAULT_CAMERA };

    this.loopState = {
      isRunning: false,
      frameCount: 0,
      lastFrameTime: 0,
      deltaTime: 0,
      fps: 60,
      targetFps: 60,
      accumulator: 0,
      fixedTimestep: 1000 / 60,
    };

    // Process commit data into gource events
    this.repositories = data.repositories;
    this.setupRepoColors();
    this.processCommitData(data.commits, data.contributors);

    // Compute time range
    if (this.commitEvents.length > 0) {
      this.startTime = this.commitEvents[0].timestamp;
      this.endTime = this.commitEvents[this.commitEvents.length - 1].timestamp;
    } else {
      const now = Date.now();
      this.startTime = now - 86400000;
      this.endTime = now;
    }

    this.simulationTime = this.startTime;

    // Adaptive speed: target full playback in ~120 seconds at 1x speed
    const totalDuration = this.endTime - this.startTime;
    const targetPlaybackSeconds = 120;
    this.autoSpeedFactor = Math.max(1, totalDuration / (targetPlaybackSeconds * 1000));

    this.state = {
      playback: PlaybackState.STOPPED,
      speed: PlaybackSpeed.NORMAL,
      currentTime: this.startTime,
      currentDate: dateToString(this.startTime),
      startTime: this.startTime,
      endTime: this.endTime,
      totalDuration: this.endTime - this.startTime,
      progress: 0,
      activeRepoId: null,
      isCombinedView: true,
      camera: this.camera,
      settings: this.settings,
    };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  private setupRepoColors(): void {
    this.repositories.forEach((repo, index) => {
      this.repoColorMap.set(repo.fullName, REPO_COLORS[index % REPO_COLORS.length]);
      this.repoLanguageMap.set(repo.fullName, repo.language);
    });
  }

  private processCommitData(commits: CommitData[], contributorData: Contributor[]): void {
    // Setup contributor map from provided data
    for (const contributor of contributorData) {
      this.contributors.set(contributor.id, {
        id: contributor.id,
        name: contributor.name,
        avatarUrl: contributor.avatarUrl,
        avatarImage: null,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        color: contributor.color || generateColor(contributor.id),
        opacity: 0,
        lastActiveTime: 0,
        isVisible: false,
      });
    }

    // Sort commits by timestamp
    const sortedCommits = [...commits].sort((a, b) => a.timestampMs - b.timestampMs);

    // Convert to GourceCommitEvents
    this.commitEvents = sortedCommits.map((commit) => {
      const contributorId = commit.author.login || commit.author.email || commit.author.name;

      // Ensure contributor exists
      if (!this.contributors.has(contributorId)) {
        this.contributors.set(contributorId, {
          id: contributorId,
          name: commit.author.name,
          avatarUrl: commit.author.avatarUrl,
          avatarImage: null,
          x: 0,
          y: 0,
          targetX: 0,
          targetY: 0,
          color: generateColor(contributorId),
          opacity: 0,
          lastActiveTime: 0,
          isVisible: false,
        });
      }

      let affectedFiles: GourceFileChange[];

      if (commit.files.length > 0) {
        // Real file data from API
        affectedFiles = commit.files.map((f) => ({
          path: `${commit.repoName}/${f.path}`,
          type: f.status === 'added' ? 'add' as const : f.status === 'removed' ? 'delete' as const : f.status === 'renamed' ? 'rename' as const : 'modify' as const,
          additions: f.additions,
          deletions: f.deletions,
        }));
      } else {
        // No file data from API — synthesize realistic file paths
        const repoLanguage = this.repoLanguageMap.get(commit.repoId) || null;
        affectedFiles = generateSyntheticFiles(commit, repoLanguage);
      }

      return {
        sha: commit.sha,
        timestamp: commit.timestampMs,
        contributorId,
        contributorName: commit.author.name,
        contributorAvatarUrl: commit.author.avatarUrl,
        repoId: commit.repoId,
        affectedFiles,
        processed: false,
      };
    });
  }

  public initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pixelRatio = window.devicePixelRatio || 1;
    this.resize(canvas.clientWidth, canvas.clientHeight);

    // Create root nodes for each repository
    const repoCount = this.repositories.length;
    for (let i = 0; i < repoCount; i++) {
      const repo = this.repositories[i];
      // Spread root nodes around center for multi-repo
      const baseAngle = repoCount > 1
        ? (i / repoCount) * Math.PI * 2 - Math.PI / 2
        : 0;
      const baseRadius = repoCount > 1 ? 150 : 0;
      const node = this.createNode(repo.fullName, repo.name, null, true, repo.fullName);
      node.x = Math.cos(baseAngle) * baseRadius;
      node.y = Math.sin(baseAngle) * baseRadius;
      node.targetX = node.x;
      node.targetY = node.y;
      node.opacity = 1;
      node.scale = 1;
      node.angle = baseAngle;
    }

    // Pre-load contributor avatars
    this.contributors.forEach((contributor) => {
      if (contributor.avatarUrl) {
        this.loadAvatar(contributor.id, contributor.avatarUrl);
      }
    });
  }

  public resize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  // ===========================================================================
  // AVATAR LOADING
  // ===========================================================================

  private loadAvatar(id: string, url: string): void {
    if (this.avatarImages.has(id) || this.avatarLoadingSet.has(id)) return;
    this.avatarLoadingSet.add(id);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.avatarImages.set(id, img);
      this.avatarLoadingSet.delete(id);
      const contributor = this.contributors.get(id);
      if (contributor) {
        contributor.avatarImage = img;
      }
    };
    img.onerror = () => {
      this.avatarLoadingSet.delete(id);
    };
    img.src = url + '&s=48';
  }

  // ===========================================================================
  // NODE MANAGEMENT
  // ===========================================================================

  private createNode(
    path: string,
    name: string,
    parentId: string | null,
    isDirectory: boolean,
    repoId: string,
  ): GourceNode {
    if (this.nodes.has(path)) {
      return this.nodes.get(path)!;
    }

    const extension = isDirectory ? '' : getFileExtension(path);
    const category = isDirectory ? FileCategoryEnum.OTHER : getFileCategory(extension);

    // Color assignment: use language-specific colors for files, muted repo colors for directories
    let nodeColor: string;
    if (isDirectory) {
      const repoColor = this.repoColorMap.get(repoId) || '#60a5fa';
      // Muted/darker version for directories
      const rgb = hexToRgb(repoColor);
      nodeColor = `rgb(${Math.round(rgb.r * 0.5)}, ${Math.round(rgb.g * 0.5)}, ${Math.round(rgb.b * 0.5)})`;
    } else {
      // Try language color first, then user overrides, then category, then fallback
      nodeColor = this.settings.extensionColors[extension]
        || getLanguageColor(extension)
        || FILE_CATEGORY_COLORS[category]
        || '#94a3b8';
    }

    // Calculate initial position using radial tree layout
    const parentNode = parentId ? this.nodes.get(parentId) : null;
    const depth = parentNode ? parentNode.depth + 1 : 0;

    // Spread children around parent using golden angle for better distribution
    const siblingCount = parentNode ? parentNode.children.length : 0;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399 radians
    const baseAngle = parentNode ? parentNode.angle : 0;
    const childAngle = baseAngle + goldenAngle * (siblingCount + 1) + (Math.random() - 0.5) * 0.3;

    // Radius grows with depth but shrinks per child density
    const branchLength = isDirectory
      ? 60 + Math.max(0, 30 - depth * 5)
      : 35 + Math.random() * 20;

    const baseX = parentNode ? parentNode.x : 0;
    const baseY = parentNode ? parentNode.y : 0;

    const x = baseX + Math.cos(childAngle) * branchLength;
    const y = baseY + Math.sin(childAngle) * branchLength;

    const node: GourceNode = {
      id: path,
      name,
      path,
      parentId,
      isDirectory,
      children: [],
      extension,
      category,
      repoId,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      color: nodeColor,
      opacity: 0,
      scale: 0,
      lastModified: 0,
      modificationCount: 0,
      isVisible: true,
      depth,
      angle: childAngle,
      radius: branchLength,
    };

    this.nodes.set(path, node);

    if (parentNode) {
      parentNode.children.push(path);
    }

    this.layoutDirty = true;

    return node;
  }

  private ensureDirectoryChain(filePath: string, repoId: string): void {
    const parts = filePath.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const parentPath = currentPath || null;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      if (!this.nodes.has(currentPath)) {
        const dirNode = this.createNode(currentPath, parts[i], parentPath, true, repoId);
        // Directories appear immediately
        dirNode.opacity = 0.8;
        dirNode.scale = 1;
      }
    }
  }

  private addOrUpdateFile(filePath: string, repoId: string, timestamp: number, changeType: 'add' | 'modify' | 'delete' | 'rename'): GourceNode {
    this.ensureDirectoryChain(filePath, repoId);

    const dirPath = getDirectoryPath(filePath);
    const fileName = getFileName(filePath);
    const parentId = dirPath === '' ? null : dirPath;

    let node = this.nodes.get(filePath);
    const isNew = !node;

    if (!node) {
      node = this.createNode(filePath, fileName, parentId, false, repoId);
    }

    node.lastModified = timestamp;
    node.modificationCount++;
    node.isVisible = true;

    if (isNew || changeType === 'add') {
      // NEW FILE: explosive pop-in — scale from 0 to 1.5, then settles to 1.0
      node.opacity = 1;
      node.scale = 0.01; // Start tiny, will animate up in updateLayout
      // Mark it for the pop-in animation
      (node as GourceNode & { _popIn?: number })._popIn = 1.5;
    } else {
      // EXISTING FILE MODIFIED: pulse glow
      node.opacity = 1;
      node.scale = Math.min(node.scale + 0.6, 2.5);
    }

    return node;
  }

  private removeFile(filePath: string): void {
    const node = this.nodes.get(filePath);
    if (!node) return;

    // Animate shrink and fade out (not immediate)
    // Mark node for deletion animation
    (node as GourceNode & { _deleting?: boolean })._deleting = true;
    node.scale = 0.8; // Start shrinking

    // Create a few farewell particles
    if (this.settings.showParticles) {
      const count = 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        const ttl = 20 + Math.floor(Math.random() * 20);
        this.particles.push({
          x: node.x,
          y: node.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: node.color,
          size: 1 + Math.random() * 1.5,
          opacity: 0.6,
          ttl,
          maxTtl: ttl,
        });
      }
    }

    // Remove from parent
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((id) => id !== filePath);
      }
    }

    // Schedule removal after fade animation
    setTimeout(() => {
      this.nodes.delete(filePath);
    }, 1500);
  }

  // ===========================================================================
  // COMMIT PROCESSING
  // ===========================================================================

  private processCommitEvent(event: GourceCommitEvent): void {
    if (event.processed) return;
    event.processed = true;

    // Filter by active repo if not combined view
    if (this.state.activeRepoId && event.repoId !== this.state.activeRepoId) return;

    // Filter by contributor
    if (this.settings.contributorFilter && !this.settings.contributorFilter.includes(event.contributorId)) return;

    // Update contributor position
    const contributor = this.contributors.get(event.contributorId);
    if (contributor) {
      contributor.isVisible = true;
      contributor.opacity = 1;
      contributor.lastActiveTime = this.simulationTime;
    }

    // Process each file change — individual file nodes light up
    for (const fileChange of event.affectedFiles) {
      if (fileChange.type === 'delete') {
        this.removeFile(fileChange.path);
        continue;
      }

      const isNewFile = !this.nodes.has(fileChange.path) || fileChange.type === 'add';
      const node = this.addOrUpdateFile(fileChange.path, event.repoId, event.timestamp, fileChange.type);

      // Create beam from contributor to the individual FILE node (not directory)
      if (contributor && this.settings.showCommitBeams) {
        this.createBeam(contributor, node);
      }

      // Create particles at the file — more explosive for new files
      if (this.settings.showParticles) {
        this.createParticles(node, contributor?.color || node.color, isNewFile);
      }
    }

    // Move contributor toward affected files (centroid)
    if (contributor && event.affectedFiles.length > 0) {
      let cx = 0, cy = 0, count = 0;
      for (const f of event.affectedFiles) {
        const targetNode = this.nodes.get(f.path);
        if (targetNode) {
          cx += targetNode.x;
          cy += targetNode.y;
          count++;
        }
      }
      if (count > 0) {
        contributor.targetX = cx / count + (Math.random() - 0.5) * 60;
        contributor.targetY = cy / count + (Math.random() - 0.5) * 60;
      }
    }
  }

  // ===========================================================================
  // EFFECTS (BEAMS & PARTICLES)
  // ===========================================================================

  private createBeam(contributor: GourceContributor, node: GourceNode): void {
    this.beams.push({
      fromX: contributor.x,
      fromY: contributor.y,
      toX: node.x,
      toY: node.y,
      color: contributor.color,
      progress: 0,
      opacity: 1.0,
      ttl: 50,
    });
  }

  private createParticles(node: GourceNode, color: string, isNewFile: boolean = false): void {
    // More particles and faster for new files (explosion effect)
    const count = isNewFile
      ? 8 + Math.floor(Math.random() * 8)
      : 4 + Math.floor(Math.random() * 5);
    const speedMultiplier = isNewFile ? 1.8 : 1.0;
    const sizeMultiplier = isNewFile ? 1.4 : 1.0;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 2.5) * speedMultiplier;
      const ttl = isNewFile
        ? 35 + Math.floor(Math.random() * 45)
        : 25 + Math.floor(Math.random() * 35);
      this.particles.push({
        x: node.x,
        y: node.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: (1.2 + Math.random() * 2.5) * sizeMultiplier,
        opacity: 1,
        ttl,
        maxTtl: ttl,
      });
    }
  }

  // ===========================================================================
  // PHYSICS / LAYOUT UPDATE
  // ===========================================================================

  private updateLayout(dt: number): void {
    const dtSeconds = dt / 1000;
    const damping = 0.88;
    const springStiffness = this.settings.springStiffness;
    const repulsion = this.settings.repulsionForce;

    // Process nodes physics
    const nodeArray = Array.from(this.nodes.values());
    const visibleNodes = nodeArray.filter((n) => n.isVisible && n.opacity > 0.01);

    // Use grid-based spatial hashing for O(n) repulsion instead of O(n^2)
    const gridSize = 80;
    const grid: Map<string, GourceNode[]> = new Map();

    for (const node of visibleNodes) {
      const gx = Math.floor(node.x / gridSize);
      const gy = Math.floor(node.y / gridSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(node);
    }

    // Apply repulsion only between nodes in adjacent grid cells
    for (const node of visibleNodes) {
      const gx = Math.floor(node.x / gridSize);
      const gy = Math.floor(node.y / gridSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const cellNodes = grid.get(key);
          if (!cellNodes) continue;

          for (const other of cellNodes) {
            if (other.id <= node.id) continue; // avoid double processing

            const ddx = other.x - node.x;
            const ddy = other.y - node.y;
            const distSq = ddx * ddx + ddy * ddy;

            if (distSq < 0.01 || distSq > gridSize * gridSize * 4) continue;

            const dist = Math.sqrt(distSq);
            // Stronger repulsion for nearby nodes, especially at same depth
            const depthBoost = node.depth === other.depth ? 1.5 : 1.0;
            const force = (repulsion * depthBoost) / distSq;
            const fx = (ddx / dist) * force;
            const fy = (ddy / dist) * force;

            node.vx -= fx * dtSeconds;
            node.vy -= fy * dtSeconds;
            other.vx += fx * dtSeconds;
            other.vy += fy * dtSeconds;
          }
        }
      }
    }

    // Apply spring forces toward parent + angular spreading
    for (const node of visibleNodes) {
      if (node.parentId) {
        const parent = this.nodes.get(node.parentId);
        if (parent) {
          const dx = parent.x - node.x;
          const dy = parent.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Target distance depends on whether it's a directory or file
          const targetDist = node.isDirectory
            ? 50 + Math.max(0, 20 - node.depth * 3)
            : 30 + Math.max(0, 15 - node.depth * 2);

          if (dist > 0.01) {
            const springForce = (dist - targetDist) * springStiffness * 1.5;
            node.vx += (dx / dist) * springForce * dtSeconds;
            node.vy += (dy / dist) * springForce * dtSeconds;
          }

          // Angular spreading force: push siblings apart
          if (parent.children.length > 1) {
            const siblingIdx = parent.children.indexOf(node.id);
            const angleSlice = (Math.PI * 2) / parent.children.length;
            const targetAngle = parent.angle + angleSlice * siblingIdx;
            const currentAngle = Math.atan2(node.y - parent.y, node.x - parent.x);
            let angleDiff = targetAngle - currentAngle;
            // Normalize to [-PI, PI]
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            const angularForce = angleDiff * 0.3 * dtSeconds;
            const perpX = -Math.sin(currentAngle) * angularForce * dist * 0.02;
            const perpY = Math.cos(currentAngle) * angularForce * dist * 0.02;
            node.vx += perpX;
            node.vy += perpY;
          }
        }
      } else {
        // Root nodes: very gentle center attraction
        const dx = -node.x;
        const dy = -node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 200) {
          node.vx += (dx / dist) * 0.05 * dtSeconds;
          node.vy += (dy / dist) * 0.05 * dtSeconds;
        }
      }

      // Apply velocity with damping
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= damping;
      node.vy *= damping;

      // Deletion animation: shrink and fade out
      const nodeDel = node as GourceNode & { _deleting?: boolean };
      if (nodeDel._deleting) {
        node.scale = lerp(node.scale, 0, 0.06);
        node.opacity = lerp(node.opacity, 0, 0.04);
        continue; // Skip other scale/opacity logic for deleting nodes
      }

      // Pop-in animation: scale from tiny -> overshoot -> settle to 1.0
      const nodeAny = node as GourceNode & { _popIn?: number };
      if (nodeAny._popIn !== undefined && nodeAny._popIn > 0) {
        // Rapidly scale up with overshoot
        const target = nodeAny._popIn;
        node.scale = lerp(node.scale, target, 0.15);
        if (node.scale >= target * 0.95) {
          // Switch to settling phase
          nodeAny._popIn = 0;
        }
      } else if (nodeAny._popIn === 0) {
        // Settling from overshoot back to 1.0
        node.scale = lerp(node.scale, 1, 0.08);
        if (Math.abs(node.scale - 1) < 0.02) {
          node.scale = 1;
          delete nodeAny._popIn;
        }
      } else if (node.scale > 1) {
        // Normal pulse decay (from modifications)
        node.scale = lerp(node.scale, 1, 0.05);
        if (node.scale < 1.01) node.scale = 1;
      }

      // Fade out nodes that haven't been modified recently
      if (!node.isDirectory) {
        const timeSinceModified = this.simulationTime - node.lastModified;
        if (node.lastModified > 0 && timeSinceModified > this.settings.nodeFadeTime) {
          const fadeFactor = (timeSinceModified - this.settings.nodeFadeTime) / (this.settings.nodeFadeTime * 1.5);
          node.opacity = Math.max(0.15, 1 - fadeFactor * 0.6);
        }
      } else {
        // Directories stay visible as long as they have visible children
        const hasVisibleChild = node.children.some((childId) => {
          const child = this.nodes.get(childId);
          return child && child.opacity > 0.1;
        });
        if (hasVisibleChild) {
          node.opacity = Math.min(1, node.opacity + 0.02);
        } else if (node.children.length === 0) {
          node.opacity = Math.max(0, node.opacity - 0.01);
        }
      }
    }

    // Update contributors
    this.contributors.forEach((contributor) => {
      if (!contributor.isVisible) return;

      // Move toward target
      contributor.x = lerp(contributor.x, contributor.targetX, 0.04);
      contributor.y = lerp(contributor.y, contributor.targetY, 0.04);

      // Fade out inactive contributors
      const timeSinceActive = this.simulationTime - contributor.lastActiveTime;
      if (timeSinceActive > 5000) {
        contributor.opacity = Math.max(0, contributor.opacity - 0.004);
        if (contributor.opacity <= 0) {
          contributor.isVisible = false;
        }
      }
    });

    // Update beams
    this.beams = this.beams.filter((beam) => {
      beam.progress += 0.05;
      beam.ttl--;
      beam.opacity = Math.max(0, beam.opacity - 0.018);
      return beam.ttl > 0 && beam.opacity > 0.01;
    });

    // Update particles
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.ttl--;
      particle.opacity = (particle.ttl / particle.maxTtl) * 0.8;
      particle.size *= 0.995;
      return particle.ttl > 0;
    });
  }

  // ===========================================================================
  // CAMERA
  // ===========================================================================

  private updateCamera(): void {
    const smoothing = 0.04;
    this.camera.x = lerp(this.camera.x, this.camera.targetX, smoothing);
    this.camera.y = lerp(this.camera.y, this.camera.targetY, smoothing);
    this.camera.zoom = lerp(this.camera.zoom, this.camera.targetZoom, smoothing);

    // Auto-follow: center camera on the centroid of recently-modified nodes
    if (!this.camera.isUserControlled) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let totalWeight = 0;

      this.nodes.forEach((node) => {
        if (node.opacity > 0.3 && !node.isDirectory) {
          const recency = this.simulationTime - node.lastModified;
          if (recency < 15000) {
            const weight = Math.max(0.1, 1 - recency / 15000);
            sumX += node.x * weight;
            sumY += node.y * weight;
            totalWeight += weight;
            count++;
          }
        }
      });

      if (count > 0 && totalWeight > 0) {
        this.camera.targetX = sumX / totalWeight;
        this.camera.targetY = sumY / totalWeight;

        // Auto-zoom: zoom out more when tree is large
        const nodeCount = this.nodes.size;
        if (nodeCount > 500) {
          this.camera.targetZoom = Math.max(0.4, 1 - (nodeCount - 500) / 5000);
        } else {
          this.camera.targetZoom = 1;
        }
      }
    }
  }

  public panCamera(dx: number, dy: number): void {
    this.camera.isUserControlled = true;
    this.camera.targetX -= dx / this.camera.zoom;
    this.camera.targetY -= dy / this.camera.zoom;
  }

  public zoomCamera(delta: number, centerX?: number, centerY?: number): void {
    const oldZoom = this.camera.targetZoom;
    this.camera.targetZoom = clamp(this.camera.targetZoom * (1 - delta * 0.001), 0.1, 10);

    if (centerX !== undefined && centerY !== undefined) {
      const worldX = (centerX - this.width / 2) / oldZoom + this.camera.x;
      const worldY = (centerY - this.height / 2) / oldZoom + this.camera.y;
      this.camera.targetX = worldX - (centerX - this.width / 2) / this.camera.targetZoom;
      this.camera.targetY = worldY - (centerY - this.height / 2) / this.camera.targetZoom;
    }

    this.camera.isUserControlled = true;
  }

  public resetCamera(): void {
    this.camera.isUserControlled = false;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.camera.targetZoom = 1;
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  private render(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear with background
    ctx.fillStyle = this.settings.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Render subtle background grid/stars
    this.renderBackground(ctx, w, h);

    // Apply camera transform
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Compute viewport bounds for culling
    const viewport: Bounds = {
      x: this.camera.x - (w / 2) / this.camera.zoom,
      y: this.camera.y - (h / 2) / this.camera.zoom,
      width: w / this.camera.zoom,
      height: h / this.camera.zoom,
    };

    // LOD threshold
    const showDetails = this.camera.zoom > 0.3;
    const showFileLabels = this.camera.zoom > 1.2;

    // 1. Render edges (tree branches)
    this.renderEdges(ctx, viewport);

    // 2. Render beams
    this.renderBeams(ctx);

    // 3. Render particles
    if (this.settings.showParticles) {
      this.renderParticles(ctx);
    }

    // 4. Render nodes (directories then files for z-order)
    this.renderNodes(ctx, viewport, showDetails, showFileLabels);

    // 5. Render contributors
    if (this.settings.showAvatars) {
      this.renderContributors(ctx, viewport);
    }

    // 6. Render labels
    if (this.settings.showLabels && showDetails) {
      this.renderLabels(ctx, viewport, showFileLabels);
    }

    ctx.restore();

    // Render UI overlays (screen space)
    this.renderDateOverlay(ctx, w, h);
    this.renderLegendOverlay(ctx, w, h);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Subtle vignette effect
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines (fixed in screen space, very dim)
    const gridAlpha = 0.03;
    ctx.strokeStyle = `rgba(255, 255, 255, ${gridAlpha})`;
    ctx.lineWidth = 0.5;

    const gridSpacing = 100;
    // Offset by camera to create parallax effect
    const offsetX = (this.camera.x * 0.1) % gridSpacing;
    const offsetY = (this.camera.y * 0.1) % gridSpacing;

    for (let x = -offsetX; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = -offsetY; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private isInViewport(x: number, y: number, viewport: Bounds, margin: number = 50): boolean {
    return (
      x >= viewport.x - margin &&
      x <= viewport.x + viewport.width + margin &&
      y >= viewport.y - margin &&
      y <= viewport.y + viewport.height + margin
    );
  }

  private renderEdges(ctx: CanvasRenderingContext2D, viewport: Bounds): void {
    // Draw tree branches as smooth curves with gradient opacity
    this.nodes.forEach((node) => {
      if (!node.parentId || node.opacity < 0.05) return;
      const parent = this.nodes.get(node.parentId);
      if (!parent || parent.opacity < 0.05) return;

      // Cull off-screen edges
      if (!this.isInViewport(node.x, node.y, viewport, 100) &&
          !this.isInViewport(parent.x, parent.y, viewport, 100)) return;

      const alpha = Math.min(node.opacity, parent.opacity) * 0.35;
      const thickness = node.isDirectory
        ? this.settings.edgeThickness * 1.5
        : this.settings.edgeThickness;

      ctx.lineWidth = thickness;

      // Use parent's color for the branch (faded)
      const branchColor = node.isDirectory ? parent.color : node.color;
      ctx.strokeStyle = hexToRgba(branchColor, alpha);

      ctx.beginPath();

      // Organic bezier curve for natural tree branching
      const dx = node.x - parent.x;
      const dy = node.y - parent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(0.3, 15 / dist);

      const midX = (parent.x + node.x) / 2;
      const midY = (parent.y + node.y) / 2;
      const ctrlX = midX + dy * curvature;
      const ctrlY = midY - dx * curvature;

      ctx.moveTo(parent.x, parent.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, node.x, node.y);
      ctx.stroke();
    });
  }

  private renderNodes(ctx: CanvasRenderingContext2D, viewport: Bounds, showDetails: boolean, showFileLabels: boolean): void {
    let visibleCount = 0;

    // Render directories first (underneath files)
    this.nodes.forEach((node) => {
      if (!node.isDirectory) return;
      if (node.opacity < 0.05) return;
      if (!this.isInViewport(node.x, node.y, viewport)) return;
      if (visibleCount >= this.settings.maxVisibleNodes) return;
      visibleCount++;

      this.renderDirectoryNode(ctx, node, showDetails);
    });

    // Then render file nodes on top
    this.nodes.forEach((node) => {
      if (node.isDirectory) return;
      if (node.opacity < 0.05) return;
      if (!this.isInViewport(node.x, node.y, viewport)) return;
      if (visibleCount >= this.settings.maxVisibleNodes) return;
      visibleCount++;

      this.renderFileNode(ctx, node, showDetails);
    });
  }

  private renderDirectoryNode(ctx: CanvasRenderingContext2D, node: GourceNode, showDetails: boolean): void {
    const size = this.settings.nodeSize * 1.2;
    const alpha = node.opacity * 0.6;

    // Directory: small circle with dim halo
    if (this.settings.showGlowEffects && node.children.length > 0) {
      const haloSize = size * 3;
      const gradient = ctx.createRadialGradient(node.x, node.y, size * 0.5, node.x, node.y, haloSize);
      gradient.addColorStop(0, hexToRgba(node.color, alpha * 0.15));
      gradient.addColorStop(1, hexToRgba(node.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, haloSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Directory dot
    ctx.fillStyle = hexToRgba(node.color, alpha);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Thin ring
    ctx.strokeStyle = hexToRgba(node.color, alpha * 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderFileNode(ctx: CanvasRenderingContext2D, node: GourceNode, showDetails: boolean): void {
    // File node size scales with modification count (log scale) — more prominent than dirs
    const baseSize = this.settings.nodeSize * 1.1;
    const modScale = 1 + Math.log2(1 + node.modificationCount) * 0.25;
    const displayScale = Math.max(node.scale, 0.01); // Ensure we render even during pop-in
    const size = baseSize * modScale * displayScale;

    const isRecentlyModified = this.simulationTime - node.lastModified < 3000;
    const isPopping = displayScale > 1.1 || displayScale < 0.5;

    // Strong glow effect for recently modified / popping files
    if (this.settings.showGlowEffects && (node.scale > 1.05 || isRecentlyModified)) {
      const glowSize = size * (isPopping ? 5 : 3.5);
      const glowIntensity = isPopping
        ? Math.min(1, Math.abs(node.scale - 1) * 0.8 + 0.3)
        : (isRecentlyModified ? 0.35 : 0.15);
      const gradient = ctx.createRadialGradient(node.x, node.y, size * 0.2, node.x, node.y, glowSize);
      gradient.addColorStop(0, hexToRgba(node.color, glowIntensity * node.opacity));
      gradient.addColorStop(0.4, hexToRgba(node.color, glowIntensity * node.opacity * 0.4));
      gradient.addColorStop(1, hexToRgba(node.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle ambient glow for all visible files — makes the tree feel alive
    if (this.settings.showGlowEffects && node.opacity > 0.2) {
      const ambientSize = size * 2.5;
      const ambientIntensity = isRecentlyModified ? 0.18 : 0.08;
      const gradient = ctx.createRadialGradient(node.x, node.y, size * 0.3, node.x, node.y, ambientSize);
      gradient.addColorStop(0, hexToRgba(node.color, ambientIntensity * node.opacity));
      gradient.addColorStop(1, hexToRgba(node.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ambientSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // File circle — bright, saturated, prominent
    const fileAlpha = Math.min(1, node.opacity * (isRecentlyModified ? 1.0 : 0.85));
    ctx.fillStyle = hexToRgba(node.color, fileAlpha);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Bright white inner highlight (specular)
    if (node.opacity > 0.3) {
      const highlightAlpha = isRecentlyModified ? 0.3 : 0.15;
      ctx.fillStyle = hexToRgba('#ffffff', node.opacity * highlightAlpha);
      ctx.beginPath();
      ctx.arc(node.x - size * 0.1, node.y - size * 0.12, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Modification pulse rings — expanding outward
    if (node.scale > 1.05) {
      const ringRadius = size * 0.8;
      const ringAlpha = Math.min(0.8, (node.scale - 1) * node.opacity * 0.7);

      // Inner ring
      ctx.strokeStyle = hexToRgba(node.color, ringAlpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Second expanding ring
      if (node.scale > 1.15) {
        ctx.strokeStyle = hexToRgba(node.color, ringAlpha * 0.4);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Third ring for big pops
      if (node.scale > 1.3) {
        ctx.strokeStyle = hexToRgba(node.color, ringAlpha * 0.15);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private renderBeams(ctx: CanvasRenderingContext2D): void {
    for (const beam of this.beams) {
      const prog = clamp(beam.progress, 0, 1);

      // Bezier curve for more organic beam path
      const dx = beam.toX - beam.fromX;
      const dy = beam.toY - beam.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (beam.fromX + beam.toX) / 2;
      const midY = (beam.fromY + beam.toY) / 2;
      const curvature = Math.min(30, dist * 0.15);
      const ctrlX = midX + (dy / dist) * curvature;
      const ctrlY = midY - (dx / dist) * curvature;

      // Draw the trail (fading gradient line)
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(beam.color, beam.opacity * 0.4);
      ctx.beginPath();

      // Draw bezier from start to current progress point
      const steps = 20;
      const startStep = Math.max(0, Math.floor((prog - 0.3) * steps));
      const endStep = Math.floor(prog * steps);

      for (let s = startStep; s <= endStep; s++) {
        const t = s / steps;
        // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const omt = 1 - t;
        const bx = omt * omt * beam.fromX + 2 * omt * t * ctrlX + t * t * beam.toX;
        const by = omt * omt * beam.fromY + 2 * omt * t * ctrlY + t * t * beam.toY;

        if (s === startStep) {
          ctx.moveTo(bx, by);
        } else {
          ctx.lineTo(bx, by);
        }
      }
      ctx.stroke();

      // Beam head particle
      const headT = prog;
      const omtHead = 1 - headT;
      const headX = omtHead * omtHead * beam.fromX + 2 * omtHead * headT * ctrlX + headT * headT * beam.toX;
      const headY = omtHead * omtHead * beam.fromY + 2 * omtHead * headT * ctrlY + headT * headT * beam.toY;

      // Head glow
      if (this.settings.showGlowEffects && beam.opacity > 0.1) {
        const glowSize = 10;
        const gradient = ctx.createRadialGradient(headX, headY, 0, headX, headY, glowSize);
        gradient.addColorStop(0, hexToRgba(beam.color, beam.opacity * 0.6));
        gradient.addColorStop(0.5, hexToRgba(beam.color, beam.opacity * 0.15));
        gradient.addColorStop(1, hexToRgba(beam.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(headX, headY, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright head dot
      ctx.fillStyle = hexToRgba(beam.color, beam.opacity * 0.8);
      ctx.beginPath();
      ctx.arc(headX, headY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      if (particle.opacity < 0.02) continue;

      // Soft glow particle
      if (particle.size > 1.5 && this.settings.showGlowEffects) {
        const glowSize = particle.size * 3;
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowSize,
        );
        gradient.addColorStop(0, hexToRgba(particle.color, particle.opacity * 0.5));
        gradient.addColorStop(1, hexToRgba(particle.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = hexToRgba(particle.color, particle.opacity * 0.8);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderContributors(ctx: CanvasRenderingContext2D, viewport: Bounds): void {
    this.contributors.forEach((contributor) => {
      if (!contributor.isVisible || contributor.opacity < 0.05) return;
      if (!this.isInViewport(contributor.x, contributor.y, viewport, 40)) return;

      const avatarSize = 24;
      const halfSize = avatarSize / 2;

      // Glow around contributor
      if (this.settings.showGlowEffects) {
        const gradient = ctx.createRadialGradient(
          contributor.x, contributor.y, halfSize,
          contributor.x, contributor.y, halfSize * 3,
        );
        gradient.addColorStop(0, hexToRgba(contributor.color, 0.15 * contributor.opacity));
        gradient.addColorStop(1, hexToRgba(contributor.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Avatar image or colored circle
      if (contributor.avatarImage) {
        ctx.save();
        ctx.globalAlpha = contributor.opacity;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          contributor.avatarImage,
          contributor.x - halfSize,
          contributor.y - halfSize,
          avatarSize,
          avatarSize,
        );
        ctx.restore();

        // Colored border ring
        ctx.strokeStyle = hexToRgba(contributor.color, contributor.opacity * 0.9);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Fallback colored circle with initials
        ctx.fillStyle = hexToRgba(contributor.color, contributor.opacity * 0.9);
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize, 0, Math.PI * 2);
        ctx.fill();

        // Initials
        const initials = contributor.name.charAt(0).toUpperCase();
        ctx.fillStyle = `rgba(255,255,255,${contributor.opacity * 0.9})`;
        ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, contributor.x, contributor.y);
      }

      // Name label below avatar
      if (this.camera.zoom > 0.4) {
        ctx.fillStyle = `rgba(255,255,255,${contributor.opacity * 0.75})`;
        ctx.font = '10px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Background pill for name
        const nameWidth = ctx.measureText(contributor.name).width;
        const pillX = contributor.x - nameWidth / 2 - 4;
        const pillY = contributor.y + halfSize + 4;
        ctx.fillStyle = `rgba(0,0,0,${contributor.opacity * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY - 1, nameWidth + 8, 14, 4);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${contributor.opacity * 0.8})`;
        ctx.fillText(contributor.name, contributor.x, pillY + 1);
      }
    });
  }

  private renderLabels(ctx: CanvasRenderingContext2D, viewport: Bounds, showFileLabels: boolean): void {
    // Render directory labels
    this.nodes.forEach((node) => {
      if (node.opacity < 0.2) return;
      if (!this.isInViewport(node.x, node.y, viewport)) return;

      if (node.isDirectory) {
        // Show directory labels based on depth and zoom
        if (node.depth > 3 && this.camera.zoom < 2) return;
        if (node.depth > 5) return;
        if (node.children.length === 0) return;

        const fontSize = Math.max(8, 12 - node.depth * 0.8);
        ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Text background for readability
        const labelWidth = ctx.measureText(node.name).width;
        const labelX = node.x - labelWidth / 2 - 3;
        const labelY = node.y - this.settings.nodeSize * 1.5 - 2;

        ctx.fillStyle = `rgba(0, 0, 0, ${node.opacity * 0.4})`;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY - fontSize + 1, labelWidth + 6, fontSize + 3, 3);
        ctx.fill();

        ctx.fillStyle = `rgba(210, 215, 230, ${node.opacity * 0.75})`;
        ctx.fillText(node.name, node.x, node.y - this.settings.nodeSize * 1.5);
      } else if (showFileLabels) {
        // Show file labels only when zoomed in enough
        if (node.opacity < 0.5) return;

        const fontSize = 8;
        ctx.font = `${fontSize}px -apple-system, system-ui, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const fileSize = this.settings.nodeSize * (1 + Math.log2(1 + node.modificationCount) * 0.2) * node.scale;
        const labelX = node.x + fileSize / 2 + 4;
        const displayName = node.name.length > 20 ? node.name.substring(0, 18) + '..' : node.name;

        ctx.fillStyle = hexToRgba(node.color, node.opacity * 0.6);
        ctx.fillText(displayName, labelX, node.y);
      }
    });
  }

  private renderDateOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const dateStr = dateToString(this.simulationTime);

    // Date display with background
    const fontSize = Math.min(28, w * 0.035);
    ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", "Cascadia Code", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const dateWidth = ctx.measureText(dateStr).width;
    const datePadX = 16;
    const datePadY = 8;
    const dateBoxX = w - 20 - dateWidth - datePadX;
    const dateBoxY = 16;

    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(dateBoxX, dateBoxY, dateWidth + datePadX * 2, fontSize + datePadY * 2, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(dateBoxX, dateBoxY, dateWidth + datePadX * 2, fontSize + datePadY * 2, 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(dateStr, w - 20 - datePadX + 4, dateBoxY + datePadY);

    // Stats below date
    const nodeCount = this.nodes.size;
    const fileCount = Array.from(this.nodes.values()).filter((n) => !n.isDirectory).length;
    const contributorCount = Array.from(this.contributors.values()).filter((c) => c.isVisible).length;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.fillText(
      `${fileCount} files · ${nodeCount - fileCount} dirs · ${contributorCount} active`,
      w - 20 - datePadX + 4,
      dateBoxY + fontSize + datePadY + 8,
    );
  }

  private renderLegendOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Small language color legend in the bottom-right
    // Collect unique extensions currently visible
    const extensionColors = new Map<string, { color: string; count: number; language: string }>();

    this.nodes.forEach((node) => {
      if (node.isDirectory || node.opacity < 0.2) return;
      const ext = node.extension;
      if (!ext) return;
      const existing = extensionColors.get(ext);
      if (existing) {
        existing.count++;
      } else {
        const language = EXTENSION_TO_LANGUAGE[ext] || ext.toUpperCase();
        extensionColors.set(ext, { color: node.color, count: 1, language });
      }
    });

    if (extensionColors.size === 0) return;

    // Sort by count descending, take top 8
    const sorted = Array.from(extensionColors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Deduplicate by language name
    const seen = new Set<string>();
    const deduped: typeof sorted = [];
    for (const entry of sorted) {
      if (!seen.has(entry.language)) {
        seen.add(entry.language);
        deduped.push(entry);
      }
    }

    const legendX = 16;
    const legendY = h - 20 - deduped.length * 18;
    const dotSize = 5;

    // Background
    const bgWidth = 120;
    const bgHeight = deduped.length * 18 + 12;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(legendX - 6, legendY - 6, bgWidth, bgHeight, 6);
    ctx.fill();

    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < deduped.length; i++) {
      const entry = deduped[i];
      const y = legendY + i * 18 + 6;

      // Color dot
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.arc(legendX + dotSize, y, dotSize, 0, Math.PI * 2);
      ctx.fill();

      // Language name
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(entry.language, legendX + dotSize * 2 + 6, y);

      // Count
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillText(`${entry.count}`, legendX + bgWidth - 26, y);
    }
  }

  // ===========================================================================
  // GAME LOOP
  // ===========================================================================

  private gameLoop = (timestamp: number): void => {
    if (!this.loopState.isRunning) return;

    try {
      // Calculate delta time
      if (this.loopState.lastFrameTime === 0) {
        this.loopState.lastFrameTime = timestamp;
      }
      const rawDt = timestamp - this.loopState.lastFrameTime;
      this.loopState.lastFrameTime = timestamp;
      this.loopState.deltaTime = Math.min(rawDt, 50);

      // FPS calculation
      this.frameTimestamps.push(timestamp);
      while (this.frameTimestamps.length > 0 && this.frameTimestamps[0] < timestamp - 1000) {
        this.frameTimestamps.shift();
      }
      this.loopState.fps = this.frameTimestamps.length;

      // Advance simulation time based on speed
      if (this.state.playback === PlaybackState.PLAYING) {
        const simDelta = this.loopState.deltaTime * this.state.speed * this.autoSpeedFactor;
        this.simulationTime += simDelta;

        // Skip dead time
        if (this.settings.skipDeadTime && this.currentEventIndex < this.commitEvents.length) {
          const nextEventTime = this.commitEvents[this.currentEventIndex].timestamp;
          const deadThreshold = this.autoSpeedFactor * this.state.speed * 2000;
          if (nextEventTime - this.simulationTime > deadThreshold) {
            this.simulationTime = nextEventTime - (this.autoSpeedFactor * this.state.speed * 500);
          }
        }

        // Clamp
        if (this.simulationTime >= this.endTime) {
          this.simulationTime = this.endTime;
          this.pause();
        }

        // Process commit events up to current simulation time
        this.processEventsUpToTime();

        // Update state
        this.state.currentTime = this.simulationTime;
        this.state.progress = (this.simulationTime - this.startTime) / (this.endTime - this.startTime);

        const newDate = dateToString(this.simulationTime);
        if (newDate !== this.state.currentDate) {
          this.state.currentDate = newDate;
          this.callbacks.onDateChange?.(newDate);
        }
      }

      // Update physics
      this.updateLayout(this.loopState.deltaTime);

      // Update camera
      this.updateCamera();

      // Render
      this.render();

      // Frame callback
      this.loopState.frameCount++;
      this.callbacks.onFrame?.(this.getState());

      // Stats callback (every 500ms)
      if (timestamp - this.lastStatsUpdate > 500) {
        this.lastStatsUpdate = timestamp;
        this.callbacks.onStatsUpdate?.({
          fps: this.loopState.fps,
          nodeCount: this.nodes.size,
          edgeCount: Array.from(this.nodes.values()).filter((n) => n.parentId).length,
          beamCount: this.beams.length,
        });
      }
    } catch (err) {
      console.error('GourceEngine: render error', err);
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private processEventsUpToTime(): void {
    while (
      this.currentEventIndex < this.commitEvents.length &&
      this.commitEvents[this.currentEventIndex].timestamp <= this.simulationTime
    ) {
      this.processCommitEvent(this.commitEvents[this.currentEventIndex]);
      this.currentEventIndex++;
    }
  }

  // ===========================================================================
  // PUBLIC CONTROLS
  // ===========================================================================

  public start(): void {
    if (this.loopState.isRunning) return;
    this.loopState.isRunning = true;
    this.loopState.lastFrameTime = 0;
    this.state.playback = PlaybackState.PLAYING;
    this.callbacks.onPlaybackChange?.(PlaybackState.PLAYING);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public stop(): void {
    this.loopState.isRunning = false;
    this.state.playback = PlaybackState.STOPPED;
    this.callbacks.onPlaybackChange?.(PlaybackState.STOPPED);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public play(): void {
    if (this.state.playback === PlaybackState.PLAYING) return;

    if (!this.loopState.isRunning) {
      this.start();
    } else {
      this.state.playback = PlaybackState.PLAYING;
      this.callbacks.onPlaybackChange?.(PlaybackState.PLAYING);
    }
  }

  public pause(): void {
    this.state.playback = PlaybackState.PAUSED;
    this.callbacks.onPlaybackChange?.(PlaybackState.PAUSED);
  }

  public setSpeed(speed: number): void {
    this.state.speed = speed as PlaybackSpeed;
  }

  public seek(progress: number): void {
    const clampedProgress = clamp(progress, 0, 1);
    const targetTime = this.startTime + clampedProgress * (this.endTime - this.startTime);

    const previousPlayback = this.state.playback;
    this.state.playback = PlaybackState.SEEKING;

    if (targetTime < this.simulationTime) {
      // Seeking backward: reset and replay
      this.resetScene();
      this.simulationTime = this.startTime;
      this.currentEventIndex = 0;
    }

    this.simulationTime = targetTime;
    this.processEventsUpToTime();

    this.state.currentTime = this.simulationTime;
    this.state.progress = clampedProgress;
    this.state.currentDate = dateToString(this.simulationTime);

    // Restore previous playback state
    this.state.playback = previousPlayback;
    this.callbacks.onDateChange?.(this.state.currentDate);

    // Force render
    if (!this.loopState.isRunning) {
      this.render();
    }
  }

  private resetScene(): void {
    // Keep root nodes, remove everything else
    const rootNodeIds = this.repositories.map((r) => r.fullName);
    const toKeep = new Set(rootNodeIds);

    this.nodes.forEach((_, key) => {
      if (!toKeep.has(key)) {
        this.nodes.delete(key);
      }
    });

    // Reset root node children
    rootNodeIds.forEach((id) => {
      const node = this.nodes.get(id);
      if (node) {
        node.children = [];
      }
    });

    // Reset contributor visibility
    this.contributors.forEach((c) => {
      c.isVisible = false;
      c.opacity = 0;
    });

    // Clear effects
    this.beams = [];
    this.particles = [];

    // Reset processed flags
    this.commitEvents.forEach((e) => {
      e.processed = false;
    });
  }

  public getCurrentTime(): number {
    return this.simulationTime;
  }

  public getState(): GourceState {
    return { ...this.state, camera: { ...this.camera }, settings: { ...this.settings } };
  }

  public setActiveRepo(repoId: string | null): void {
    this.state.activeRepoId = repoId;
    this.state.isCombinedView = repoId === null;

    // Reset and replay with filter
    this.resetScene();
    this.simulationTime = this.startTime;
    this.currentEventIndex = 0;
    this.seek(this.state.progress);
  }

  public setSettings(settings: Partial<GourceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.state.settings = { ...this.settings };
  }

  public getSettings(): GourceSettings {
    return { ...this.settings };
  }

  public setCallbacks(callbacks: GourceEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  public getNodes(): Map<string, GourceNode> {
    return this.nodes;
  }

  public getContributors(): Map<string, GourceContributor> {
    return this.contributors;
  }

  public getCommitEvents(): GourceCommitEvent[] {
    return this.commitEvents;
  }

  public getCommitDensity(bucketCount: number = 100): number[] {
    if (this.commitEvents.length === 0) return new Array(bucketCount).fill(0);

    const duration = this.endTime - this.startTime;
    if (duration === 0) return new Array(bucketCount).fill(0);

    const bucketSize = duration / bucketCount;
    const density = new Array(bucketCount).fill(0);

    for (const event of this.commitEvents) {
      const bucket = Math.min(
        bucketCount - 1,
        Math.floor((event.timestamp - this.startTime) / bucketSize),
      );
      density[bucket]++;
    }

    return density;
  }

  public getStartDate(): string {
    return dateToString(this.startTime);
  }

  public getEndDate(): string {
    return dateToString(this.endTime);
  }

  public getTotalDuration(): number {
    return this.endTime - this.startTime;
  }

  public getProgress(): number {
    return this.state.progress;
  }

  public highlightContributor(contributorId: string | null): void {
    if (contributorId === null) {
      this.settings.contributorFilter = null;
    } else {
      this.settings.contributorFilter = [contributorId];
    }
  }

  public getRepoColors(): Map<string, string> {
    return new Map(this.repoColorMap);
  }

  public destroy(): void {
    this.stop();
    this.nodes.clear();
    this.contributors.clear();
    this.beams = [];
    this.particles = [];
    this.commitEvents = [];
    this.avatarImages.clear();
    this.canvas = null;
    this.ctx = null;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createGourceEngine(data: GourceEngineData): GourceEngine {
  return new GourceEngine(data);
}

// =============================================================================
// HIT DETECTION
// =============================================================================

export function hitTestNode(
  worldX: number,
  worldY: number,
  nodes: Map<string, GourceNode>,
  nodeSize: number,
): GourceNode | null {
  let closest: GourceNode | null = null;
  let closestDist = Infinity;

  nodes.forEach((node) => {
    if (node.opacity < 0.1) return;
    const dx = worldX - node.x;
    const dy = worldY - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = node.isDirectory ? nodeSize * 1.5 : nodeSize;

    if (dist < hitRadius && dist < closestDist) {
      closest = node;
      closestDist = dist;
    }
  });

  return closest;
}

export function hitTestContributor(
  worldX: number,
  worldY: number,
  contributors: Map<string, GourceContributor>,
): GourceContributor | null {
  let closest: GourceContributor | null = null;
  let closestDist = Infinity;
  const hitRadius = 15;

  contributors.forEach((contributor) => {
    if (!contributor.isVisible || contributor.opacity < 0.1) return;
    const dx = worldX - contributor.x;
    const dy = worldY - contributor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < hitRadius && dist < closestDist) {
      closest = contributor;
      closestDist = dist;
    }
  });

  return closest;
}

// =============================================================================
// SCREEN-TO-WORLD CONVERSION
// =============================================================================

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: GourceCamera,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  return {
    x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
    y: (screenY - canvasHeight / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: GourceCamera,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  return {
    x: (worldX - camera.x) * camera.zoom + canvasWidth / 2,
    y: (worldY - camera.y) * camera.zoom + canvasHeight / 2,
  };
}
