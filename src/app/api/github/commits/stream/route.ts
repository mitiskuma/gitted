import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import {
  fetchAllRepoCommits,
  getRateLimit,
} from '@/lib/github-api';
import { GitHubApiError } from '@/lib/github-api';
import type { CommitData } from '@/lib/types';

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

const streamBodySchema = z.object({
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

// =============================================================================
// ADAPTIVE CONCURRENCY
// =============================================================================

function getAdaptiveChunkSize(): number {
  const rateLimit = getRateLimit();
  if (rateLimit.remaining < 50) return 1;
  if (rateLimit.remaining < 200) return 2;
  return 5;
}

// =============================================================================
// ROUTE HANDLER: POST /api/github/commits/stream
// =============================================================================

/**
 * Streaming NDJSON endpoint for commit fetching.
 * Each line is a complete JSON object for one repo's results:
 *   {"repoId":"owner/repo","commits":[...],"totalFetched":N,"error":null}\n
 *
 * Results are streamed as soon as each repo finishes, so the client
 * can start rendering before all repos complete.
 */
export async function POST(request: NextRequest): Promise<Response> {
  // 1. Authenticate
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

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      },
      { status: 400 }
    );
  }

  const parseResult = streamBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid request body: ${parseResult.error.message}`,
        },
      },
      { status: 400 }
    );
  }

  const { repos, since, until, maxCommitsPerRepo } = parseResult.data;

  // 3. Create streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const remaining = [...repos];

      while (remaining.length > 0) {
        const chunkSize = getAdaptiveChunkSize();
        const batch = remaining.splice(0, chunkSize);

        // Fetch batch in parallel
        const results = await Promise.allSettled(
          batch.map(async ({ owner, repo }) => {
            const repoId = `${owner}/${repo}`;
            try {
              const result = await fetchAllRepoCommits(
                token,
                owner,
                repo,
                since,
                until
              );

              const cappedCommits: CommitData[] = result.commits.slice(0, maxCommitsPerRepo);

              return {
                repoId,
                commits: cappedCommits,
                totalFetched: cappedCommits.length,
                error: null as string | null,
              };
            } catch (error: unknown) {
              const errMessage =
                error instanceof GitHubApiError
                  ? `GitHub API error (${error.status}): ${error.message}`
                  : error instanceof Error
                    ? error.message
                    : 'Unknown error';

              return {
                repoId,
                commits: [] as CommitData[],
                totalFetched: 0,
                error: errMessage,
              };
            }
          })
        );

        // Stream each result as an NDJSON line
        for (const result of results) {
          const data =
            result.status === 'fulfilled'
              ? result.value
              : {
                  repoId: 'unknown',
                  commits: [],
                  totalFetched: 0,
                  error: result.reason?.message ?? 'Promise rejected',
                };

          const line = JSON.stringify(data) + '\n';
          controller.enqueue(encoder.encode(line));
        }

        // Small delay between batches
        if (remaining.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
