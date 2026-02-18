import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchUserRepos, searchUserRepos } from '@/lib/github-api';
import { GitHubApiError } from '@/lib/github-api';
import type {
  ApiResponse,
  Repository,
  GitHubPagination,
  GitHubRateLimit,
  RepoSortOption,
} from '@/lib/types';

// =============================================================================
// Request validation schema
// =============================================================================

const querySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  per_page: z
    .string()
    .optional()
    .default('30')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1) return 30;
      return Math.min(num, 100); // GitHub API max is 100
    }),
  search: z.string().optional().default(''),
  sort: z
    .enum(['name-asc', 'name-desc', 'stars-desc', 'updated-desc', 'commits-desc', 'created', 'updated', 'pushed', 'full_name'])
    .optional()
    .default('updated-desc'),
  direction: z.enum(['asc', 'desc']).optional().default('desc'),
  type: z
    .enum(['all', 'owner', 'public', 'private', 'member'])
    .optional(),
  affiliation: z.string().optional(),
  visibility: z.enum(['all', 'public', 'private']).optional().default('all'),
  include_forks: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
  include_archived: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
  language: z.string().optional().default(''),
});

type ValidatedQuery = z.infer<typeof querySchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract GitHub token from the request.
 * Checks the httpOnly cookie first (set by /api/github/callback per Rule 13),
 * then falls back to Authorization header for direct API usage.
 */
