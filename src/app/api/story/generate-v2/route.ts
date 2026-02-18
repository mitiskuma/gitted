import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse } from '@/lib/types';
import { callClaudeApi, ClaudeApiError } from '@/lib/claude-api';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

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
// REQUEST VALIDATION
// =============================================================================

const NarrativeRequestSchema = z.object({
  pass: z.enum(['analysis', 'correlation', 'narrative']),
  systemPrompt: z.string().min(1),
  userMessage: z.string().min(1),
  maxTokens: z.number().min(100).max(16384).default(4096),
  temperature: z.number().min(0).max(1).default(0.7),
  model: z.string().optional(),
  repoId: z.string().optional(),
});

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  // Step 1: Validate Claude token
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

  const parseResult = NarrativeRequestSchema.safeParse(body);

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
    const result = await callClaudeApi(claudeToken, {
      model: requestData.model || DEFAULT_MODEL,
      maxTokens: requestData.maxTokens,
      systemPrompt: requestData.systemPrompt,
      userMessage: requestData.userMessage,
      temperature: requestData.temperature,
      stream: false,
    });

    return NextResponse.json<
      ApiResponse<{
        content: string;
        usage: { inputTokens: number; outputTokens: number };
        pass: string;
        repoId?: string;
      }>
    >(
      {
        success: true,
        data: {
          content: result.content,
          usage: result.usage,
          pass: requestData.pass,
          repoId: requestData.repoId,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during narrative generation.';

    const isAuth =
      error instanceof ClaudeApiError
        ? error.code === 'UNAUTHORIZED'
        : message.includes('Invalid or expired');
    const isRateLimit =
      error instanceof ClaudeApiError
        ? error.code === 'RATE_LIMITED'
        : message.includes('Rate limited');
    const isOverloaded =
      error instanceof ClaudeApiError
        ? error.code === 'OVERLOADED'
        : message.includes('overloaded');

    const statusCode = isAuth
      ? 401
      : isRateLimit
        ? 429
        : isOverloaded
          ? 503
          : 500;

    console.error(
      `[/api/story/generate-v2] Error (pass: ${requestData.pass}):`,
      message
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: isAuth
            ? 'UNAUTHORIZED'
            : isRateLimit
              ? 'RATE_LIMITED'
              : isOverloaded
                ? 'OVERLOADED'
                : 'GENERATION_ERROR',
          message,
        },
      },
      { status: statusCode }
    );
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS preflight)
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
