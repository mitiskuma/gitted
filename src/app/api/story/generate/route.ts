import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  CommitSummaryBatch,
  CommitData,
  GeneratedStory,
  ApiResponse,
  ClaudeStreamChunk,
  DateRange,
} from '@/lib/types';
import { StoryPhase } from '@/lib/types';
import {
  generateRepoStory,
  generateUnifiedStory,
  generateRepoStoryStreaming,
  prepareCommitsForClaude,
  ClaudeApiError,
} from '@/lib/claude-api';

// =============================================================================
// REQUEST VALIDATION SCHEMAS
// =============================================================================

const RepoMetaSchema = z.object({
  name: z.string().min(1),
  fullName: z.string().min(1),
  description: z.string().nullable(),
  language: z.string().nullable(),
  languages: z.record(z.string(), z.number()).default({}),
  starCount: z.number().default(0),
  createdAt: z.string(),
  topics: z.array(z.string()).default([]),
  isPrivate: z.boolean().default(false),
  defaultBranch: z.string().default('main'),
});

const CommitSummaryBatchSchema = z.object({
  repoId: z.string(),
  repoName: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string(),
    totalDays: z.number(),
  }),
  commitCount: z.number(),
  messageSummary: z.string(),
  keyFilesChanged: z.array(z.string()),
  netAdditions: z.number(),
  netDeletions: z.number(),
  contributors: z.array(z.string()),
  patterns: z.array(z.string()),
});

const SingleRepoRequestSchema = z.object({
  type: z.literal('single'),
  repoMeta: RepoMetaSchema,
  commitSummaries: z.array(CommitSummaryBatchSchema).min(1),
  stream: z.boolean().default(false),
});

const UnifiedRequestSchema = z.object({
  type: z.literal('unified'),
  repos: z.array(
    z.object({
      repoMeta: RepoMetaSchema,
      commitSummaries: z.array(CommitSummaryBatchSchema).min(1),
    })
  ).min(1),
  stream: z.boolean().default(false),
});

const RawCommitsRequestSchema = z.object({
  type: z.literal('raw'),
  repoMeta: RepoMetaSchema,
  commits: z.array(
    z.object({
      sha: z.string(),
      shortSha: z.string(),
      message: z.string(),
      messageHeadline: z.string(),
      author: z.object({
        name: z.string(),
        email: z.string(),
        login: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }),
      timestamp: z.string(),
      timestampMs: z.number(),
      repoId: z.string(),
      repoName: z.string(),
      additions: z.number(),
      deletions: z.number(),
      totalChanges: z.number(),
      filesChanged: z.number(),
      isMerge: z.boolean(),
      files: z.array(z.any()).default([]),
      parents: z.array(z.string()).default([]),
      htmlUrl: z.string().default(''),
      hourOfDay: z.number(),
      dayOfWeek: z.number(),
      year: z.number(),
      month: z.number(),
      dayOfMonth: z.number(),
      weekOfYear: z.number(),
      dateKey: z.string(),
    })
  ).min(1),
  stream: z.boolean().default(false),
});

const StoryRequestSchema = z.discriminatedUnion('type', [
  SingleRepoRequestSchema,
  UnifiedRequestSchema,
  RawCommitsRequestSchema,
]);

type StoryRequest = z.infer<typeof StoryRequestSchema>;

// =============================================================================
// AUTH HELPERS
// =============================================================================

function extractClaudeToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

  const token = parts[1].trim();
  if (!token || token.length < 10) return null;

  return token;
}

// =============================================================================
// STREAMING RESPONSE HELPERS
// =============================================================================

interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

