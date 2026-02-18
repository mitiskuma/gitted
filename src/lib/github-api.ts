import { Octokit } from '@octokit/rest';
import type {
  Repository,
  RepositoryOwner,
  LicenseInfo,
  CommitData,
  CommitFile,
  CommitAuthor,
  Contributor,
  GitHubRateLimit,
  GitHubPagination,
  DayOfWeek,
  FileCategory,
} from '@/lib/types';

// =============================================================================
// ERROR TYPES
// =============================================================================

export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly retryAfter: number | null;
  public readonly isRateLimit: boolean;
  public readonly isNotFound: boolean;
  public readonly isUnauthorized: boolean;

  constructor(
    message: string,
    status: number,
    retryAfter: number | null = null
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.isRateLimit = status === 403 || status === 429;
    this.isNotFound = status === 404;
    this.isUnauthorized = status === 401;
  }
}

// =============================================================================
// RATE LIMIT TRACKING
// =============================================================================

let currentRateLimit: GitHubRateLimit = {
  remaining: 5000,
  limit: 5000,
  resetAt: 0,
  isLimited: false,
};

function updateRateLimit(headers: Record<string, string | undefined>): void {
  const remaining = headers['x-ratelimit-remaining'];
  const limit = headers['x-ratelimit-limit'];
  const reset = headers['x-ratelimit-reset'];

  if (remaining !== undefined) {
    currentRateLimit = {
      remaining: parseInt(remaining, 10),
      limit: limit ? parseInt(limit, 10) : currentRateLimit.limit,
      resetAt: reset ? parseInt(reset, 10) * 1000 : currentRateLimit.resetAt,
      isLimited: parseInt(remaining, 10) <= 0,
    };
  }
}

export function getRateLimit(): GitHubRateLimit {
  return { ...currentRateLimit };
}

// =============================================================================
// OCTOKIT FACTORY
// =============================================================================

function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;

      if (error instanceof GitHubApiError) {
        // Don't retry auth errors or not-found
        if (error.isUnauthorized || error.isNotFound) {
          throw error;
        }

        // Rate limit: wait for reset
        if (error.isRateLimit && error.retryAfter) {
          if (attempt < retries) {
            const waitTime = error.retryAfter * 1000;
            await sleep(Math.min(waitTime, 60000)); // Cap at 60s
            continue;
          }
        }
      }

      if (attempt < retries) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError ?? new Error('Retry exhausted with unknown error');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// HELPERS
// =============================================================================

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getFileCategory(extension: string): FileCategory {
  const categories: Record<string, FileCategory> = {
    ts: 'code' as FileCategory,
    tsx: 'code' as FileCategory,
    js: 'code' as FileCategory,
    jsx: 'code' as FileCategory,
    py: 'code' as FileCategory,
    java: 'code' as FileCategory,
    go: 'code' as FileCategory,
    rs: 'code' as FileCategory,
    cpp: 'code' as FileCategory,
    c: 'code' as FileCategory,
    cs: 'code' as FileCategory,
    rb: 'code' as FileCategory,
    php: 'code' as FileCategory,
    swift: 'code' as FileCategory,
    kt: 'code' as FileCategory,
    dart: 'code' as FileCategory,
    scala: 'code' as FileCategory,
    html: 'markup' as FileCategory,
    htm: 'markup' as FileCategory,
    xml: 'markup' as FileCategory,
    svg: 'markup' as FileCategory,
    vue: 'markup' as FileCategory,
    svelte: 'markup' as FileCategory,
    md: 'documentation' as FileCategory,
    mdx: 'documentation' as FileCategory,
    txt: 'documentation' as FileCategory,
    rst: 'documentation' as FileCategory,
    json: 'config' as FileCategory,
    yaml: 'config' as FileCategory,
    yml: 'config' as FileCategory,
    toml: 'config' as FileCategory,
    ini: 'config' as FileCategory,
    env: 'config' as FileCategory,
    css: 'asset' as FileCategory,
    scss: 'asset' as FileCategory,
    sass: 'asset' as FileCategory,
    less: 'asset' as FileCategory,
    png: 'asset' as FileCategory,
    jpg: 'asset' as FileCategory,
    jpeg: 'asset' as FileCategory,
    gif: 'asset' as FileCategory,
    ico: 'asset' as FileCategory,
    test: 'test' as FileCategory,
    spec: 'test' as FileCategory,
    Makefile: 'build' as FileCategory,
    Dockerfile: 'build' as FileCategory,
    csv: 'data' as FileCategory,
    tsv: 'data' as FileCategory,
  };

  return categories[extension] ?? ('other' as FileCategory);
}

function getDirectoryPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parseLinkHeader(linkHeader: string | undefined): GitHubPagination['links'] {
  const links: GitHubPagination['links'] = {
    next: null,
    prev: null,
    last: null,
    first: null,
  };

  if (!linkHeader) return links;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/);
    if (match) {
      const [, url, rel] = match;
      if (rel === 'next' || rel === 'prev' || rel === 'last' || rel === 'first') {
        links[rel] = url!;
      }
    }
  }

  return links;
}

function extractTotalPages(linkHeader: string | undefined): number | null {
  if (!linkHeader) return null;
  const links = parseLinkHeader(linkHeader);
  if (links.last) {
    const url = new URL(links.last);
    const page = url.searchParams.get('page');
    return page ? parseInt(page, 10) : null;
  }
  return null;
}

// =============================================================================
// NORMALIZE FUNCTIONS
// =============================================================================

function normalizeRepository(raw: Record<string, unknown>): Repository {
  const owner = raw['owner'] as Record<string, unknown>;
  const license = raw['license'] as Record<string, unknown> | null;

  const normalizedOwner: RepositoryOwner = {
    login: (owner['login'] as string) ?? '',
    avatarUrl: (owner['avatar_url'] as string) ?? '',
    isOrg: owner['type'] === 'Organization',
    type: (owner['type'] as 'User' | 'Organization') ?? 'User',
  };

  const normalizedLicense: LicenseInfo | null = license
    ? {
        key: (license['key'] as string) ?? '',
        name: (license['name'] as string) ?? '',
        spdxId: (license['spdx_id'] as string) ?? null,
      }
    : null;

  const fullName = (raw['full_name'] as string) ?? '';

  return {
    id: fullName,
    githubId: (raw['id'] as number) ?? 0,
    name: (raw['name'] as string) ?? '',
    fullName,
    description: (raw['description'] as string) ?? null,
    owner: normalizedOwner,
    isPrivate: (raw['private'] as boolean) ?? false,
    isFork: (raw['fork'] as boolean) ?? false,
    isArchived: (raw['archived'] as boolean) ?? false,
    language: (raw['language'] as string) ?? null,
    languages: {},
    starCount: (raw['stargazers_count'] as number) ?? 0,
    forkCount: (raw['forks_count'] as number) ?? 0,
    watcherCount: (raw['watchers_count'] as number) ?? 0,
    openIssueCount: (raw['open_issues_count'] as number) ?? 0,
    defaultBranch: (raw['default_branch'] as string) ?? 'main',
    createdAt: (raw['created_at'] as string) ?? '',
    updatedAt: (raw['updated_at'] as string) ?? '',
    pushedAt: (raw['pushed_at'] as string) ?? '',
    htmlUrl: (raw['html_url'] as string) ?? '',
    cloneUrl: (raw['clone_url'] as string) ?? '',
    commitCount: null,
    size: (raw['size'] as number) ?? 0,
    topics: (raw['topics'] as string[]) ?? [],
    license: normalizedLicense,
  };
}

