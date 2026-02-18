import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { fetchRepoStats, GitHubApiError } from '@/lib/github-api';
import type { ApiResponse } from '@/lib/types';

const querySchema = z.object({
  repo: z
    .string()
    .min(1)
    .refine((val) => val.includes('/'), 'Must be in "owner/repo" format'),
});

interface StatsResponseData {
  totalAdditions: number;
  totalDeletions: number;
  contributorStats: Array<{
    login: string;
    avatarUrl: string;
    totalCommits: number;
    totalAdditions: number;
    totalDeletions: number;
  }>;
}

/**
 * GET /api/github/stats?repo=owner/repo
 *
 * Fetches contributor stats (additions/deletions) for a repository.
 * Uses GitHub's /repos/{owner}/{repo}/stats/contributors endpoint.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<StatsResponseData>>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('github_token')?.value;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'GitHub authentication required.',
        },
      },
      { status: 401 }
    );
  }

  const rawParams = {
    repo: request.nextUrl.searchParams.get('repo') || '',
  };

  const parseResult = querySchema.safeParse(rawParams);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid repo parameter. Expected "owner/repo".',
        },
      },
      { status: 400 }
    );
  }

  const [owner, repo] = parseResult.data.repo.split('/');

  try {
    const result = await fetchRepoStats(token, owner, repo);

    const totalAdditions = result.stats.contributorStats.reduce(
      (sum, c) => sum + c.totalAdditions,
      0
    );
    const totalDeletions = result.stats.contributorStats.reduce(
      (sum, c) => sum + c.totalDeletions,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        totalAdditions,
        totalDeletions,
        contributorStats: result.stats.contributorStats,
      },
    });
  } catch (error: unknown) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GITHUB_API_ERROR',
            message: error.message,
          },
        },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch repository stats.',
        },
      },
      { status: 500 }
    );
  }
}
