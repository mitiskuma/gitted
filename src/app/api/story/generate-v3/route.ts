import { NextRequest } from 'next/server';
import { z } from 'zod';
import { callClaudeApiStreaming, ClaudeApiError } from '@/lib/claude-api';

// =============================================================================
// AUTH
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
// VALIDATION
// =============================================================================

const StreamRequestSchema = z.object({
  systemPrompt: z.string().min(1),
  userMessage: z.string().min(1),
  maxTokens: z.number().min(100).max(32000).default(16384),
  temperature: z.number().min(0).max(1).default(0.7),
  model: z.string().default('claude-sonnet-4-5-20250929'),
});

// =============================================================================
// SSE HELPERS
// =============================================================================

interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}

function formatSSE(event: StreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

// =============================================================================
// POST HANDLER — Streaming SSE
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  const claudeToken = extractClaudeToken(request);

  if (!claudeToken) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Claude API token.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parseResult = StreamRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ error: 'Validation error', details: parseResult.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const req = parseResult.data;

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Run the streaming call in the background
  (async () => {
    try {
      await writer.write(
        encoder.encode(formatSSE({ event: 'start', data: {} }))
      );

      await callClaudeApiStreaming(
        claudeToken,
        {
          model: req.model,
          maxTokens: req.maxTokens,
          systemPrompt: req.systemPrompt,
          userMessage: req.userMessage,
          temperature: req.temperature,
          stream: true,
        },
        async (chunk) => {
          if (chunk.text) {
            await writer.write(
              encoder.encode(
                formatSSE({ event: 'chunk', data: { text: chunk.text } })
              )
            );
          }
          if (chunk.isFinal) {
            await writer.write(
              encoder.encode(formatSSE({ event: 'done', data: {} }))
            );
          }
        }
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Streaming generation failed.';
      const code =
        error instanceof ClaudeApiError ? error.code : 'GENERATION_ERROR';
      const status =
        error instanceof ClaudeApiError ? error.status : 500;

      console.error('[generate-v3] Streaming error:', message);

      try {
        await writer.write(
          encoder.encode(
            formatSSE({
              event: 'error',
              data: { code, message, status },
            })
          )
        );
      } catch {
        // Writer may already be closed
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