function normalizeCommit(
  raw: Record<string, unknown>,
  repoId: string,
  repoName: string
): CommitData {
  const commitObj = raw['commit'] as Record<string, unknown>;
  const authorObj = commitObj['author'] as Record<string, unknown>;
  const committerObj = commitObj['committer'] as Record<string, unknown>;
  const ghAuthor = raw['author'] as Record<string, unknown> | null;
  const ghCommitter = raw['committer'] as Record<string, unknown> | null;
  const parents = (raw['parents'] as Array<Record<string, unknown>>) ?? [];
  const filesRaw = (raw['files'] as Array<Record<string, unknown>>) ?? [];
  const stats = raw['stats'] as Record<string, unknown> | undefined;

  const sha = (raw['sha'] as string) ?? '';
  const message = (commitObj['message'] as string) ?? '';
  const timestamp = (authorObj['date'] as string) ?? new Date().toISOString();
  const timestampMs = new Date(timestamp).getTime();
  const date = new Date(timestamp);

  const author: CommitAuthor = {
    name: (authorObj['name'] as string) ?? 'Unknown',
    email: (authorObj['email'] as string) ?? '',
    login: ghAuthor ? (ghAuthor['login'] as string) ?? null : null,
    avatarUrl: ghAuthor ? (ghAuthor['avatar_url'] as string) ?? null : null,
  };

  const committer: CommitAuthor = {
    name: (committerObj['name'] as string) ?? 'Unknown',
    email: (committerObj['email'] as string) ?? '',
    login: ghCommitter ? (ghCommitter['login'] as string) ?? null : null,
    avatarUrl: ghCommitter ? (ghCommitter['avatar_url'] as string) ?? null : null,
  };

  const files: CommitFile[] = filesRaw.map((f) => {
    const path = (f['filename'] as string) ?? '';
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const extension = getFileExtension(filename);

    return {
      path,
      filename,
      directory: getDirectoryPath(path),
      extension,
      status: (f['status'] as CommitFile['status']) ?? 'modified',
      additions: (f['additions'] as number) ?? 0,
      deletions: (f['deletions'] as number) ?? 0,
      changes: (f['changes'] as number) ?? 0,
      previousPath: (f['previous_filename'] as string) ?? null,
      category: getFileCategory(extension),
    };
  });

  const additions = stats
    ? (stats['additions'] as number) ?? 0
    : files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = stats
    ? (stats['deletions'] as number) ?? 0
    : files.reduce((sum, f) => sum + f.deletions, 0);

  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return {
    sha,
    shortSha: sha.substring(0, 7),
    message,
    messageHeadline: message.split('\n')[0],
    author,
    committer,
    timestamp,
    timestampMs,
    repoId,
    repoName,
    filesChanged: files.length || (filesRaw.length > 0 ? filesRaw.length : 0),
    additions,
    deletions,
    totalChanges: additions + deletions,
    isMerge: parents.length > 1,
    parents: parents.map((p) => (p['sha'] as string) ?? ''),
    files,
    htmlUrl: (raw['html_url'] as string) ?? '',
    hourOfDay: date.getHours(),
    dayOfWeek: date.getDay() as DayOfWeek,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    dayOfMonth: date.getDate(),
    weekOfYear: getISOWeekNumber(date),
    dateKey,
  };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch the authenticated user's repositories with automatic pagination.
 */
export async function fetchUserRepos(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    affiliation?: string;
  } = {}
): Promise<{
  repos: Repository[];
  pagination: GitHubPagination;
  rateLimit: GitHubRateLimit;
}> {
  const { page = 1, perPage = 100, sort = 'updated', direction = 'desc', type, affiliation } = options;
  return withRetry(async () => {
    const octokit = createOctokit(token);

    try {
      // GitHub API: type and affiliation cannot be used together.
      // affiliation is more comprehensive for org repos.
      const params: Record<string, unknown> = {
        per_page: perPage,
        page,
        sort,
        direction,
      };
      if (affiliation) {
        params.affiliation = affiliation;
      } else {
        params.type = type ?? 'all';
      }

      const response = await octokit.request('GET /user/repos', {
        ...params,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      const headers = response.headers as unknown as Record<string, string | undefined>;
      updateRateLimit(headers);

      const linkHeader = headers['link'];
      const totalPages = extractTotalPages(linkHeader);
      const links = parseLinkHeader(linkHeader);

      const repos = (response.data as unknown as Array<Record<string, unknown>>).map(
        normalizeRepository
      );

      const pagination: GitHubPagination = {
        page,
        perPage,
        totalPages,
        hasMore: links.next !== null,
        links,
      };

      return {
        repos,
        pagination,
        rateLimit: getRateLimit(),
      };
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { headers?: Record<string, string> }; message?: string };
      const status = err.status ?? 500;
      const retryAfter = err.response?.headers?.['retry-after']
        ? parseInt(err.response.headers['retry-after'], 10)
        : null;

      throw new GitHubApiError(
        err.message ?? `Failed to fetch repos (${status})`,
        status,
        retryAfter
      );
    }
  });
}

/**
 * Fetch all pages of user repos automatically.
 */
export async function fetchAllUserRepos(
  token: string
): Promise<{
  repos: Repository[];
  rateLimit: GitHubRateLimit;
}> {
  const allRepos: Repository[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchUserRepos(token, { page, perPage: 100 });
    allRepos.push(...result.repos);
    hasMore = result.pagination.hasMore;
    page++;

    // Safety limit: don't fetch more than 50 pages (5000 repos)
    if (page > 50) break;

    // Small delay between paginated requests to be nice to the API
    if (hasMore) {
      await sleep(100);
    }
  }

  return {
    repos: allRepos,
    rateLimit: getRateLimit(),
  };
}

/**
 * Fetch commits for a repository with automatic pagination and smart batching.
 */
export async function fetchRepoCommits(
  token: string,
  owner: string,
  repo: string,
  since?: string,
  until?: string,
  page?: number,
  perPage: number = 100
): Promise<{
  commits: CommitData[];
  pagination: GitHubPagination;
  rateLimit: GitHubRateLimit;
  totalCount: number | null;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);
    const repoId = `${owner}/${repo}`;

    try {
      const params: Record<string, string | number> = {
        per_page: perPage,
        page: page ?? 1,
      };

      if (since) params['since'] = since;
      if (until) params['until'] = until;

      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/commits',
        {
          owner,
          repo,
          ...params,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      const headers = response.headers as unknown as Record<string, string | undefined>;
      updateRateLimit(headers);

      const linkHeader = headers['link'];
      const totalPages = extractTotalPages(linkHeader);
      const links = parseLinkHeader(linkHeader);

      const rawCommits = response.data as unknown as Array<Record<string, unknown>>;
      const commits = rawCommits.map((c) => normalizeCommit(c, repoId, repo));

      // Estimate total count from pagination
      let totalCount: number | null = null;
      if (totalPages && perPage) {
        totalCount = totalPages * perPage; // Rough estimate
      }

      const pagination: GitHubPagination = {
        page: page ?? 1,
        perPage,
        totalPages,
        hasMore: links.next !== null,
        links,
      };

      return {
        commits,
        pagination,
        rateLimit: getRateLimit(),
        totalCount,
      };
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { headers?: Record<string, string> }; message?: string };
      const status = err.status ?? 500;
      const retryAfter = err.response?.headers?.['retry-after']
        ? parseInt(err.response.headers['retry-after'], 10)
        : null;

      throw new GitHubApiError(
        err.message ?? `Failed to fetch commits for ${repoId} (${status})`,
        status,
        retryAfter
      );
    }
  });
}

