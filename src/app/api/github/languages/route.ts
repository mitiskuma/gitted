import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { fetchRepoLanguages, GitHubApiError } from '@/lib/github-api';
import type { ApiResponse } from '@/lib/types';

const querySchema = z.object({
  repo: z
    .string()
    .min(1)
    .refine((val) => val.includes('/'), 'Must be in "owner/repo" format'),
});

/**
 * GET /api/github/languages?repo=owner/repo
 *
 * Fetches language breakdown for a single repository.
 * Returns Record<string, number> mapping language names to bytes.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ languages: Record<string, number> }>>> {
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
    const result = await fetchRepoLanguages(token, owner, repo);
    return NextResponse.json({
      success: true,
      data: { languages: result.languages },
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
          message: 'Failed to fetch language data.',
        },
      },
      { status: 500 }
    );
  }
}
