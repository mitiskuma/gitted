import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import {
  fetchRepoCommits,
  fetchAllRepoCommits,
} from '@/lib/github-api';
import { GitHubApiError } from '@/lib/github-api';
import type {
  ApiResponse,
  CommitData,
  GitHubRateLimit,
  GitHubPagination,
} from '@/lib/types';

// =============================================================================
// REQUEST VALIDATION SCHEMAS
// =============================================================================

const singleRepoSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const commitsQuerySchema = z.object({
  /** Comma-separated list of "owner/repo" strings, or a single "owner/repo" */
  repos: z
    .string()
    .min(1)
    .transform((val) => val.split(',').map((r) => r.trim()).filter(Boolean)),
  /** ISO 8601 date string — only return commits after this date */
  since: z.string().datetime({ offset: true }).optional(),
  /** ISO 8601 date string — only return commits before this date */
  until: z.string().datetime({ offset: true }).optional(),
  /** Page number for paginated single-repo requests */
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  /** Items per page (max 100, GitHub API limit) */
  perPage: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .pipe(z.number().int().min(1).max(100)),
  /** Whether to fetch ALL pages (for batch mode) */
  fetchAll: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  /** Maximum commits to return per repo (safety cap) */
  maxCommits: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10000))
    .pipe(z.number().int().positive().max(50000)),
});

// =============================================================================
// TYPES
// =============================================================================

interface RepoCommitResult {
  repoId: string;
  commits: CommitData[];
  totalFetched: number;
  hasMore: boolean;
  error: string | null;
}

interface CommitsApiResponseData {
  results: RepoCommitResult[];
  totalCommits: number;
  repoCount: number;
  fetchedAt: number;
}

// =============================================================================
// PARALLEL BATCHING HELPERS
// =============================================================================

/**
 * Split an array into chunks of the given size.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Parse a "owner/repo" string into { owner, repo }.
 * Returns null if the format is invalid.
 */
function parseRepoString(repoStr: string): { owner: string; repo: string } | null {
  const parts = repoStr.split('/');
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;

  const parsed = singleRepoSchema.safeParse({ owner, repo });
  if (!parsed.success) return null;
  return parsed.data;
}

/**
 * Fetch commits for a single repository with error isolation.
 * Returns a result object that includes the error (if any) rather than throwing.
 */