/**
 * Fetch all commits for a repository with smart batching.
 */
export async function fetchAllRepoCommits(
  token: string,
  owner: string,
  repo: string,
  since?: string,
  until?: string,
  onProgress?: (fetched: number, estimated: number | null) => void
): Promise<{
  commits: CommitData[];
  rateLimit: GitHubRateLimit;
}> {
  const allCommits: CommitData[] = [];
  const perPage = 100;

  // First page to get pagination info
  const firstResult = await fetchRepoCommits(token, owner, repo, since, until, 1, perPage);
  allCommits.push(...firstResult.commits);

  const totalPages = firstResult.pagination.totalPages;
  const estimatedTotal = totalPages ? totalPages * perPage : null;

  onProgress?.(allCommits.length, estimatedTotal);

  if (!firstResult.pagination.hasMore) {
    return { commits: allCommits, rateLimit: getRateLimit() };
  }

  // Determine fetching strategy based on estimated size
  if (totalPages && totalPages > 10) {
    // Large repo: fetch in parallel batches of 5 pages
    const BATCH_SIZE = 5;
    let currentPage = 2;
    const maxPage = Math.min(totalPages, 300); // Cap at 30,000 commits

    while (currentPage <= maxPage) {
      const batchEnd = Math.min(currentPage + BATCH_SIZE - 1, maxPage);
      const pagesToFetch: number[] = [];

      for (let p = currentPage; p <= batchEnd; p++) {
        pagesToFetch.push(p);
      }

      // Check rate limit before batch
      if (currentRateLimit.remaining < pagesToFetch.length + 5) {
        const waitTime = Math.max(0, currentRateLimit.resetAt - Date.now());
        if (waitTime > 0) {
          await sleep(Math.min(waitTime, 60000));
        }
      }

      const batchResults = await Promise.allSettled(
        pagesToFetch.map((p) =>
          fetchRepoCommits(token, owner, repo, since, until, p, perPage)
        )
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allCommits.push(...result.value.commits);
        }
        // Skip failed pages — we can still provide partial data
      }

      onProgress?.(allCommits.length, estimatedTotal);
      currentPage = batchEnd + 1;

      // Small delay between batches
      if (currentPage <= maxPage) {
        await sleep(200);
      }
    }
  } else {
    // Small repo: sequential pagination
    let page = 2;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchRepoCommits(token, owner, repo, since, until, page, perPage);
      allCommits.push(...result.commits);
      hasMore = result.pagination.hasMore;
      page++;

      onProgress?.(allCommits.length, estimatedTotal);

      if (hasMore) {
        await sleep(100);
      }

      // Safety cap
      if (page > 300) break;
    }
  }

  // Sort by timestamp descending (newest first)
  allCommits.sort((a, b) => b.timestampMs - a.timestampMs);

  return { commits: allCommits, rateLimit: getRateLimit() };
}