function formatSSE(event: StreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function createStreamingResponse(
  generateFn: (
    writer: WritableStreamDefaultWriter<Uint8Array>,
    encoder: TextEncoder
  ) => Promise<void>
): Response {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Run the generation in the background
  generateFn(writer, encoder)
    .catch(async (error) => {
      const errorEvent: StreamEvent = {
        event: 'error',
        data: {
          code: error instanceof ClaudeApiError ? error.code : 'GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error during generation',
          retryAfter: error instanceof ClaudeApiError ? error.retryAfter : null,
        },
      };
      try {
        await writer.write(encoder.encode(formatSSE(errorEvent)));
      } catch {
        // Writer may be closed
      }
    })
    .finally(async () => {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// =============================================================================
// SINGLE REPO STORY GENERATION (STREAMING)
// =============================================================================

async function handleSingleRepoStreaming(
  claudeToken: string,
  repoMeta: z.infer<typeof RepoMetaSchema>,
  commitSummaries: CommitSummaryBatch[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  // Phase 1: Acknowledge and start
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.BATCHING_COMMITS,
          progress: 5,
          message: `Processing ${commitSummaries.length} commit batches for ${repoMeta.name}...`,
        },
      })
    )
  );

  // Phase 2: Summarizing (the batches are already summarized, but communicate progress)
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.SUMMARIZING,
          progress: 20,
          message: `Summarizing ${commitSummaries.reduce((sum, b) => sum + b.commitCount, 0)} commits across ${commitSummaries.length} time periods...`,
        },
      })
    )
  );

  // Phase 3: Generating narrative via streaming
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.GENERATING_NARRATIVE,
          progress: 30,
          message: 'Generating your repository story with Claude...',
        },
      })
    )
  );

  let accumulatedText = '';
  let chunkCount = 0;

  const story = await generateRepoStoryStreaming(
    claudeToken,
    commitSummaries as CommitSummaryBatch[],
    repoMeta,
    async (chunk: ClaudeStreamChunk) => {
      if (chunk.text) {
        accumulatedText += chunk.text;
        chunkCount++;

        // Send text chunks periodically (every ~5 chunks to reduce overhead)
        if (chunkCount % 5 === 0 || chunk.isFinal) {
          const progress = Math.min(30 + (chunkCount * 0.5), 85);
          await writer.write(
            encoder.encode(
              formatSSE({
                event: 'chunk',
                data: {
                  text: chunk.text,
                  progress,
                  totalLength: accumulatedText.length,
                },
              })
            )
          );
        }
      }

      if (chunk.isFinal) {
        await writer.write(
          encoder.encode(
            formatSSE({
              event: 'phase',
              data: {
                phase: StoryPhase.EXTRACTING_MILESTONES,
                progress: 90,
                message: 'Extracting milestones and structuring chapters...',
              },
            })
          )
        );
      }
    }
  );

  // Phase 4: Complete
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.COMPLETE,
          progress: 100,
          message: 'Story generation complete!',
        },
      })
    )
  );

  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'complete',
        data: {
          story: {
            id: story.id,
            type: story.type,
            repoId: story.repoId,
            title: story.title,
            subtitle: story.subtitle,
            content: story.content,
            chapters: story.chapters,
            milestones: story.milestones,
            generatedAt: story.generatedAt,
            dateRange: story.dateRange,
            model: story.model,
          },
        },
      })
    )
  );
}

// =============================================================================
// UNIFIED STORY GENERATION (STREAMING)
// =============================================================================

