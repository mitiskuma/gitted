import type {
  CommitData,
  GourceNode,
  GourceCommitEvent,
  GourceContributor,
  GourceSettings,
  GourceCamera,
  GourceState,
  GourceFileChange,
  GameLoopState,
  Repository,
  Contributor,
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

import { LayoutBuffers, NodeFlags, parseColorToRgb } from '@/lib/layout-buffers';
import { TreeLayout } from '@/lib/tree-layout';
import { BeamPool, ParticlePool } from '@/lib/object-pools';

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

/** Callbacks emitted by the engine during the game loop. */
export interface GourceEngineCallbacks {
  onFrame?: (state: GourceState) => void;
  onDateChange?: (date: string) => void;
  onPlaybackChange?: (state: PlaybackState) => void;
  onStatsUpdate?: (stats: { fps: number; nodeCount: number; edgeCount: number; beamCount: number }) => void;
}

/** Input data required to construct a GourceEngine. */
export interface GourceEngineData {
  commits: CommitData[];
  repositories: Repository[];
  contributors: Contributor[];
}

/**
 * Core visualization engine for gource-style commit history animation.
 *
 * Manages a dual-storage scene graph: SoA typed-array buffers (`LayoutBuffers`)
 * for cache-friendly physics and rendering, plus a `Map<string, GourceNode>`
 * facade for external consumers (hit testing, tooltips, label rendering).
 * Positions are synced from buffers to the Map each frame.
 */
export class GourceEngine {
  // ---- Data ----
  private commitEvents: GourceCommitEvent[] = [];
  private repositories: Repository[] = [];
  private repoColorMap: Map<string, string> = new Map();

  // ---- Scene Graph (SoA buffers + tree layout) ----
  private buffers: LayoutBuffers;
  private treeLayout: TreeLayout;

  /**
   * Legacy node Map maintained alongside SoA `buffers` for external consumers.
   * The viewer component reads from this Map for hit testing and tooltip display,
   * and internal rendering methods (labels, legend overlay, camera auto-follow)
   * iterate it. Positions are synced from buffers each frame via syncBuffersToNodes().
   */
  private nodes: Map<string, GourceNode> = new Map();

  // ---- Contributors ----
  private contributors: Map<string, GourceContributor> = new Map();

  // ---- Effects (typed-array pools) ----
  private beamPool: BeamPool;
  private particlePool: ParticlePool;

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

    // Initialize SoA buffers and tree layout
    this.buffers = new LayoutBuffers(16384);
    this.treeLayout = new TreeLayout(this.buffers);

    // Initialize object pools
    this.beamPool = new BeamPool(512);
    this.particlePool = new ParticlePool(512);

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

  /** Bind the engine to a canvas element and create initial scene graph. */
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
      const baseRadius = repoCount > 1 ? 300 : 0;

      const node = this.createNode(repo.fullName, repo.name, null, true, repo.fullName);
      node.x = Math.cos(baseAngle) * baseRadius;
      node.y = Math.sin(baseAngle) * baseRadius;
      node.targetX = node.x;
      node.targetY = node.y;
      node.opacity = 1;
      node.scale = 1;
      node.angle = baseAngle;

      // Register in SoA buffers
      const idx = this.buffers.getIndex(repo.fullName);
      if (idx > 0) {
        this.buffers.x[idx] = node.x;
        this.buffers.y[idx] = node.y;
        this.buffers.targetX[idx] = node.x;
        this.buffers.targetY[idx] = node.y;
        this.buffers.opacity[idx] = 1;
        this.buffers.scale[idx] = 1;
        this.buffers.angle[idx] = baseAngle;
        this.treeLayout.addRoot(idx);
      }
    }

    // Recompute full tree layout
    this.treeLayout.recomputeAll();

    // Pre-load contributor avatars
    this.contributors.forEach((contributor) => {
      if (contributor.avatarUrl) {
        this.loadAvatar(contributor.id, contributor.avatarUrl);
      }
    });
  }

  /** Resize the canvas and update internal dimensions. */
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
      const rgb = hexToRgb(repoColor);
      nodeColor = `rgb(${Math.round(rgb.r * 0.5)}, ${Math.round(rgb.g * 0.5)}, ${Math.round(rgb.b * 0.5)})`;
    } else {
      nodeColor = this.settings.extensionColors[extension]
        || getLanguageColor(extension)
        || FILE_CATEGORY_COLORS[category]
        || '#94a3b8';
    }

    // Allocate in SoA buffers
    const idx = this.buffers.allocate(path);
    const parentIdx = parentId ? this.buffers.getIndex(parentId) : 0;
    const parentNode = parentId ? this.nodes.get(parentId) : null;
    const depth = parentNode ? parentNode.depth + 1 : 0;

    // Set buffer data
    this.buffers.depth[idx] = depth;
    this.buffers.setColor(idx, nodeColor);
    if (isDirectory) {
      this.buffers.setFlag(idx, NodeFlags.IS_DIR);
    }
    this.buffers.setFlag(idx, NodeFlags.VISIBLE);

    // Link to parent in buffers
    if (parentIdx > 0) {
      this.buffers.addChild(parentIdx, idx);
    }

    // Compute initial position from tree layout target
    // (The tree layout sets targets; use parent pos + angle as starting point)
    const baseX = parentNode ? parentNode.x : 0;
    const baseY = parentNode ? parentNode.y : 0;

    // Use a temporary angle until tree layout recomputes
    const siblingCount = parentNode ? parentNode.children.length : 0;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const childAngle = (parentNode ? parentNode.angle : 0) + goldenAngle * (siblingCount + 1);
    const branchLen = isDirectory ? 60 + Math.max(0, 30 - depth * 5) : 35 + Math.random() * 20;

    const x = baseX + Math.cos(childAngle) * branchLen;
    const y = baseY + Math.sin(childAngle) * branchLen;

    this.buffers.x[idx] = x;
    this.buffers.y[idx] = y;
    this.buffers.targetX[idx] = x;
    this.buffers.targetY[idx] = y;
    this.buffers.angle[idx] = childAngle;
    this.buffers.radius[idx] = branchLen;

    // Create GourceNode facade (for backward compat with viewer/renderer)
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
      radius: branchLen,
    };

    this.nodes.set(path, node);

    if (parentNode) {
      parentNode.children.push(path);
    }

    // Trigger incremental tree layout update
    this.treeLayout.onNodeAdded(idx);
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

        const idx = this.buffers.getIndex(currentPath);
        if (idx > 0) {
          this.buffers.opacity[idx] = 0.8;
          this.buffers.scale[idx] = 1;
        }
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

    // Sync to buffers
    const idx = this.buffers.getIndex(filePath);
    if (idx > 0) {
      this.buffers.lastModified[idx] = timestamp;
      this.buffers.modificationCount[idx] = node.modificationCount;
      this.buffers.setFlag(idx, NodeFlags.VISIBLE);
    }

    if (isNew || changeType === 'add') {
      // NEW FILE: explosive pop-in
      node.opacity = 1;
      node.scale = 0.01;
      if (idx > 0) {
        this.buffers.opacity[idx] = 1;
        this.buffers.scale[idx] = 0.01;
        this.buffers.popInTarget[idx] = 1.5;
        this.buffers.setFlag(idx, NodeFlags.POP_IN);
      }
    } else {
      // EXISTING FILE MODIFIED: pulse glow
      node.opacity = 1;
      node.scale = Math.min(node.scale + 0.6, 2.5);
      if (idx > 0) {
        this.buffers.opacity[idx] = 1;
        this.buffers.scale[idx] = node.scale;
      }
    }

    return node;
  }

  private removeFile(filePath: string): void {
    const node = this.nodes.get(filePath);
    if (!node) return;

    const idx = this.buffers.getIndex(filePath);

    // Mark for deletion animation
    node.scale = 0.8;
    if (idx > 0) {
      this.buffers.markDeleting(idx);
      this.buffers.scale[idx] = 0.8;
    }

    // Subtle fade-out particle on deletion
    if (this.settings.showParticles) {
      const rgb = parseColorToRgb(node.color);
      this.particlePool.emitBurst(
        node.x, node.y,
        rgb.r, rgb.g, rgb.b,
        2, 0.2, 0.6, 0.5, 1.0, 8, 15,
      );
    }

    // Remove from parent
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((id) => id !== filePath);
      }
    }

    // Schedule removal after fade animation
    const parentIdx = idx > 0 ? this.buffers.parentIndex[idx] : -1;
    setTimeout(() => {
      this.nodes.delete(filePath);
      if (idx > 0) {
        this.buffers.remove(idx);
        if (parentIdx > 0) {
          this.treeLayout.onNodeRemoved(parentIdx);
        }
      }
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

    // Process each file change
    for (const fileChange of event.affectedFiles) {
      if (fileChange.type === 'delete') {
        this.removeFile(fileChange.path);
        continue;
      }

      const isNewFile = !this.nodes.has(fileChange.path) || fileChange.type === 'add';
      const node = this.addOrUpdateFile(fileChange.path, event.repoId, event.timestamp, fileChange.type);

      // Create beam from contributor to the file node
      if (contributor && this.settings.showCommitBeams) {
        const rgb = parseColorToRgb(contributor.color);
        this.beamPool.add(
          contributor.x, contributor.y,
          node.x, node.y,
          rgb.r, rgb.g, rgb.b,
          50,
        );
      }

      // Create a subtle particle pulse at the file
      if (this.settings.showParticles) {
        const rgb = parseColorToRgb(node.color);
        const count = isNewFile ? 3 : 1;

        this.particlePool.emitBurst(
          node.x, node.y,
          rgb.r, rgb.g, rgb.b,
          count,
          0.3, 1.0,
          0.6, 1.5,
          10, 20,
        );
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
  // PHYSICS / LAYOUT UPDATE
  // ===========================================================================

  private updateLayout(dt: number): void {
    // --- Tree layout physics (spring-to-target + sibling repulsion) ---
    this.treeLayout.updatePhysics(dt);

    // --- Animations (pop-in, deletion, fading) ---
    this.treeLayout.updateAnimations(this.simulationTime, this.settings.nodeFadeTime);

    // --- Sync buffer positions back to GourceNode Map (for rendering & hit testing) ---
    this.syncBuffersToNodes();

    // --- Update contributors ---
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

    // --- Update effects via pools ---
    this.beamPool.update();
    this.particlePool.update();
  }

  /**
   * Sync SoA buffer positions/opacity/scale back to the GourceNode Map.
   * This is the bridge between the new SoA system and the existing rendering
   * code that reads from GourceNode objects.
   */
  private syncBuffersToNodes(): void {
    const b = this.buffers;
    for (let i = 1; i <= b.count; i++) {
      const id = b.getId(i);
      const node = this.nodes.get(id);
      if (!node) continue;

      node.x = b.x[i];
      node.y = b.y[i];
      node.targetX = b.targetX[i];
      node.targetY = b.targetY[i];
      node.vx = b.vx[i];
      node.vy = b.vy[i];
      node.opacity = b.opacity[i];
      node.scale = b.scale[i];
      node.angle = b.angle[i];
      node.isVisible = b.hasFlag(i, NodeFlags.VISIBLE);
    }
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
      let totalWeight = 0;
      let count = 0;

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

  /** Pan the camera by a screen-space delta. */
  public panCamera(dx: number, dy: number): void {
    this.camera.isUserControlled = true;
    this.camera.targetX -= dx / this.camera.zoom;
    this.camera.targetY -= dy / this.camera.zoom;
  }

  /** Zoom the camera, optionally centered on a screen-space point. */
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

  /** Reset camera to center with auto-follow enabled. */
  public resetCamera(): void {
    this.camera.isUserControlled = false;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.camera.targetZoom = 1;
  }

  // ===========================================================================
  // RENDERING (Canvas 2D — kept as fallback, eventually replaced by WebGL)
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
    const b = this.buffers;
    for (let i = 1; i <= b.count; i++) {
      const parentIdx = b.parentIndex[i];
      if (parentIdx <= 0) continue;
      if (b.opacity[i] < 0.05 || b.opacity[parentIdx] < 0.05) continue;

      const nx = b.x[i], ny = b.y[i];
      const px = b.x[parentIdx], py = b.y[parentIdx];

      // Cull off-screen edges
      if (!this.isInViewport(nx, ny, viewport, 100) &&
          !this.isInViewport(px, py, viewport, 100)) continue;

      const alpha = Math.min(b.opacity[i], b.opacity[parentIdx]) * 0.35;
      const isDir = b.hasFlag(i, NodeFlags.IS_DIR);
      const thickness = isDir
        ? this.settings.edgeThickness * 1.5
        : this.settings.edgeThickness;

      ctx.lineWidth = thickness;

      // Pre-computed color from buffers (avoids per-frame hexToRgba)
      ctx.strokeStyle = b.getRgba(i, alpha);

      ctx.beginPath();

      // Organic bezier curve for natural tree branching
      const dx = nx - px;
      const dy = ny - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(0.3, 15 / Math.max(dist, 1));

      const midX = (px + nx) / 2;
      const midY = (py + ny) / 2;
      const ctrlX = midX + dy * curvature;
      const ctrlY = midY - dx * curvature;

      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(ctrlX, ctrlY, nx, ny);
      ctx.stroke();
    }
  }

  private renderNodes(ctx: CanvasRenderingContext2D, viewport: Bounds, showDetails: boolean, showFileLabels: boolean): void {
    let visibleCount = 0;
    const b = this.buffers;

    // Render directories first (underneath files)
    for (let i = 1; i <= b.count; i++) {
      if (!b.hasFlag(i, NodeFlags.IS_DIR)) continue;
      if (b.opacity[i] < 0.05) continue;
      if (!this.isInViewport(b.x[i], b.y[i], viewport)) continue;
      if (visibleCount >= this.settings.maxVisibleNodes) break;
      visibleCount++;
      this.renderDirectoryNodeFromBuffer(ctx, i, showDetails);
    }

    // Then render file nodes on top
    for (let i = 1; i <= b.count; i++) {
      if (b.hasFlag(i, NodeFlags.IS_DIR)) continue;
      if (b.opacity[i] < 0.05) continue;
      if (!this.isInViewport(b.x[i], b.y[i], viewport)) continue;
      if (visibleCount >= this.settings.maxVisibleNodes) break;
      visibleCount++;
      this.renderFileNodeFromBuffer(ctx, i, showDetails);
    }
  }

  private renderDirectoryNodeFromBuffer(ctx: CanvasRenderingContext2D, idx: number, showDetails: boolean): void {
    const b = this.buffers;
    const x = b.x[idx], y = b.y[idx];
    const size = this.settings.nodeSize * 1.2;
    const alpha = b.opacity[idx] * 0.6;
    const rgba = b.getRgba(idx, alpha);

    // Directory: small circle with dim halo
    if (this.settings.showGlowEffects && b.childCount[idx] > 0) {
      const haloSize = size * 3;
      const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, haloSize);
      gradient.addColorStop(0, b.getRgba(idx, alpha * 0.15));
      gradient.addColorStop(1, b.getRgba(idx, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, haloSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Directory dot
    ctx.fillStyle = rgba;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Thin ring
    ctx.strokeStyle = b.getRgba(idx, alpha * 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderFileNodeFromBuffer(ctx: CanvasRenderingContext2D, idx: number, showDetails: boolean): void {
    const b = this.buffers;
    const x = b.x[idx], y = b.y[idx];
    const nodeOpacity = b.opacity[idx];
    const nodeScale = b.scale[idx];

    const baseSize = this.settings.nodeSize * 1.1;
    const modScale = 1 + Math.log2(1 + b.modificationCount[idx]) * 0.25;
    const displayScale = Math.max(nodeScale, 0.01);
    const size = baseSize * modScale * displayScale;

    const isRecentlyModified = this.simulationTime - b.lastModified[idx] < 3000;
    const isPopping = displayScale > 1.1 || displayScale < 0.5;

    // Strong glow effect for recently modified / popping files
    if (this.settings.showGlowEffects && (nodeScale > 1.05 || isRecentlyModified)) {
      const glowSize = size * (isPopping ? 5 : 3.5);
      const glowIntensity = isPopping
        ? Math.min(1, Math.abs(nodeScale - 1) * 0.8 + 0.3)
        : (isRecentlyModified ? 0.35 : 0.15);
      const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowSize);
      gradient.addColorStop(0, b.getRgba(idx, glowIntensity * nodeOpacity));
      gradient.addColorStop(0.4, b.getRgba(idx, glowIntensity * nodeOpacity * 0.4));
      gradient.addColorStop(1, b.getRgba(idx, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle ambient glow
    if (this.settings.showGlowEffects && nodeOpacity > 0.2) {
      const ambientSize = size * 2.5;
      const ambientIntensity = isRecentlyModified ? 0.18 : 0.08;
      const gradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, ambientSize);
      gradient.addColorStop(0, b.getRgba(idx, ambientIntensity * nodeOpacity));
      gradient.addColorStop(1, b.getRgba(idx, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, ambientSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // File circle
    const fileAlpha = Math.min(1, nodeOpacity * (isRecentlyModified ? 1.0 : 0.85));
    ctx.fillStyle = b.getRgba(idx, fileAlpha);
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Bright white inner highlight (specular)
    if (nodeOpacity > 0.3) {
      const highlightAlpha = isRecentlyModified ? 0.3 : 0.15;
      ctx.fillStyle = `rgba(255,255,255,${nodeOpacity * highlightAlpha})`;
      ctx.beginPath();
      ctx.arc(x - size * 0.1, y - size * 0.12, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Modification pulse rings
    if (nodeScale > 1.05) {
      const ringRadius = size * 0.8;
      const ringAlpha = Math.min(0.8, (nodeScale - 1) * nodeOpacity * 0.7);

      ctx.strokeStyle = b.getRgba(idx, ringAlpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (nodeScale > 1.15) {
        ctx.strokeStyle = b.getRgba(idx, ringAlpha * 0.4);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, ringRadius * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (nodeScale > 1.3) {
        ctx.strokeStyle = b.getRgba(idx, ringAlpha * 0.15);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, ringRadius * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private renderBeams(ctx: CanvasRenderingContext2D): void {
    const bp = this.beamPool;
    for (let i = 0; i < bp.count; i++) {
      const prog = clamp(bp.getProgress(i), 0, 1);
      const opacity = bp.getOpacity(i);
      if (opacity < 0.01) continue;

      const fromX = bp.getFromX(i), fromY = bp.getFromY(i);
      const toX = bp.getToX(i), toY = bp.getToY(i);
      const r = bp.colorR[i], g = bp.colorG[i], b = bp.colorB[i];

      // Bezier curve for organic beam path
      const dx = toX - fromX;
      const dy = toY - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      const curvature = Math.min(30, dist * 0.15);
      const ctrlX = midX + (dy / Math.max(dist, 1)) * curvature;
      const ctrlY = midY - (dx / Math.max(dist, 1)) * curvature;

      // Draw the trail
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.4})`;
      ctx.beginPath();

      const steps = 20;
      const startStep = Math.max(0, Math.floor((prog - 0.3) * steps));
      const endStep = Math.floor(prog * steps);

      for (let s = startStep; s <= endStep; s++) {
        const t = s / steps;
        const omt = 1 - t;
        const bx = omt * omt * fromX + 2 * omt * t * ctrlX + t * t * toX;
        const by = omt * omt * fromY + 2 * omt * t * ctrlY + t * t * toY;
        if (s === startStep) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.stroke();

      // Beam head
      const headT = prog;
      const omtHead = 1 - headT;
      const headX = omtHead * omtHead * fromX + 2 * omtHead * headT * ctrlX + headT * headT * toX;
      const headY = omtHead * omtHead * fromY + 2 * omtHead * headT * ctrlY + headT * headT * toY;

      // Head glow
      if (this.settings.showGlowEffects && opacity > 0.1) {
        const glowSize = 10;
        const gradient = ctx.createRadialGradient(headX, headY, 0, headX, headY, glowSize);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${opacity * 0.15})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(headX, headY, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright head dot
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(headX, headY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    const pp = this.particlePool;
    for (let i = 0; i < pp.count; i++) {
      const opacity = pp.getOpacity(i);
      if (opacity < 0.02) continue;

      const px = pp.getX(i), py = pp.getY(i);
      const size = pp.getSize(i);
      const r = pp.colorR[i], g = pp.colorG[i], b = pp.colorB[i];

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
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
        const rgb = parseColorToRgb(contributor.color);
        const gradient = ctx.createRadialGradient(
          contributor.x, contributor.y, halfSize,
          contributor.x, contributor.y, halfSize * 3,
        );
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 * contributor.opacity})`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
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

        const rgb = parseColorToRgb(contributor.color);
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${contributor.opacity * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const rgb = parseColorToRgb(contributor.color);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${contributor.opacity * 0.9})`;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, halfSize, 0, Math.PI * 2);
        ctx.fill();

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
    this.nodes.forEach((node) => {
      if (node.opacity < 0.2) return;
      if (!this.isInViewport(node.x, node.y, viewport)) return;

      if (node.isDirectory) {
        if (node.depth > 3 && this.camera.zoom < 2) return;
        if (node.depth > 5) return;
        if (node.children.length === 0) return;

        const fontSize = Math.max(8, 12 - node.depth * 0.8);
        ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

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
        if (node.opacity < 0.5) return;

        const fontSize = 8;
        ctx.font = `${fontSize}px -apple-system, system-ui, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const fileSize = this.settings.nodeSize * (1 + Math.log2(1 + node.modificationCount) * 0.2) * node.scale;
        const labelX = node.x + fileSize / 2 + 4;
        const displayName = node.name.length > 20 ? node.name.substring(0, 18) + '..' : node.name;

        const idx = this.buffers.getIndex(node.id);
        if (idx > 0) {
          ctx.fillStyle = this.buffers.getRgba(idx, node.opacity * 0.6);
        } else {
          ctx.fillStyle = hexToRgba(node.color, node.opacity * 0.6);
        }
        ctx.fillText(displayName, labelX, node.y);
      }
    });
  }

  private renderDateOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const dateStr = dateToString(this.simulationTime);

    const fontSize = Math.min(28, w * 0.035);
    ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", "Cascadia Code", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const dateWidth = ctx.measureText(dateStr).width;
    const datePadX = 16;
    const datePadY = 8;
    const dateBoxX = w - 20 - dateWidth - datePadX;
    const dateBoxY = 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(dateBoxX, dateBoxY, dateWidth + datePadX * 2, fontSize + datePadY * 2, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(dateBoxX, dateBoxY, dateWidth + datePadX * 2, fontSize + datePadY * 2, 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(dateStr, w - 20 - datePadX + 4, dateBoxY + datePadY);

    // Stats below date
    const nodeCount = this.nodes.size;
    let fileCount = 0;
    const b = this.buffers;
    for (let i = 1; i <= b.count; i++) {
      if (!b.hasFlag(i, NodeFlags.IS_DIR)) fileCount++;
    }
    let contributorCount = 0;
    this.contributors.forEach((c) => { if (c.isVisible) contributorCount++; });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.fillText(
      `${fileCount} files · ${nodeCount - fileCount} dirs · ${contributorCount} active`,
      w - 20 - datePadX + 4,
      dateBoxY + fontSize + datePadY + 8,
    );
  }

  private renderLegendOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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

    const sorted = Array.from(extensionColors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

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

      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.arc(legendX + dotSize, y, dotSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(entry.language, legendX + dotSize * 2 + 6, y);

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
        let edgeCount = 0;
        for (let i = 1; i <= this.buffers.count; i++) {
          if (this.buffers.parentIndex[i] > 0) edgeCount++;
        }
        this.callbacks.onStatsUpdate?.({
          fps: this.loopState.fps,
          nodeCount: this.buffers.count,
          edgeCount,
          beamCount: this.beamPool.count,
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

  /** Start the game loop and begin playback. */
  public start(): void {
    if (this.loopState.isRunning) return;
    this.loopState.isRunning = true;
    this.loopState.lastFrameTime = 0;
    this.state.playback = PlaybackState.PLAYING;
    this.callbacks.onPlaybackChange?.(PlaybackState.PLAYING);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  /** Stop the game loop entirely. */
  public stop(): void {
    this.loopState.isRunning = false;
    this.state.playback = PlaybackState.STOPPED;
    this.callbacks.onPlaybackChange?.(PlaybackState.STOPPED);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Resume playback (starts the loop if not already running). */
  public play(): void {
    if (this.state.playback === PlaybackState.PLAYING) return;

    if (!this.loopState.isRunning) {
      this.start();
    } else {
      this.state.playback = PlaybackState.PLAYING;
      this.callbacks.onPlaybackChange?.(PlaybackState.PLAYING);
    }
  }

  /** Pause playback (keeps the render loop alive for camera smoothing). */
  public pause(): void {
    this.state.playback = PlaybackState.PAUSED;
    this.callbacks.onPlaybackChange?.(PlaybackState.PAUSED);
  }

  /** Set the playback speed multiplier. */
  public setSpeed(speed: PlaybackSpeed): void {
    this.state.speed = speed;
  }

  /** Seek to a normalized progress position (0-1). */
  public seek(progress: number): void {
    const clampedProgress = clamp(progress, 0, 1);
    const targetTime = this.startTime + clampedProgress * (this.endTime - this.startTime);

    const previousPlayback = this.state.playback;
    this.state.playback = PlaybackState.SEEKING;

    if (targetTime < this.simulationTime) {
      this.resetScene();
      this.simulationTime = this.startTime;
      this.currentEventIndex = 0;
    }

    this.simulationTime = targetTime;
    this.processEventsUpToTime();

    this.state.currentTime = this.simulationTime;
    this.state.progress = clampedProgress;
    this.state.currentDate = dateToString(this.simulationTime);

    // Recompute full tree layout after seek
    this.treeLayout.recomputeAll();

    this.state.playback = previousPlayback;
    this.callbacks.onDateChange?.(this.state.currentDate);

    if (!this.loopState.isRunning) {
      this.render();
    }
  }

  private resetScene(): void {
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

    // Reset SoA buffers (but keep root nodes)
    this.buffers.clear();
    this.treeLayout = new TreeLayout(this.buffers);

    // Re-create root nodes in buffers
    for (let i = 0; i < this.repositories.length; i++) {
      const repo = this.repositories[i];
      const idx = this.buffers.allocate(repo.fullName);
      const rootNode = this.nodes.get(repo.fullName);
      if (rootNode && idx > 0) {
        this.buffers.x[idx] = rootNode.x;
        this.buffers.y[idx] = rootNode.y;
        this.buffers.targetX[idx] = rootNode.targetX;
        this.buffers.targetY[idx] = rootNode.targetY;
        this.buffers.opacity[idx] = 1;
        this.buffers.scale[idx] = 1;
        this.buffers.setFlag(idx, NodeFlags.IS_DIR | NodeFlags.VISIBLE);
        this.buffers.setColor(idx, rootNode.color);
        this.treeLayout.addRoot(idx);
      }
    }

    // Reset contributor visibility
    this.contributors.forEach((c) => {
      c.isVisible = false;
      c.opacity = 0;
    });

    // Clear effects
    this.beamPool.clear();
    this.particlePool.clear();

    // Reset processed flags
    this.commitEvents.forEach((e) => {
      e.processed = false;
    });
  }

  /** Get the current simulation timestamp in milliseconds. */
  public getCurrentTime(): number {
    return this.simulationTime;
  }

  /** Get a snapshot of the current engine state. */
  public getState(): GourceState {
    return { ...this.state, camera: { ...this.camera }, settings: { ...this.settings } };
  }

  /** Filter visualization to a single repository, or null for combined view. */
  public setActiveRepo(repoId: string | null): void {
    this.state.activeRepoId = repoId;
    this.state.isCombinedView = repoId === null;

    this.resetScene();
    this.simulationTime = this.startTime;
    this.currentEventIndex = 0;
    this.seek(this.state.progress);
  }

  /** Merge partial settings into the current configuration. */
  public setSettings(settings: Partial<GourceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.state.settings = { ...this.settings };
  }

  /** Get a copy of the current settings. */
  public getSettings(): GourceSettings {
    return { ...this.settings };
  }

  /** Register event callbacks for frame updates, date changes, etc. */
  public setCallbacks(callbacks: GourceEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Get the node Map (used by viewer for hit testing and tooltips). */
  public getNodes(): Map<string, GourceNode> {
    return this.nodes;
  }

  /** Get the contributor Map. */
  public getContributors(): Map<string, GourceContributor> {
    return this.contributors;
  }

  /** Get the processed commit events array. */
  public getCommitEvents(): GourceCommitEvent[] {
    return this.commitEvents;
  }

  /** Compute a histogram of commit counts over evenly-spaced time buckets. */
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

  /** Get the earliest commit date as an ISO date string. */
  public getStartDate(): string {
    return dateToString(this.startTime);
  }

  /** Get the latest commit date as an ISO date string. */
  public getEndDate(): string {
    return dateToString(this.endTime);
  }

  /** Get the total time span in milliseconds. */
  public getTotalDuration(): number {
    return this.endTime - this.startTime;
  }

  /** Get the current normalized playback progress (0-1). */
  public getProgress(): number {
    return this.state.progress;
  }

  /** Highlight a single contributor (filters future commits) or clear with null. */
  public highlightContributor(contributorId: string | null): void {
    if (contributorId === null) {
      this.settings.contributorFilter = null;
    } else {
      this.settings.contributorFilter = [contributorId];
    }
  }

  /** Get the color assigned to each repository. */
  public getRepoColors(): Map<string, string> {
    return new Map(this.repoColorMap);
  }

  /** Get the SoA buffers (for WebGL renderer or worker). */
  public getBuffers(): LayoutBuffers {
    return this.buffers;
  }

  /** Get the beam pool (for WebGL renderer). */
  public getBeamPool(): BeamPool {
    return this.beamPool;
  }

  /** Get the particle pool (for WebGL renderer). */
  public getParticlePool(): ParticlePool {
    return this.particlePool;
  }

  /** Tear down the engine and release all resources. */
  public destroy(): void {
    this.stop();
    this.nodes.clear();
    this.contributors.clear();
    this.beamPool.clear();
    this.particlePool.clear();
    this.commitEvents = [];
    this.avatarImages.clear();
    this.canvas = null;
    this.ctx = null;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/** Create a new GourceEngine instance from commit and repository data. */
export function createGourceEngine(data: GourceEngineData): GourceEngine {
  return new GourceEngine(data);
}

// =============================================================================
// HIT DETECTION
// =============================================================================

/** Find the closest visible node within hit radius of a world-space point. */
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

/** Find the closest visible contributor within hit radius of a world-space point. */
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

/** Convert screen-space coordinates to world-space given the current camera. */
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

/** Convert world-space coordinates to screen-space given the current camera. */
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