/**
 * Fetch detailed commit data (with file stats) for a single commit.
 */
export async function fetchCommitDetail(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<{
  commit: CommitData;
  rateLimit: GitHubRateLimit;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);
    const repoId = `${owner}/${repo}`;

    try {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/commits/{ref}',
        {
          owner,
          repo,
          ref: sha,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      const headers = response.headers as unknown as Record<string, string | undefined>;
      updateRateLimit(headers);

      const commit = normalizeCommit(
        response.data as unknown as Record<string, unknown>,
        repoId,
        repo
      );

      return { commit, rateLimit: getRateLimit() };
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { headers?: Record<string, string> }; message?: string };
      const status = err.status ?? 500;
      throw new GitHubApiError(
        err.message ?? `Failed to fetch commit ${sha} for ${repoId}`,
        status
      );
    }
  });
}

/**
 * Fetch contributors for a repository.
 */
export async function fetchRepoContributors(
  token: string,
  owner: string,
  repo: string
): Promise<{
  contributors: Contributor[];
  rateLimit: GitHubRateLimit;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);
    const repoId = `${owner}/${repo}`;
    const allContributors: Contributor[] = [];
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await octokit.request(
          'GET /repos/{owner}/{repo}/contributors',
          {
            owner,
            repo,
            per_page: 100,
            page,
            anon: '1', // Include anonymous contributors
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );

        const headers = response.headers as unknown as Record<string, string | undefined>;
        updateRateLimit(headers);

        const rawContributors = response.data as unknown as Array<Record<string, unknown>>;

        for (const raw of rawContributors) {
          const login = (raw['login'] as string) ?? null;
          const id = login ?? (raw['email'] as string) ?? `anon-${raw['id']}`;

          // Generate a consistent color from the contributor's name/id
          const colorHash = String(id).split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
          }, 0);
          const color = `hsl(${Math.abs(colorHash) % 360}, 70%, 60%)`;

          allContributors.push({
            id: String(id),
            name: (raw['name'] as string) ?? login ?? 'Anonymous',
            email: (raw['email'] as string) ?? '',
            login,
            avatarUrl: (raw['avatar_url'] as string) ?? null,
            totalCommits: (raw['contributions'] as number) ?? 0,
            totalAdditions: 0, // Not available from this endpoint
            totalDeletions: 0,
            firstCommitDate: '',
            lastCommitDate: '',
            repos: [repoId],
            color,
          });
        }

        const links = parseLinkHeader(headers['link']);
        hasMore = links.next !== null;
        page++;

        if (hasMore) await sleep(100);
        if (page > 20) break; // Safety cap
      }

      return {
        contributors: allContributors,
        rateLimit: getRateLimit(),
      };
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { headers?: Record<string, string> }; message?: string };
      const status = err.status ?? 500;

      // 204 = empty repo, return empty array
      if (status === 204) {
        return { contributors: [], rateLimit: getRateLimit() };
      }

      throw new GitHubApiError(
        err.message ?? `Failed to fetch contributors for ${repoId}`,
        status
      );
    }
  });
}