async function handleUnifiedStreaming(
  claudeToken: string,
  repos: Array<{
    repoMeta: z.infer<typeof RepoMetaSchema>;
    commitSummaries: CommitSummaryBatch[];
  }>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  const totalRepos = repos.length;
  const totalCommits = repos.reduce(
    (sum, r) => sum + r.commitSummaries.reduce((s, b) => s + b.commitCount, 0),
    0
  );

  // Phase 1: Batching
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.BATCHING_COMMITS,
          progress: 5,
          message: `Processing ${totalCommits} commits across ${totalRepos} repositories...`,
          totalRepos,
          totalCommits,
        },
      })
    )
  );

  // Phase 2: Summarizing
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.SUMMARIZING,
          progress: 15,
          message: `Preparing commit summaries for ${totalRepos} repositories...`,
          reposProcessed: 0,
          totalRepos,
        },
      })
    )
  );

  // Build the summaries array for generateUnifiedStory
  const allRepoSummaries: Array<{
    repoMeta: z.infer<typeof RepoMetaSchema>;
    summary: CommitSummaryBatch[];
  }> = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    allRepoSummaries.push({
      repoMeta: repo.repoMeta,
      summary: repo.commitSummaries as CommitSummaryBatch[],
    });

    const progress = 15 + ((i + 1) / totalRepos) * 15;
    await writer.write(
      encoder.encode(
        formatSSE({
          event: 'phase',
          data: {
            phase: StoryPhase.SUMMARIZING,
            progress: Math.round(progress),
            message: `Prepared summaries for ${repo.repoMeta.name} (${i + 1}/${totalRepos})`,
            reposProcessed: i + 1,
            totalRepos,
          },
        })
      )
    );
  }

  // Phase 3: Generating unified narrative
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.GENERATING_NARRATIVE,
          progress: 35,
          message: 'Weaving your unified developer journey with Claude...',
        },
      })
    )
  );

  // generateUnifiedStory does its own progressive summarization internally
  // (Rule 7: For repos with 1000+ commits, commit-processor.ts MUST summarize)
  const story = await generateUnifiedStory(claudeToken, allRepoSummaries);

  // Phase 4: Extracting milestones
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.EXTRACTING_MILESTONES,
          progress: 90,
          message: `Extracted ${story.milestones.length} milestones across ${story.chapters.length} chapters`,
        },
      })
    )
  );

  // Phase 5: Complete
  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'phase',
        data: {
          phase: StoryPhase.COMPLETE,
          progress: 100,
          message: 'Unified story generation complete!',
        },
      })
    )
  );

  await writer.write(
    encoder.encode(
      formatSSE({
        event: 'complete',
        data: {
          story: {
            id: story.id,
            type: story.type,
            repoId: story.repoId,
            title: story.title,
            subtitle: story.subtitle,
            content: story.content,
            chapters: story.chapters,
            milestones: story.milestones,
            generatedAt: story.generatedAt,
            dateRange: story.dateRange,
            model: story.model,
          },
        },
      })
    )
  );
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  // Step 1: Validate Claude token from Authorization header (Rule 7)
  const claudeToken = extractClaudeToken(request);

  if (!claudeToken) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Missing or invalid Claude API token. Provide a valid Bearer token in the Authorization header.',
        },
      },
      { status: 401 }
    );
  }

  // Step 2: Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
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

  const parseResult = StoryRequestSchema.safeParse(body);

  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body.',
          details: issues,
        },
      },
      { status: 400 }
    );
  }

  const requestData = parseResult.data;

  try {
    // =======================================================================
    // HANDLE RAW COMMITS: Batch them first, then treat as single repo request
    // Rule 7: For repos with 1000+ commits, commits MUST be batched in groups of ~100
    // =======================================================================
    if (requestData.type === 'raw') {
      const { repoMeta, commits, stream } = requestData;

      // Batch the raw commits into CommitSummaryBatch[] using commit-processor logic
      // prepareCommitsForClaude handles the batching (groups of ~100)
      const batches = prepareCommitsForClaude(
        commits as unknown as CommitData[],
        repoMeta.fullName,
        repoMeta.name
      );

      if (stream) {
        return createStreamingResponse(async (writer, encoder) => {
          await writer.write(
            encoder.encode(
              formatSSE({
                event: 'phase',
                data: {
                  phase: StoryPhase.BATCHING_COMMITS,
                  progress: 5,
                  message: `Batched ${commits.length} raw commits into ${batches.length} summary groups...`,
                },
              })
            )
          );
          await handleSingleRepoStreaming(claudeToken, repoMeta, batches, writer, encoder);
        });
      }

      // Non-streaming: generate directly
      const story = await generateRepoStory(claudeToken, batches, repoMeta);

      return NextResponse.json<ApiResponse<GeneratedStory>>(
        {
          success: true,
          data: story,
        },
        { status: 200 }
      );
    }

    // =======================================================================
    // HANDLE SINGLE REPO WITH PRE-BATCHED SUMMARIES
    // =======================================================================
    if (requestData.type === 'single') {
      const { repoMeta, commitSummaries, stream } = requestData;

      if (stream) {
        return createStreamingResponse(async (writer, encoder) => {
          await handleSingleRepoStreaming(
            claudeToken,
            repoMeta,
            commitSummaries as CommitSummaryBatch[],
            writer,
            encoder
          );
        });
      }

      // Non-streaming: generate the story directly
      const story = await generateRepoStory(
        claudeToken,
        commitSummaries as CommitSummaryBatch[],
        repoMeta
      );

      return NextResponse.json<ApiResponse<GeneratedStory>>(
        {
          success: true,
          data: story,
        },
        { status: 200 }
      );
    }

    // =======================================================================
    // HANDLE UNIFIED STORY (multiple repos)
    // Rule 6: Story generation chain — batched summaries sent to this route
    // =======================================================================
    if (requestData.type === 'unified') {
      const { repos, stream } = requestData;

      if (stream) {
        return createStreamingResponse(async (writer, encoder) => {
          await handleUnifiedStreaming(
            claudeToken,
            repos.map((r) => ({
              repoMeta: r.repoMeta,
              commitSummaries: r.commitSummaries as CommitSummaryBatch[],
            })),
            writer,
            encoder
          );
        });
      }

      // Non-streaming: build summaries and generate
      const allRepoSummaries = repos.map((r) => ({
        repoMeta: r.repoMeta,
        summary: r.commitSummaries as CommitSummaryBatch[],
      }));

      const story = await generateUnifiedStory(claudeToken, allRepoSummaries);

      return NextResponse.json<ApiResponse<GeneratedStory>>(
        {
          success: true,
          data: story,
        },
        { status: 200 }
      );
    }

    // This should be unreachable due to discriminated union
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Unknown request type. Must be "single", "unified", or "raw".',
        },
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    // =======================================================================
    // ERROR HANDLING CHAIN (Rule 17)
    // Claude API errors are typed — we return appropriate HTTP status codes
    // =======================================================================

    if (error instanceof ClaudeApiError) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401,
        RATE_LIMITED: 429,
        OVERLOADED: 503,
        TOKEN_MISSING: 401,
        MAX_RETRIES: 502,
        NO_BODY: 502,
        API_ERROR: 502,
      };

      const httpStatus = statusMap[error.code] || 500;

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.retryAfter
              ? `Retry after ${error.retryAfter} seconds`
              : undefined,
          },
        },
        {
          status: httpStatus,
          headers: error.retryAfter
            ? { 'Retry-After': String(error.retryAfter) }
            : undefined,
        }
      );
    }

    // Generic error
    console.error('[/api/story/generate] Unexpected error:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred during story generation.',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS preflight for client-side fetch)
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