function extractGitHubToken(request: NextRequest): string | null {
  // Primary: httpOnly cookie set by OAuth callback (Rule 13)
  const cookieToken = request.cookies.get('github_token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback: Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Fallback: X-GitHub-Token custom header
  const customHeader = request.headers.get('x-github-token');
  if (customHeader) {
    return customHeader.trim();
  }

  return null;
}

/**
 * Map our app's sort option to GitHub API sort parameters.
 */
type GitHubRepoSort = 'created' | 'updated' | 'pushed' | 'full_name';

function mapSortToGitHubParams(sort: string): { sort: GitHubRepoSort; direction: 'asc' | 'desc' } {
  switch (sort) {
    case 'name-asc':
      return { sort: 'full_name', direction: 'asc' };
    case 'name-desc':
      return { sort: 'full_name', direction: 'desc' };
    case 'stars-desc':
      // GitHub /user/repos doesn't support sort by stars; fall back to updated
      return { sort: 'updated', direction: 'desc' };
    case 'updated-desc':
      return { sort: 'updated', direction: 'desc' };
    case 'commits-desc':
      // GitHub doesn't support sort by commits; fall back to pushed (most recently active)
      return { sort: 'pushed', direction: 'desc' };
    case 'created':
      return { sort: 'created', direction: 'desc' };
    case 'updated':
      return { sort: 'updated', direction: 'desc' };
    case 'pushed':
      return { sort: 'pushed', direction: 'desc' };
    case 'full_name':
      return { sort: 'full_name', direction: 'asc' };
    default:
      return { sort: 'updated', direction: 'desc' };
  }
}

/**
 * Apply client-side filtering that GitHub API doesn't natively support.
 */
function applyClientFilters(
  repos: Repository[],
  query: ValidatedQuery
): Repository[] {
  let filtered = repos;

  // Filter by visibility
  if (query.visibility === 'public') {
    filtered = filtered.filter((r) => !r.isPrivate);
  } else if (query.visibility === 'private') {
    filtered = filtered.filter((r) => r.isPrivate);
  }

  // Filter forks
  if (!query.include_forks) {
    filtered = filtered.filter((r) => !r.isFork);
  }

  // Filter archived
  if (!query.include_archived) {
    filtered = filtered.filter((r) => !r.isArchived);
  }

  // Filter by language
  if (query.language) {
    const lang = query.language.toLowerCase();
    filtered = filtered.filter(
      (r) => r.language?.toLowerCase() === lang
    );
  }

  return filtered;
}

/**
 * Build a typed API response following the ApiResponse<T> interface.
 */
function buildSuccessResponse(
  repos: Repository[],
  pagination: GitHubPagination,
  rateLimit: GitHubRateLimit
): ApiResponse<Repository[]> {
  return {
    success: true,
    data: repos,
    pagination,
    rateLimit,
  };
}

function buildErrorResponse(
  code: string,
  message: string,
  details?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// =============================================================================
// GET /api/github/repos
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Repository[]>>> {
  // 1. Extract token (Rule 13, Rule 21)
  const token = extractGitHubToken(request);

  if (!token) {
    return NextResponse.json(
      buildErrorResponse(
        'UNAUTHORIZED',
        'GitHub authentication required. Please connect your GitHub account.',
        'No valid GitHub token found in cookies or Authorization header.'
      ),
      { status: 401 }
    );
  }

  // 2. Parse and validate query parameters
  const { searchParams } = request.nextUrl;
  const rawQuery: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    rawQuery[key] = value;
  }

  const parseResult = querySchema.safeParse(rawQuery);

  if (!parseResult.success) {
    const validationErrors = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    return NextResponse.json(
      buildErrorResponse(
        'VALIDATION_ERROR',
        'Invalid query parameters.',
        validationErrors
      ),
      { status: 400 }
    );
  }

  const query = parseResult.data;

  try {
    // 3. Branch: search query vs. standard list
    if (query.search && query.search.trim().length > 0) {
      // Use GitHub search API for text-based repo search
      const searchResult = await searchUserRepos(
        token,
        query.search.trim(),
        query.page,
        query.per_page
      );

      // Apply client-side filters that search API doesn't handle
      const filteredRepos = applyClientFilters(searchResult.repos, query);

      // Build pagination info for search results
      const totalFiltered = filteredRepos.length;
      const totalPages = Math.ceil(searchResult.totalCount / query.per_page);

      const pagination: GitHubPagination = {
        page: query.page,
        perPage: query.per_page,
        totalPages,
        hasMore: query.page < totalPages,
        links: {
          next: query.page < totalPages
            ? buildPaginationUrl(request.nextUrl, query.page + 1)
            : null,
          prev: query.page > 1
            ? buildPaginationUrl(request.nextUrl, query.page - 1)
            : null,
          first: buildPaginationUrl(request.nextUrl, 1),
          last: totalPages > 0
            ? buildPaginationUrl(request.nextUrl, totalPages)
            : null,
        },
      };

      return NextResponse.json(
        buildSuccessResponse(filteredRepos, pagination, searchResult.rateLimit),
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
            'X-RateLimit-Remaining': String(searchResult.rateLimit.remaining),
            'X-RateLimit-Limit': String(searchResult.rateLimit.limit),
            'X-RateLimit-Reset': String(searchResult.rateLimit.resetAt),
          },
        }
      );
    }

    // 4. Standard paginated repo listing via fetchUserRepos
    const { sort: ghSort, direction: ghDirection } = mapSortToGitHubParams(query.sort);

    const result = await fetchUserRepos(token, {
      page: query.page,
      perPage: query.per_page,
      sort: ghSort,
      direction: ghDirection,
      ...(query.affiliation
        ? { affiliation: query.affiliation }
        : query.type
          ? { type: query.type as 'all' | 'owner' | 'public' | 'private' | 'member' }
          : { affiliation: 'owner,collaborator,organization_member' }),
    });

    // Apply client-side filters
    const filteredRepos = applyClientFilters(result.repos, query);

    // Re-sort client-side if using app-specific sort options
    const sortedRepos = applySorting(filteredRepos, query.sort);

    // Build pagination from the GitHub API response
    const pagination: GitHubPagination = {
      page: result.pagination.page,
      perPage: result.pagination.perPage,
      totalPages: result.pagination.totalPages,
      hasMore: result.pagination.hasMore,
      links: {
        next: result.pagination.hasMore
          ? buildPaginationUrl(request.nextUrl, result.pagination.page + 1)
          : null,
        prev: result.pagination.page > 1
          ? buildPaginationUrl(request.nextUrl, result.pagination.page - 1)
          : null,
        first: buildPaginationUrl(request.nextUrl, 1),
        last: result.pagination.totalPages
          ? buildPaginationUrl(request.nextUrl, result.pagination.totalPages)
          : null,
      },
    };

    return NextResponse.json(
      buildSuccessResponse(sortedRepos, pagination, result.rateLimit),
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          'X-RateLimit-Remaining': String(result.rateLimit.remaining),
          'X-RateLimit-Limit': String(result.rateLimit.limit),
          'X-RateLimit-Reset': String(result.rateLimit.resetAt),
        },
      }
    );
  } catch (error: unknown) {
    // 5. Error handling chain (Rule 17)
    if (error instanceof GitHubApiError) {
      const status = error.status;

      // Rate limit error — include retryAfter for countdown timer (Rule 17)
      if (status === 403 || status === 429) {
        const retryAfter = error.retryAfter ?? 60;

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'GitHub API rate limit exceeded. Please wait before retrying.',
              details: `Retry after ${retryAfter} seconds.`,
            },
            rateLimit: {
              remaining: 0,
              limit: 5000,
              resetAt: Math.floor(Date.now() / 1000) + retryAfter,
              isLimited: true,
            },
          } satisfies ApiResponse<never>,
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + retryAfter),
            },
          }
        );
      }

      // Unauthorized — token expired or revoked
      if (status === 401) {
        return NextResponse.json(
          buildErrorResponse(
            'TOKEN_EXPIRED',
            'Your GitHub token has expired or been revoked. Please reconnect your GitHub account.',
            error.message
          ),
          {
            status: 401,
            headers: {
              // Clear the invalid cookie so AuthProvider can detect disconnection
              'Set-Cookie': 'github_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
            },
          }
        );
      }

      // Not Found
      if (status === 404) {
        return NextResponse.json(
          buildErrorResponse(
            'NOT_FOUND',
            'The requested resource was not found on GitHub.',
            error.message
          ),
          { status: 404 }
        );
      }

      // Server error from GitHub
      if (status >= 500) {
        return NextResponse.json(
          buildErrorResponse(
            'GITHUB_SERVER_ERROR',
            'GitHub is experiencing issues. Please try again later.',
            error.message
          ),
          { status: 502 }
        );
      }

      // Other GitHub API errors
      return NextResponse.json(
        buildErrorResponse(
          'GITHUB_API_ERROR',
          error.message || 'An error occurred while fetching repositories from GitHub.',
          `Status: ${status}`
        ),
        { status: Math.min(status, 599) }
      );
    }

    // Unknown / unexpected errors
    console.error('[API /api/github/repos] Unexpected error:', error);

    return NextResponse.json(
      buildErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred while fetching repositories.',
        error instanceof Error ? error.message : 'Unknown error'
      ),
      { status: 500 }
    );
  }
}

// =============================================================================
// Helpers for pagination URL building
// =============================================================================

function buildPaginationUrl(baseUrl: URL, page: number): string {
  const url = new URL(baseUrl.toString());
  url.searchParams.set('page', String(page));
  return url.pathname + url.search;
}

// =============================================================================
// Client-side sorting for app-specific sort options
// =============================================================================

function applySorting(repos: Repository[], sort: string): Repository[] {
  const sorted = [...repos];

  switch (sort) {
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'stars-desc':
      sorted.sort((a, b) => b.starCount - a.starCount);
      break;
    case 'updated-desc':
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      break;
    case 'commits-desc':
      // Sort by commitCount if available, fall back to pushedAt
      sorted.sort((a, b) => {
        const aCount = a.commitCount ?? 0;
        const bCount = b.commitCount ?? 0;
        if (aCount !== bCount) return bCount - aCount;
        return (
          new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
        );
      });
      break;
    default:
      // Already sorted by GitHub API
      break;
  }

  return sorted;
}