/**
 * Fetch language breakdown for a repository.
 */
export async function fetchRepoLanguages(
  token: string,
  owner: string,
  repo: string
): Promise<{
  languages: Record<string, number>;
  rateLimit: GitHubRateLimit;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);

    try {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/languages',
        {
          owner,
          repo,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      const headers = response.headers as unknown as Record<string, string | undefined>;
      updateRateLimit(headers);

      return {
        languages: response.data as Record<string, number>,
        rateLimit: getRateLimit(),
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const status = err.status ?? 500;
      throw new GitHubApiError(
        err.message ?? `Failed to fetch languages for ${owner}/${repo}`,
        status
      );
    }
  });
}

/**
 * Fetch branches for a repository.
 */
export async function fetchRepoBranches(
  token: string,
  owner: string,
  repo: string
): Promise<{
  branches: Array<{ name: string; isDefault: boolean; sha: string }>;
  rateLimit: GitHubRateLimit;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);

    try {
      // First, get repo info for default branch
      const repoResponse = await octokit.request(
        'GET /repos/{owner}/{repo}',
        {
          owner,
          repo,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      const repoData = repoResponse.data as unknown as Record<string, unknown>;
      const defaultBranch = (repoData['default_branch'] as string) ?? 'main';

      const allBranches: Array<{ name: string; isDefault: boolean; sha: string }> = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await octokit.request(
          'GET /repos/{owner}/{repo}/branches',
          {
            owner,
            repo,
            per_page: 100,
            page,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );

        const headers = response.headers as unknown as Record<string, string | undefined>;
        updateRateLimit(headers);

        const rawBranches = response.data as unknown as Array<Record<string, unknown>>;

        for (const branch of rawBranches) {
          const name = (branch['name'] as string) ?? '';
          const commitObj = branch['commit'] as Record<string, unknown>;

          allBranches.push({
            name,
            isDefault: name === defaultBranch,
            sha: (commitObj['sha'] as string) ?? '',
          });
        }

        const links = parseLinkHeader(headers['link']);
        hasMore = links.next !== null;
        page++;

        if (hasMore) await sleep(100);
        if (page > 10) break;
      }

      return {
        branches: allBranches,
        rateLimit: getRateLimit(),
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const status = err.status ?? 500;
      throw new GitHubApiError(
        err.message ?? `Failed to fetch branches for ${owner}/${repo}`,
        status
      );
    }
  });
}

/**
 * Fetch repository statistics including participation, commit activity, and code frequency.
 */