async function fetchSingleRepoCommits(
  token: string,
  owner: string,
  repo: string,
  options: {
    since?: string;
    until?: string;
    page: number;
    perPage: number;
    fetchAll: boolean;
    maxCommits: number;
  }
): Promise<RepoCommitResult> {
  const repoId = `${owner}/${repo}`;

  try {
    if (options.fetchAll) {
      // Fetch all commits across all pages (server-side batching)
      const result = await fetchAllRepoCommits(
        token,
        owner,
        repo,
        options.since,
        options.until
      );

      const cappedCommits = result.commits.slice(0, options.maxCommits);

      return {
        repoId,
        commits: cappedCommits,
        totalFetched: cappedCommits.length,
        hasMore: result.commits.length > options.maxCommits,
        error: null,
      };
    } else {
      // Fetch a single page
      const result = await fetchRepoCommits(
        token,
        owner,
        repo,
        options.since,
        options.until,
        options.page,
        options.perPage
      );

      return {
        repoId,
        commits: result.commits,
        totalFetched: result.commits.length,
        hasMore: result.pagination.hasMore,
        error: null,
      };
    }
  } catch (error: unknown) {
    const errMessage =
      error instanceof GitHubApiError
        ? `GitHub API error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown error fetching commits';

    return {
      repoId,
      commits: [],
      totalFetched: 0,
      hasMore: false,
      error: errMessage,
    };
  }
}

// =============================================================================
// ROUTE HANDLER: GET /api/github/commits
// =============================================================================

/**
 * API route to fetch commits for a repo or batch of repos.
 *
 * Query parameters:
 * - repos: comma-separated "owner/repo" strings (required)
 * - since: ISO 8601 date (optional)
 * - until: ISO 8601 date (optional)
 * - page: page number for single-repo paginated requests (default: 1)
 * - perPage: items per page, max 100 (default: 30)
 * - fetchAll: "true" to fetch all pages (default: false)
 * - maxCommits: max commits per repo, cap at 50000 (default: 10000)
 *
 * Authentication: reads GitHub token from httpOnly cookie 'github_token'.
 *
 * For batch requests (multiple repos), commits are fetched in parallel chunks
 * of 3 repos at a time to balance speed with rate-limit safety.
 *
 * Rule 21: Reads token from cookie, calls githubApi.fetchRepoCommits with
 * server-side parallel batching. Returns normalized commit data.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<CommitsApiResponseData>>> {
  // -------------------------------------------------------------------------
  // 1. Authenticate — read GitHub token from httpOnly cookie
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get('github_token')?.value;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'GitHub authentication required. Please connect your GitHub account.',
        },
      },
      { status: 401 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Parse and validate query parameters
  // -------------------------------------------------------------------------
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const parseResult = commitsQuerySchema.safeParse(searchParams);

  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
      .join('; ');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid query parameters: ${errorMessages}`,
          details: JSON.stringify(parseResult.error.issues),
        },
      },
      { status: 400 }
    );
  }

  const { repos, since, until, page, perPage, fetchAll, maxCommits } = parseResult.data;

  // -------------------------------------------------------------------------
  // 3. Validate repo strings
  // -------------------------------------------------------------------------
  if (repos.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one repository is required. Format: "owner/repo".',
        },
      },
      { status: 400 }
    );
  }

  if (repos.length > 50) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maximum 50 repositories can be fetched in a single request.',
        },
      },
      { status: 400 }
    );
  }

  const parsedRepos: Array<{ owner: string; repo: string }> = [];
  const invalidRepos: string[] = [];

  for (const repoStr of repos) {
    const parsed = parseRepoString(repoStr);
    if (parsed) {
      parsedRepos.push(parsed);
    } else {
      invalidRepos.push(repoStr);
    }
  }

  if (invalidRepos.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid repository format: ${invalidRepos.join(', ')}. Expected "owner/repo".`,
        },
      },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 4. Fetch commits — parallel batching for multiple repos
  // -------------------------------------------------------------------------
  try {
    const fetchOptions = {
      since,
      until,
      page,
      perPage,
      fetchAll,
      maxCommits,
    };

    let results: RepoCommitResult[];

    if (parsedRepos.length === 1) {
      // Single repo: straightforward fetch
      const { owner, repo } = parsedRepos[0];
      const result = await fetchSingleRepoCommits(token, owner, repo, fetchOptions);
      results = [result];
    } else {
      // Multiple repos: parallel batching in chunks of 3 to avoid rate limits
      // GitHub rate limit is 5000 req/hour for authenticated users.
      // Each "fetchAll" can consume 10-100+ requests depending on repo size.
      // Chunks of 3 keep concurrency reasonable.
      const PARALLEL_CHUNK_SIZE = 3;
      const repoChunks = chunk(parsedRepos, PARALLEL_CHUNK_SIZE);

      results = [];

      for (const repoChunk of repoChunks) {
        const chunkResults = await Promise.all(
          repoChunk.map(({ owner, repo }) =>
            fetchSingleRepoCommits(token, owner, repo, fetchOptions)
          )
        );
        results.push(...chunkResults);

        // Small delay between chunks to be kind to GitHub's rate limiter
        // Only needed when fetching all commits across many repos
        if (fetchAll && repoChunks.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Aggregate and return results
    // -----------------------------------------------------------------------
    const totalCommits = results.reduce((sum, r) => sum + r.totalFetched, 0);
    const hasErrors = results.some((r) => r.error !== null);

    // Check if ALL repos errored
    const allErrored = results.every((r) => r.error !== null);

    if (allErrored) {
      // All repos failed — determine the most appropriate error status
      const firstError = results[0].error || 'Unknown error';
      const isRateLimit = results.some(
        (r) => r.error?.includes('403') || r.error?.toLowerCase().includes('rate limit')
      );
      const isNotFound = results.some(
        (r) => r.error?.includes('404')
      );

      const statusCode = isRateLimit ? 429 : isNotFound ? 404 : 502;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isRateLimit
              ? 'RATE_LIMITED'
              : isNotFound
                ? 'NOT_FOUND'
                : 'FETCH_FAILED',
            message: isRateLimit
              ? 'GitHub API rate limit exceeded. Please wait before retrying.'
              : `Failed to fetch commits for all repositories. First error: ${firstError}`,
            details: JSON.stringify(
              results.map((r) => ({ repoId: r.repoId, error: r.error }))
            ),
          },
        },
        {
          status: statusCode,
          headers: isRateLimit
            ? { 'Retry-After': '60' }
            : undefined,
        }
      );
    }

    // Build pagination info for single-repo, single-page requests
    let pagination: GitHubPagination | undefined;
    if (parsedRepos.length === 1 && !fetchAll) {
      const singleResult = results[0];
      pagination = {
        page,
        perPage,
        totalPages: null, // GitHub doesn't always provide this
        hasMore: singleResult.hasMore,
        links: {
          next: singleResult.hasMore
            ? buildNextPageUrl(request.nextUrl, page + 1)
            : null,
          prev: page > 1 ? buildNextPageUrl(request.nextUrl, page - 1) : null,
          last: null,
          first: page > 1 ? buildNextPageUrl(request.nextUrl, 1) : null,
        },
      };
    }

    const responseData: CommitsApiResponseData = {
      results,
      totalCommits,
      repoCount: parsedRepos.length,
      fetchedAt: Date.now(),
    };

    // Return 207 Multi-Status if some repos succeeded and some failed
    const statusCode = hasErrors ? 207 : 200;

    return NextResponse.json(
      {
        success: !hasErrors,
        data: responseData,
        pagination,
        ...(hasErrors && {
          error: {
            code: 'PARTIAL_FAILURE',
            message: `Some repositories failed to fetch. ${results.filter((r) => r.error).length}/${results.length} repos had errors.`,
            details: JSON.stringify(
              results
                .filter((r) => r.error)
                .map((r) => ({ repoId: r.repoId, error: r.error }))
            ),
          },
        }),
      },
      { status: statusCode }
    );
  } catch (error: unknown) {
    // -----------------------------------------------------------------------
    // 6. Global error handling
    // -----------------------------------------------------------------------
    if (error instanceof GitHubApiError) {
      const isRateLimit = error.status === 403 || error.status === 429;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isRateLimit ? 'RATE_LIMITED' : 'GITHUB_API_ERROR',
            message: error.message,
            details: `HTTP ${error.status}`,
          },
          ...(isRateLimit && error.retryAfter
            ? {
                rateLimit: {
                  remaining: 0,
                  limit: 5000,
                  resetAt: Math.floor(Date.now() / 1000) + (error.retryAfter ?? 60),
                  isLimited: true,
                } satisfies GitHubRateLimit,
              }
            : undefined),
        },
        {
          status: isRateLimit ? 429 : error.status >= 500 ? 502 : error.status,
          headers: isRateLimit
            ? { 'Retry-After': String(error.retryAfter ?? 60) }
            : undefined,
        }
      );
    }

    console.error('[API /api/github/commits] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching commits.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST HANDLER — for large batch requests with body payload
// =============================================================================

const postBodySchema = z.object({
  repos: z
    .array(
      z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
      })
    )
    .min(1)
    .max(50),
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
  fetchAll: z.boolean().default(true),
  maxCommitsPerRepo: z.number().int().positive().max(50000).default(10000),
});

/**
 * POST handler for batch commit fetching.
 * Accepts a JSON body with an array of repo objects instead of
 * comma-separated query params. Better for large batch operations.
 *
 * Body:
 * {
 *   "repos": [{ "owner": "...", "repo": "..." }, ...],
 *   "since": "ISO date (optional)",
 *   "until": "ISO date (optional)",
 *   "fetchAll": true,
 *   "maxCommitsPerRepo": 10000
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CommitsApiResponseData>>> {
  // -------------------------------------------------------------------------
  // 1. Authenticate
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get('github_token')?.value;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'GitHub authentication required. Please connect your GitHub account.',
        },
      },
      { status: 401 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Parse and validate request body
  // -------------------------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      },
      { status: 400 }
    );
  }

  const parseResult = postBodySchema.safeParse(body);

  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
      .join('; ');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid request body: ${errorMessages}`,
          details: JSON.stringify(parseResult.error.issues),
        },
      },
      { status: 400 }
    );
  }

  const { repos, since, until, fetchAll, maxCommitsPerRepo } = parseResult.data;

  // -------------------------------------------------------------------------
  // 3. Fetch commits in parallel chunks
  // -------------------------------------------------------------------------
  try {
    const PARALLEL_CHUNK_SIZE = 3;
    const repoChunks = chunk(repos, PARALLEL_CHUNK_SIZE);
    const results: RepoCommitResult[] = [];

    for (const repoChunk of repoChunks) {
      const chunkResults = await Promise.all(
        repoChunk.map(({ owner, repo }) =>
          fetchSingleRepoCommits(token, owner, repo, {
            since,
            until,
            page: 1,
            perPage: 100,
            fetchAll,
            maxCommits: maxCommitsPerRepo,
          })
        )
      );
      results.push(...chunkResults);

      // Delay between chunks when doing exhaustive fetches
      if (fetchAll && repoChunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // -----------------------------------------------------------------------
    // 4. Aggregate results
    // -----------------------------------------------------------------------
    const totalCommits = results.reduce((sum, r) => sum + r.totalFetched, 0);
    const hasErrors = results.some((r) => r.error !== null);
    const allErrored = results.every((r) => r.error !== null);

    if (allErrored) {
      const isRateLimit = results.some(
        (r) => r.error?.includes('403') || r.error?.toLowerCase().includes('rate limit')
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isRateLimit ? 'RATE_LIMITED' : 'FETCH_FAILED',
            message: isRateLimit
              ? 'GitHub API rate limit exceeded. Please wait before retrying.'
              : 'Failed to fetch commits for all repositories.',
            details: JSON.stringify(
              results.map((r) => ({ repoId: r.repoId, error: r.error }))
            ),
          },
        },
        {
          status: isRateLimit ? 429 : 502,
          headers: isRateLimit ? { 'Retry-After': '60' } : undefined,
        }
      );
    }

    const responseData: CommitsApiResponseData = {
      results,
      totalCommits,
      repoCount: repos.length,
      fetchedAt: Date.now(),
    };

    const statusCode = hasErrors ? 207 : 200;

    return NextResponse.json(
      {
        success: !hasErrors,
        data: responseData,
        ...(hasErrors && {
          error: {
            code: 'PARTIAL_FAILURE',
            message: `${results.filter((r) => r.error).length}/${results.length} repositories had errors.`,
            details: JSON.stringify(
              results
                .filter((r) => r.error)
                .map((r) => ({ repoId: r.repoId, error: r.error }))
            ),
          },
        }),
      },
      { status: statusCode }
    );
  } catch (error: unknown) {
    if (error instanceof GitHubApiError) {
      const isRateLimit = error.status === 403 || error.status === 429;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isRateLimit ? 'RATE_LIMITED' : 'GITHUB_API_ERROR',
            message: error.message,
          },
        },
        {
          status: isRateLimit ? 429 : error.status >= 500 ? 502 : error.status,
          headers: isRateLimit
            ? { 'Retry-After': String(error.retryAfter ?? 60) }
            : undefined,
        }
      );
    }

    console.error('[API POST /api/github/commits] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching commits.',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Build a URL for the next/prev page link.
 */
function buildNextPageUrl(currentUrl: URL, targetPage: number): string {
  const newUrl = new URL(currentUrl.toString());
  newUrl.searchParams.set('page', String(targetPage));
  return newUrl.pathname + newUrl.search;
}