export async function fetchRepoStats(
  token: string,
  owner: string,
  repo: string
): Promise<{
  stats: {
    weeklyCommitCounts: number[];
    participation: {
      all: number[];
      owner: number[];
    };
    codeFrequency: Array<[number, number, number]>;
    totalCommitCount: number;
    contributorStats: Array<{
      login: string;
      avatarUrl: string;
      totalCommits: number;
      totalAdditions: number;
      totalDeletions: number;
    }>;
  };
  rateLimit: GitHubRateLimit;
}> {
  const octokit = createOctokit(token);
  const MAX_STAT_RETRIES = 3;

  // Helper for stats endpoints that return 202 when computing
  async function fetchStatEndpoint<T>(
    endpoint: string,
    retries: number = MAX_STAT_RETRIES
  ): Promise<T | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await octokit.request(endpoint, {
          owner,
          repo,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        const headers = response.headers as unknown as Record<string, string | undefined>;
        updateRateLimit(headers);

        // 202 means stats are being computed
        if (response.status === 202) {
          if (attempt < retries) {
            await sleep(2000 * (attempt + 1));
            continue;
          }
          return null;
        }

        return response.data as T;
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === 202 && attempt < retries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if (err.status === 204) {
          return null;
        }
        throw error;
      }
    }
    return null;
  }

  try {
    const [participationData, codeFrequencyData, contributorStatsData] =
      await Promise.allSettled([
        fetchStatEndpoint<{ all: number[]; owner: number[] }>(
          'GET /repos/{owner}/{repo}/stats/participation'
        ),
        fetchStatEndpoint<Array<[number, number, number]>>(
          'GET /repos/{owner}/{repo}/stats/code_frequency'
        ),
        fetchStatEndpoint<
          Array<{
            author: { login: string; avatar_url: string };
            total: number;
            weeks: Array<{ a: number; d: number; c: number }>;
          }>
        >('GET /repos/{owner}/{repo}/stats/contributors'),
      ]);

    const participation =
      participationData.status === 'fulfilled' && participationData.value
        ? participationData.value
        : { all: [] as number[], owner: [] as number[] };

    const codeFrequency =
      codeFrequencyData.status === 'fulfilled' && codeFrequencyData.value
        ? codeFrequencyData.value
        : [];

    const rawContributorStats =
      contributorStatsData.status === 'fulfilled' && contributorStatsData.value
        ? contributorStatsData.value
        : [];

    const contributorStats = rawContributorStats.map((cs) => {
      const totalAdditions = cs.weeks.reduce((sum, w) => sum + w.a, 0);
      const totalDeletions = cs.weeks.reduce((sum, w) => sum + w.d, 0);

      return {
        login: cs.author.login,
        avatarUrl: cs.author.avatar_url,
        totalCommits: cs.total,
        totalAdditions,
        totalDeletions,
      };
    });

    const totalCommitCount = participation.all.reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      stats: {
        weeklyCommitCounts: participation.all,
        participation,
        codeFrequency,
        totalCommitCount,
        contributorStats,
      },
      rateLimit: getRateLimit(),
    };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    const status = err.status ?? 500;
    throw new GitHubApiError(
      err.message ?? `Failed to fetch stats for ${owner}/${repo}`,
      status
    );
  }
}

type FetchRepoStatsReturn = Awaited<ReturnType<typeof fetchRepoStats>>;

/**
 * Smart fetch: determines strategy based on repo size.
 */
export async function smartFetchRepoData(
  token: string,
  owner: string,
  repo: string,
  options?: {
    since?: string;
    until?: string;
    maxCommits?: number;
    includeFileDetails?: boolean;
    onProgress?: (fetched: number, estimated: number | null) => void;
  }
): Promise<{
  commits: CommitData[];
  languages: Record<string, number>;
  contributors: Contributor[];
  stats: FetchRepoStatsReturn['stats'] | null;
  rateLimit: GitHubRateLimit;
}> {
  const {
    since,
    until,
    maxCommits = 10000,
    onProgress,
  } = options ?? {};

  // Step 1: Fetch stats to determine commit count
  let stats: FetchRepoStatsReturn['stats'] | null = null;
  try {
    const statsResult = await fetchRepoStats(token, owner, repo);
    stats = statsResult.stats;
  } catch {
    // Stats might fail for empty/new repos, continue anyway
  }

  const estimatedCommits = stats?.totalCommitCount ?? 0;

  // Step 2: Fetch languages (lightweight, always do this)
  let languages: Record<string, number> = {};
  try {
    const langResult = await fetchRepoLanguages(token, owner, repo);
    languages = langResult.languages;
  } catch {
    // Non-critical, continue
  }

  // Step 3: Fetch contributors
  let contributors: Contributor[] = [];
  try {
    const contribResult = await fetchRepoContributors(token, owner, repo);
    contributors = contribResult.contributors;
  } catch {
    // Non-critical, continue
  }

  // Step 4: Fetch commits based on estimated size
  let commits: CommitData[] = [];

  if (estimatedCommits > 1000 || estimatedCommits === 0) {
    const result = await fetchAllRepoCommits(
      token,
      owner,
      repo,
      since,
      until,
      (fetched, estimated) => {
        onProgress?.(fetched, estimated);
      }
    );
    commits = result.commits.slice(0, maxCommits);
  } else {
    const result = await fetchAllRepoCommits(
      token,
      owner,
      repo,
      since,
      until,
      onProgress
    );
    commits = result.commits;
  }

  return {
    commits,
    languages,
    contributors,
    stats,
    rateLimit: getRateLimit(),
  };
}

/**
 * Validate a GitHub token by attempting to fetch the authenticated user.
 */
export async function validateToken(
  token: string
): Promise<{
  valid: boolean;
  user: {
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
  } | null;
  scopes: string[];
  rateLimit: GitHubRateLimit;
}> {
  try {
    const octokit = createOctokit(token);
    const response = await octokit.request('GET /user', {
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const headers = response.headers as unknown as Record<string, string | undefined>;
    updateRateLimit(headers);

    const scopes = (headers['x-oauth-scopes'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const data = response.data as unknown as Record<string, unknown>;

    return {
      valid: true,
      user: {
        id: (data['id'] as number) ?? 0,
        login: (data['login'] as string) ?? '',
        name: (data['name'] as string) ?? null,
        avatarUrl: (data['avatar_url'] as string) ?? '',
        profileUrl: (data['html_url'] as string) ?? '',
        bio: (data['bio'] as string) ?? null,
        publicRepos: (data['public_repos'] as number) ?? 0,
        totalRepos:
          ((data['total_private_repos'] as number) ?? 0) +
          ((data['public_repos'] as number) ?? 0),
        createdAt: (data['created_at'] as string) ?? '',
        email: (data['email'] as string) ?? null,
        company: (data['company'] as string) ?? null,
        location: (data['location'] as string) ?? null,
        followers: (data['followers'] as number) ?? 0,
        following: (data['following'] as number) ?? 0,
      },
      scopes,
      rateLimit: getRateLimit(),
    };
  } catch {
    return {
      valid: false,
      user: null,
      scopes: [],
      rateLimit: getRateLimit(),
    };
  }
}

/**
 * Exchange an OAuth code for an access token.
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken: string;
  tokenType: string;
  scope: string;
}> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new GitHubApiError(
      `Failed to exchange code for token: ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as Record<string, string>;

  if (data['error']) {
    throw new GitHubApiError(
      data['error_description'] ?? data['error'],
      401
    );
  }

  const accessToken = data['access_token'];
  if (!accessToken) {
    throw new GitHubApiError('No access token in response', 500);
  }

  return {
    accessToken,
    tokenType: data['token_type'] ?? 'bearer',
    scope: data['scope'] ?? '',
  };
}

/**
 * Search repositories for a user.
 */
export async function searchUserRepos(
  token: string,
  query: string,
  page: number = 1,
  perPage: number = 30
): Promise<{
  repos: Repository[];
  totalCount: number;
  rateLimit: GitHubRateLimit;
}> {
  return withRetry(async () => {
    const octokit = createOctokit(token);

    try {
      // First get the authenticated user
      const userResponse = await octokit.request('GET /user', {
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      const userData = userResponse.data as unknown as Record<string, unknown>;
      const username = (userData['login'] as string) ?? '';

      const response = await octokit.request('GET /search/repositories', {
        q: `${query} user:${username}`,
        per_page: perPage,
        page,
        sort: 'updated',
        order: 'desc',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      const headers = response.headers as unknown as Record<string, string | undefined>;
      updateRateLimit(headers);

      const data = response.data as {
        total_count: number;
        items: Array<Record<string, unknown>>;
      };

      return {
        repos: data.items.map(normalizeRepository),
        totalCount: data.total_count,
        rateLimit: getRateLimit(),
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const status = err.status ?? 500;
      throw new GitHubApiError(
        err.message ?? `Failed to search repos (${status})`,
        status
      );
    }
  });
}
