import type {
  CommitSummaryBatch,
  ClaudeApiRequest,
  ClaudeApiResponse,
  ClaudeStreamChunk,
  GeneratedStory,
  StoryChapter,
  StoryMilestone,
  AnalyticsResult,
  SuperlativesData,
  DateRange,
  Repository,
  CommitData,
} from '@/lib/types';

// =============================================================================
// ERROR TYPES
// =============================================================================

export class ClaudeApiError extends Error {
  code: string;
  status: number;
  retryAfter: number | null;
  isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    status: number,
    retryAfter: number | null = null,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ClaudeApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.isRetryable = isRetryable;
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLAUDE_MODEL = 'claude-opus-4-6';
const MAX_INPUT_TOKENS_SAFETY = 180000; // Leave headroom below the 200k context
const MAX_OUTPUT_TOKENS = 4096;
const BATCH_SIZE_COMMITS = 100;
const MAX_SUMMARY_CHARS_PER_BATCH = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000;
const API_TIMEOUT_MS = 300_000; // 5 minutes — matches OpenDev

// =============================================================================
// NATIVE HTTP — bypass Next.js fetch patching which breaks OAuth tokens
// =============================================================================

// Next.js globally patches `fetch` (and even undici) with caching/revalidation
// logic that corrupts Authorization headers for OAuth bearer tokens.
// We use Node's built-in https module to make Anthropic API calls directly.
import https from 'https';

function httpsRequest(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string; timeout: number }
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: options.method,
        headers: {
          ...options.headers,
          'content-length': Buffer.byteLength(options.body).toString(),
        },
        timeout: options.timeout,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') responseHeaders[key] = val;
          }
          resolve({
            status: res.statusCode || 500,
            headers: responseHeaders,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.write(options.body);
    req.end();
  });
}

/**
 * Streaming HTTPS request that returns a readable stream.
 */
function httpsRequestStream(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string; timeout: number }
): Promise<{ status: number; headers: Record<string, string>; stream: NodeJS.ReadableStream }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: options.method,
        headers: {
          ...options.headers,
          'content-length': Buffer.byteLength(options.body).toString(),
        },
        timeout: options.timeout,
      },
      (res) => {
        const responseHeaders: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') responseHeaders[key] = val;
        }

        // For error responses, read the full body
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode || 500,
              headers: responseHeaders,
              stream: res,
            });
            // Attach the body for error reading
            (res as NodeJS.ReadableStream & { _errorBody?: string })._errorBody =
              Buffer.concat(chunks).toString('utf-8');
          });
          return;
        }

        resolve({
          status: res.statusCode || 200,
          headers: responseHeaders,
          stream: res,
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.write(options.body);
    req.end();
  });
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[Content truncated to fit token limits]';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Claude Messages API — mirrors OpenDev's AnthropicProvider.chatOnce exactly.
 * OAuth tokens (sk-ant-oat*) use Bearer + beta flag; API keys use x-api-key.
 */
async function callClaudeApi(
  token: string,
  request: ClaudeApiRequest
): Promise<ClaudeApiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Build body exactly like OpenDev: conditionally add system & temperature
      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.maxTokens,
        messages: [{ role: 'user', content: request.userMessage }],
      };
      if (request.systemPrompt) body.system = request.systemPrompt;
      if (request.temperature !== undefined) body.temperature = request.temperature;

      // Auth + headers match OpenDev's AnthropicProvider.chatOnce
      const isOAuth = token.startsWith('sk-ant-oat');
      const authHeaders: Record<string, string> = isOAuth
        ? {
            Authorization: `Bearer ${token}`,
            'anthropic-beta': 'oauth-2025-04-20',
          }
        : { 'x-api-key': token };

      const jsonBody = JSON.stringify(body);
      const reqHeaders = {
        ...authHeaders,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };

      const response = await httpsRequest('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: reqHeaders,
        body: jsonBody,
        timeout: API_TIMEOUT_MS,
      });

      if (response.status >= 400) {
        const retryAfter = response.headers['retry-after']
          ? parseInt(response.headers['retry-after'], 10)
          : null;

        if (response.status === 429) {
          throw new ClaudeApiError(
            `Rate limited by Claude API: ${response.body}`,
            'RATE_LIMITED',
            429,
            retryAfter || 30,
            true
          );
        }

        if (response.status === 529) {
          throw new ClaudeApiError(
            'Claude API is overloaded. Please try again later.',
            'OVERLOADED',
            529,
            retryAfter || 60,
            true
          );
        }

        if (response.status === 401) {
          throw new ClaudeApiError(
            `Invalid or expired Claude API token. Detail: ${response.body}`,
            'UNAUTHORIZED',
            401,
            null,
            false
          );
        }

        throw new ClaudeApiError(
          `Claude API error (${response.status}): ${response.body}`,
          'API_ERROR',
          response.status,
          null,
          response.status >= 500
        );
      }

      const data = JSON.parse(response.body);
      const content = data.content?.[0]?.text ?? '';

      return {
        content,
        model: data.model || request.model,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
        },
        stopReason: data.stop_reason || 'end_turn',
      };
    } catch (error) {
      lastError = error as Error;

      if (error instanceof ClaudeApiError) {
        if (!error.isRetryable) throw error;

        const delay = error.retryAfter
          ? error.retryAfter * 1000
          : RETRY_DELAY_BASE_MS * Math.pow(2, attempt);

        if (attempt < MAX_RETRIES - 1) {
          await sleep(delay);
          continue;
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new ClaudeApiError('Max retries exceeded', 'MAX_RETRIES', 500, null, false);
}

async function callClaudeApiStreaming(
  token: string,
  request: ClaudeApiRequest,
  onChunk: (chunk: ClaudeStreamChunk) => void
): Promise<string> {
  // Build body matching OpenDev pattern + stream flag
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens,
    messages: [{ role: 'user', content: request.userMessage }],
    stream: true,
  };
  if (request.systemPrompt) body.system = request.systemPrompt;
  if (request.temperature !== undefined) body.temperature = request.temperature;

  const isOAuth = token.startsWith('sk-ant-oat');
  const authHeaders: Record<string, string> = isOAuth
    ? {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      }
    : { 'x-api-key': token };

  const jsonBody = JSON.stringify(body);
  const streamResponse = await httpsRequestStream('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: jsonBody,
    timeout: API_TIMEOUT_MS,
  });

  if (streamResponse.status >= 400) {
    // Read error body from stream
    const errorBody = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      streamResponse.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      streamResponse.stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      // If already consumed (by httpsRequestStream error path), use _errorBody
      const cached = (streamResponse.stream as NodeJS.ReadableStream & { _errorBody?: string })._errorBody;
      if (cached) resolve(cached);
    });

    const retryAfter = streamResponse.headers['retry-after']
      ? parseInt(streamResponse.headers['retry-after'], 10)
      : null;

    if (streamResponse.status === 429) {
      throw new ClaudeApiError(
        `Rate limited by Claude API: ${errorBody}`,
        'RATE_LIMITED',
        429,
        retryAfter || 30,
        true
      );
    }

    if (streamResponse.status === 401) {
      throw new ClaudeApiError(
        `Invalid or expired Claude API token. Detail: ${errorBody}`,
        'UNAUTHORIZED',
        401,
        null,
        false
      );
    }

    throw new ClaudeApiError(
      `Claude API streaming error (${streamResponse.status}): ${errorBody}`,
      'API_ERROR',
      streamResponse.status,
      null,
      streamResponse.status >= 500
    );
  }

  let fullContent = '';
  let buffer = '';

  return new Promise<string>((resolve, reject) => {
    streamResponse.stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            onChunk({ type: 'message_stop', isFinal: true });
            continue;
          }

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'content_block_delta' && event.delta?.text) {
              fullContent += event.delta.text;
              onChunk({
                type: 'content_block_delta',
                text: event.delta.text,
                isFinal: false,
              });
            } else if (event.type === 'message_start') {
              onChunk({ type: 'message_start', isFinal: false });
            } else if (event.type === 'message_delta') {
              onChunk({ type: 'message_delta', isFinal: false });
            } else if (event.type === 'message_stop') {
              onChunk({ type: 'message_stop', isFinal: true });
            }
          } catch {
            // Skip invalid JSON lines in SSE stream
          }
        }
      }
    });

    streamResponse.stream.on('end', () => resolve(fullContent));
    streamResponse.stream.on('error', (err: Error) => reject(err));
  });
}

// =============================================================================
// SMART BATCHING: Chunk commits into summarized batches
// =============================================================================

function summarizeCommitBatch(
  commits: CommitData[],
  repoId: string,
  repoName: string,
  batchIndex: number,
  totalBatches: number
): CommitSummaryBatch {
  if (commits.length === 0) {
    return {
      repoId,
      repoName,
      period: { start: '', end: '', totalDays: 0 },
      commitCount: 0,
      messageSummary: 'No commits in this batch.',
      keyFilesChanged: [],
      netAdditions: 0,
      netDeletions: 0,
      contributors: [],
      patterns: [],
    };
  }

  const sorted = [...commits].sort((a, b) => a.timestampMs - b.timestampMs);
  const startDate = sorted[0].timestamp;
  const endDate = sorted[sorted.length - 1].timestamp;
  const totalDays = Math.max(
    1,
    Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // Deduplicate and summarize commit messages
  const messageFrequency = new Map<string, number>();
  for (const commit of commits) {
    const headline = commit.messageHeadline.toLowerCase().trim();
    // Group similar messages by removing common prefixes/SHAs
    const normalized = headline
      .replace(/^merge (branch|pull request) .*$/i, 'merge commit')
      .replace(/^(fix|feat|chore|docs|style|refactor|test|ci|build|perf)\(.*?\):?\s*/i, '$1: ')
      .trim();

    messageFrequency.set(normalized, (messageFrequency.get(normalized) || 0) + 1);
  }

  // Get top commit message patterns
  const topMessages = Array.from(messageFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([msg, count]) => (count > 1 ? `${msg} (x${count})` : msg));

  let messageSummary = topMessages.join('; ');
  if (messageSummary.length > MAX_SUMMARY_CHARS_PER_BATCH) {
    messageSummary = messageSummary.slice(0, MAX_SUMMARY_CHARS_PER_BATCH) + '...';
  }

  // Key files changed (by frequency)
  const fileFrequency = new Map<string, number>();
  for (const commit of commits) {
    for (const file of commit.files) {
      fileFrequency.set(file.path, (fileFrequency.get(file.path) || 0) + 1);
    }
  }

  const keyFiles = Array.from(fileFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path]) => path);

  // Net additions/deletions
  const netAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const netDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

  // Unique contributors
  const contributorSet = new Set<string>();
  for (const commit of commits) {
    contributorSet.add(commit.author.login || commit.author.name);
  }

  // Detect patterns
  const patterns: string[] = [];
  const mergeCount = commits.filter((c) => c.isMerge).length;
  if (mergeCount > commits.length * 0.3) {
    patterns.push(`High merge frequency (${mergeCount}/${commits.length} commits are merges)`);
  }

  const fixCount = commits.filter((c) => /^fix/i.test(c.messageHeadline)).length;
  if (fixCount > commits.length * 0.3) {
    patterns.push(`Bug fixing phase (${fixCount} fix commits)`);
  }

  const featCount = commits.filter((c) => /^feat/i.test(c.messageHeadline)).length;
  if (featCount > commits.length * 0.2) {
    patterns.push(`Feature development phase (${featCount} feature commits)`);
  }

  const weekendCommits = commits.filter((c) => c.dayOfWeek === 0 || c.dayOfWeek === 6).length;
  if (weekendCommits > commits.length * 0.3) {
    patterns.push(`Weekend warrior activity (${weekendCommits} weekend commits)`);
  }

  return {
    repoId,
    repoName,
    period: { start: startDate, end: endDate, totalDays },
    commitCount: commits.length,
    messageSummary,
    keyFilesChanged: keyFiles,
    netAdditions,
    netDeletions,
    contributors: Array.from(contributorSet),
    patterns,
  };
}

function batchCommits(
  commits: CommitData[],
  repoId: string,
  repoName: string,
  batchSize: number = BATCH_SIZE_COMMITS
): CommitSummaryBatch[] {
  const sorted = [...commits].sort((a, b) => a.timestampMs - b.timestampMs);
  const batches: CommitSummaryBatch[] = [];
  const totalBatches = Math.ceil(sorted.length / batchSize);

  for (let i = 0; i < sorted.length; i += batchSize) {
    const batchCommits = sorted.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    batches.push(summarizeCommitBatch(batchCommits, repoId, repoName, batchIndex, totalBatches));
  }

  return batches;
}

function formatBatchesForPrompt(batches: CommitSummaryBatch[]): string {
  return batches
    .map((batch, i) => {
      const lines = [
        `--- Batch ${i + 1}/${batches.length} (${batch.period.start.slice(0, 10)} to ${batch.period.end.slice(0, 10)}) ---`,
        `Repository: ${batch.repoName}`,
        `Commits: ${batch.commitCount} | +${batch.netAdditions} / -${batch.netDeletions} lines`,
        `Contributors: ${batch.contributors.join(', ')}`,
        `Key activities: ${batch.messageSummary}`,
        batch.keyFilesChanged.length > 0
          ? `Key files: ${batch.keyFilesChanged.slice(0, 10).join(', ')}`
          : '',
        batch.patterns.length > 0 ? `Patterns: ${batch.patterns.join('; ')}` : '',
      ];
      return lines.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

// =============================================================================
// PROGRESSIVE SUMMARIZATION
// =============================================================================

/**
 * For very large repositories, we do progressive summarization:
 * 1. Batch commits into groups of ~100
 * 2. Summarize each batch into a CommitSummaryBatch
 * 3. If total batches > 20, further summarize batches into "meta-batches"
 * 4. Send the final summarized text to Claude
 */
async function progressivelySummarizeBatches(
  token: string,
  batches: CommitSummaryBatch[],
  repoName: string
): Promise<string> {
  // If batches fit within token limits, just format them directly
  const directFormat = formatBatchesForPrompt(batches);
  if (estimateTokens(directFormat) < MAX_INPUT_TOKENS_SAFETY * 0.6) {
    return directFormat;
  }

  // Need progressive summarization: group batches into meta-groups
  const META_GROUP_SIZE = 10;
  const metaGroups: CommitSummaryBatch[][] = [];
  for (let i = 0; i < batches.length; i += META_GROUP_SIZE) {
    metaGroups.push(batches.slice(i, i + META_GROUP_SIZE));
  }

  const metaSummaries: string[] = [];

  for (let groupIdx = 0; groupIdx < metaGroups.length; groupIdx++) {
    const group = metaGroups[groupIdx];
    const groupText = formatBatchesForPrompt(group);

    const response = await callClaudeApi(token, {
      model: CLAUDE_MODEL,
      maxTokens: 1024,
      systemPrompt: `You are a technical summarizer. Condense the following development activity log into a concise summary (max 500 words). Focus on: major features built, significant refactors, bug fix campaigns, key contributors, and development velocity trends. Preserve specific dates, file names, and technical details that tell the story of this project's evolution.`,
      userMessage: `Summarize this development activity for "${repoName}" (period group ${groupIdx + 1}/${metaGroups.length}):\n\n${groupText}`,
      temperature: 0.3,
      stream: false,
    });

    metaSummaries.push(
      `=== Period ${groupIdx + 1}/${metaGroups.length} ===\n${response.content}`
    );
  }

  return metaSummaries.join('\n\n');
}

// =============================================================================
// PUBLIC API FUNCTIONS
// =============================================================================

interface RepoMeta {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number>;
  starCount: number;
  createdAt: string;
  topics: string[];
  isPrivate: boolean;
  defaultBranch: string;
}

/**
 * Generate an AI-powered story for a single repository.
 * Implements smart batching for large commit histories.
 *
 * Rule 7: For repos with 1000+ commits, commits are batched and progressively summarized.
 * Rule 6: Called by /api/story/generate which receives claudeToken via Authorization header.
 */
export async function generateRepoStory(
  claudeToken: string,
  commitSummary: string | CommitSummaryBatch[],
  repoMeta: RepoMeta
): Promise<GeneratedStory> {
  if (!claudeToken) {
    throw new ClaudeApiError(
      'Claude API token is required',
      'TOKEN_MISSING',
      401,
      null,
      false
    );
  }

  // If we received raw batches, format them
  let summaryText: string;
  if (Array.isArray(commitSummary)) {
    if (commitSummary.length > 20) {
      summaryText = await progressivelySummarizeBatches(
        claudeToken,
        commitSummary,
        repoMeta.name
      );
    } else {
      summaryText = formatBatchesForPrompt(commitSummary);
    }
  } else {
    summaryText = commitSummary;
  }

  // Ensure we don't exceed token limits
  summaryText = truncateToTokenLimit(summaryText, Math.floor(MAX_INPUT_TOKENS_SAFETY * 0.7));

  const languageList = Object.entries(repoMeta.languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang, bytes]) => `${lang} (${Math.round(bytes / 1024)}KB)`)
    .join(', ');

  const systemPrompt = `You are a creative technical writer who crafts compelling narratives about software development journeys. Your stories are insightful, engaging, and celebrate the craft of programming. You write in a warm, knowledgeable tone that respects the developer's effort and highlights meaningful patterns in their work.

Output your story in the following JSON format (no markdown code fences, just raw JSON):
{
  "title": "Story title",
  "subtitle": "A brief tagline",
  "chapters": [
    {
      "index": 0,
      "title": "Chapter title",
      "content": "Chapter content in markdown format",
      "dateRange": { "start": "ISO date", "end": "ISO date", "totalDays": number },
      "repoIds": ["repo-full-name"],
      "anchorId": "chapter-slug"
    }
  ],
  "milestones": [
    {
      "date": "ISO date",
      "title": "Milestone title",
      "description": "What happened",
      "repoId": "repo-full-name",
      "repoName": "repo-name",
      "type": "project-start|major-release|pivot|breakthrough|collaboration|milestone|achievement",
      "significance": 1-5,
      "relatedCommits": [],
      "icon": "emoji"
    }
  ]
}`;

  const userMessage = `Write the development story of the repository "${repoMeta.fullName}".

Repository metadata:
- Name: ${repoMeta.name}
- Full name: ${repoMeta.fullName}
- Description: ${repoMeta.description || 'No description provided'}
- Primary language: ${repoMeta.language || 'Not specified'}
- All languages: ${languageList || 'Unknown'}
- Stars: ${repoMeta.starCount}
- Created: ${repoMeta.createdAt}
- Topics: ${repoMeta.topics?.join(', ') || 'None'}
- Visibility: ${repoMeta.isPrivate ? 'Private' : 'Public'}

Development activity summary:
${summaryText}

Create a compelling 3-6 chapter story that traces the evolution of this project. Identify key milestones, development phases, and pivotal moments. Make it personal and engaging — this is the developer's journey with this codebase.

IMPORTANT: Chapters MUST be in strict chronological order — start with the earliest events (project creation, first commits) and end with the most recent activity. Chapter 1 should cover the oldest period, and the last chapter should cover the most recent period. This is a journey board showing evolution over time.`;

  const response = await callClaudeApi(claudeToken, {
    model: CLAUDE_MODEL,
    maxTokens: MAX_OUTPUT_TOKENS,
    systemPrompt,
    userMessage,
    temperature: 0.7,
    stream: false,
  });

  // Parse the response
  const story = parseStoryResponse(response.content, repoMeta.fullName, 'repo');
  return story;
}

/**
 * Generate a unified story across all selected repositories.
 * Combines individual repo summaries into a developer journey narrative.
 */
export async function generateUnifiedStory(
  claudeToken: string,
  allRepoSummaries: Array<{
    repoMeta: RepoMeta;
    summary: string | CommitSummaryBatch[];
  }>
): Promise<GeneratedStory> {
  if (!claudeToken) {
    throw new ClaudeApiError(
      'Claude API token is required',
      'TOKEN_MISSING',
      401,
      null,
      false
    );
  }

  // Build combined summary, respecting token limits
  const repoSections: string[] = [];
  let totalTokenEstimate = 0;
  const tokenBudgetPerRepo = Math.floor(
    (MAX_INPUT_TOKENS_SAFETY * 0.6) / allRepoSummaries.length
  );

  for (const { repoMeta, summary } of allRepoSummaries) {
    let summaryText: string;
    if (Array.isArray(summary)) {
      if (summary.length > 10) {
        // For unified story, be more aggressive with summarization
        summaryText = await progressivelySummarizeBatches(claudeToken, summary, repoMeta.name);
      } else {
        summaryText = formatBatchesForPrompt(summary);
      }
    } else {
      summaryText = summary;
    }

    summaryText = truncateToTokenLimit(summaryText, tokenBudgetPerRepo);
    totalTokenEstimate += estimateTokens(summaryText);

    const languageList = Object.entries(repoMeta.languages || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang)
      .join(', ');

    repoSections.push(
      `## Repository: ${repoMeta.fullName}
Description: ${repoMeta.description || 'N/A'}
Languages: ${languageList || repoMeta.language || 'Unknown'}
Stars: ${repoMeta.starCount} | Created: ${repoMeta.createdAt.slice(0, 10)}
Topics: ${repoMeta.topics?.join(', ') || 'None'}

Activity:
${summaryText}`
    );
  }

  const combinedRepoData = repoSections.join('\n\n---\n\n');

  const systemPrompt = `You are a creative technical writer crafting a developer's unified journey narrative — like a "Spotify Wrapped" but for their code. Weave together the stories of multiple repositories into a cohesive narrative about this developer's growth, passions, and accomplishments.

Output your story in the following JSON format (no markdown code fences, just raw JSON):
{
  "title": "The unified story title",
  "subtitle": "A compelling tagline about this developer's journey",
  "chapters": [
    {
      "index": 0,
      "title": "Chapter title",
      "content": "Chapter content in markdown. Rich, engaging prose.",
      "dateRange": { "start": "ISO date", "end": "ISO date", "totalDays": number },
      "repoIds": ["owner/repo1", "owner/repo2"],
      "anchorId": "chapter-slug"
    }
  ],
  "milestones": [
    {
      "date": "ISO date",
      "title": "Milestone title",
      "description": "What happened and why it matters",
      "repoId": "owner/repo",
      "repoName": "repo",
      "type": "project-start|major-release|pivot|breakthrough|collaboration|milestone|achievement",
      "significance": 1-5,
      "relatedCommits": [],
      "icon": "emoji"
    }
  ]
}`;

  const userMessage = `Write the unified developer journey story spanning ${allRepoSummaries.length} repositories. This should read like a chapter-book autobiography of a developer's coding life.

${combinedRepoData}

Create a 4-8 chapter narrative that:
1. Identifies the developer's evolution over time
2. Highlights connections between different projects
3. Celebrates technical growth and key achievements
4. Notes any interesting patterns (language shifts, focus changes, productivity trends)
5. Ends with a forward-looking reflection

IMPORTANT: Chapters MUST be in strict chronological order — start with the earliest events (first projects, first commits) and end with the most recent activity. Chapter 1 should cover the oldest period, and the last chapter should cover the most recent period. This is a journey board showing evolution over time.

Make it personal, insightful, and celebratory. Use specific details from the commit data.`;

  const response = await callClaudeApi(claudeToken, {
    model: CLAUDE_MODEL,
    maxTokens: MAX_OUTPUT_TOKENS,
    systemPrompt,
    userMessage,
    temperature: 0.7,
    stream: false,
  });

  return parseStoryResponse(response.content, null, 'unified');
}

/**
 * Generate a summary for a batch of commits.
 * Used for progressive summarization when repos have thousands of commits.
 *
 * Rule 7: This is part of the batching pipeline — called iteratively for each batch.
 */
export async function generateRepoSummary(
  claudeToken: string,
  commits: CommitData[],
  repoId: string,
  repoName: string
): Promise<CommitSummaryBatch[]> {
  if (!claudeToken) {
    throw new ClaudeApiError(
      'Claude API token is required',
      'TOKEN_MISSING',
      401,
      null,
      false
    );
  }

  // Create batches using local summarization (no AI needed for this step)
  const batches = batchCommits(commits, repoId, repoName, BATCH_SIZE_COMMITS);
  return batches;
}

/**
 * Generate AI-powered superlatives based on analytics data.
 * Creates fun, personalized awards and observations.
 */
export async function generateSuperlatives(
  claudeToken: string,
  analytics: AnalyticsResult,
  repositories: Repository[]
): Promise<{
  aiInsights: string[];
  funFacts: string[];
  developerPersonality: string;
  yearInReview: string;
}> {
  if (!claudeToken) {
    throw new ClaudeApiError(
      'Claude API token is required',
      'TOKEN_MISSING',
      401,
      null,
      false
    );
  }

  const repoList = repositories
    .map(
      (r) =>
        `${r.fullName} (${r.language || 'unknown'}, ${r.starCount}★, created ${r.createdAt.slice(0, 10)})`
    )
    .join('\n');

  const superlativesData = analytics.superlatives;
  const streakData = analytics.streaks;
  const productivityData = analytics.productivity;
  const codingPatterns = analytics.codingPatterns;
  const totals = analytics.totals;

  const analyticsSnapshot = `
Developer Stats:
- Total commits: ${totals.totalCommits}
- Total repos: ${totals.totalRepos}
- Active days: ${totals.activeDays}
- Lines added: ${totals.totalAdditions.toLocaleString()}
- Lines deleted: ${totals.totalDeletions.toLocaleString()}
- Unique contributors: ${totals.uniqueContributors}
- Avg commits/day: ${totals.avgCommitsPerDay.toFixed(1)}

Patterns:
- Chronotype: ${superlativesData.chronotype}
- Weekend type: ${superlativesData.weekendType}
- Peak hour: ${codingPatterns.peakHour}:00
- Weekend coding: ${codingPatterns.weekendPercentage.toFixed(1)}%
- Longest streak: ${streakData.longestStreak.length} days (${streakData.longestStreak.startDate.slice(0, 10)} to ${streakData.longestStreak.endDate.slice(0, 10)})
- Most commits in a day: ${streakData.mostCommitsInDay.count} on ${streakData.mostCommitsInDay.date.slice(0, 10)}
- Most productive month: ${productivityData.mostProductiveMonth.label} (${productivityData.mostProductiveMonth.commits} commits)
- Favorite commit word: "${superlativesData.favoriteCommitWord.word}" (used ${superlativesData.favoriteCommitWord.count}x)
- Fix commits: ${superlativesData.fixCommits}
- Feature commits: ${superlativesData.featureCommits}
- Refactor commits: ${superlativesData.refactorCommits}
- Merge %: ${superlativesData.mergePercentage.toFixed(1)}%
- Commit mood: ${superlativesData.commitMood}
- Avg lines/commit: ${productivityData.avgLinesPerCommit.toFixed(0)}

Badges earned: ${superlativesData.badges.map((b) => `${b.icon} ${b.name}`).join(', ')}

Repositories:
${repoList}
`;

  const systemPrompt = `You are a witty, encouraging developer companion creating personalized insights like a "Wrapped" experience. Be specific, fun, and use the actual data provided. No generic platitudes.

Output JSON (no code fences):
{
  "aiInsights": ["5-8 specific, data-driven insights about this developer's habits"],
  "funFacts": ["4-6 fun, quirky observations based on their data"],
  "developerPersonality": "A 2-3 sentence developer personality profile based on their patterns",
  "yearInReview": "A 3-4 sentence year-in-review summary celebrating their achievements"
}`;

  const response = await callClaudeApi(claudeToken, {
    model: CLAUDE_MODEL,
    maxTokens: 2048,
    systemPrompt,
    userMessage: `Generate personalized developer insights based on this data:\n\n${analyticsSnapshot}`,
    temperature: 0.8,
    stream: false,
  });

  try {
    const parsed = extractJSON(response.content);
    return {
      aiInsights: Array.isArray(parsed.aiInsights) ? parsed.aiInsights : [],
      funFacts: Array.isArray(parsed.funFacts) ? parsed.funFacts : [],
      developerPersonality:
        typeof parsed.developerPersonality === 'string'
          ? parsed.developerPersonality
          : 'A dedicated developer with a passion for building.',
      yearInReview:
        typeof parsed.yearInReview === 'string'
          ? parsed.yearInReview
          : 'An impressive year of coding and growth.',
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      aiInsights: [
        `You made ${totals.totalCommits.toLocaleString()} commits across ${totals.totalRepos} repositories.`,
        `Your longest streak was ${streakData.longestStreak.length} consecutive days of commits.`,
        `You're a ${superlativesData.chronotype === 'night-owl' ? 'night owl 🦉' : superlativesData.chronotype === 'early-bird' ? 'early bird 🐦' : 'balanced coder ⚖️'}, with peak activity at ${codingPatterns.peakHour}:00.`,
      ],
      funFacts: [
        `Your favorite commit word is "${superlativesData.favoriteCommitWord.word}" — you used it ${superlativesData.favoriteCommitWord.count} times!`,
        `You wrote ${totals.totalAdditions.toLocaleString()} lines of code and deleted ${totals.totalDeletions.toLocaleString()} — that's a net ${(totals.totalAdditions - totals.totalDeletions).toLocaleString()} lines.`,
      ],
      developerPersonality: response.content.slice(0, 300),
      yearInReview: `A year of ${totals.totalCommits.toLocaleString()} commits across ${totals.totalRepos} repositories.`,
    };
  }
}

/**
 * Stream a story generation response.
 * Used by the /api/story/generate route for real-time progress updates.
 */
export async function generateRepoStoryStreaming(
  claudeToken: string,
  commitSummary: string | CommitSummaryBatch[],
  repoMeta: RepoMeta,
  onChunk: (chunk: ClaudeStreamChunk) => void
): Promise<GeneratedStory> {
  if (!claudeToken) {
    throw new ClaudeApiError(
      'Claude API token is required',
      'TOKEN_MISSING',
      401,
      null,
      false
    );
  }

  let summaryText: string;
  if (Array.isArray(commitSummary)) {
    if (commitSummary.length > 20) {
      summaryText = await progressivelySummarizeBatches(
        claudeToken,
        commitSummary,
        repoMeta.name
      );
    } else {
      summaryText = formatBatchesForPrompt(commitSummary);
    }
  } else {
    summaryText = commitSummary;
  }

  summaryText = truncateToTokenLimit(summaryText, Math.floor(MAX_INPUT_TOKENS_SAFETY * 0.7));

  const languageList = Object.entries(repoMeta.languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang, bytes]) => `${lang} (${Math.round(bytes / 1024)}KB)`)
    .join(', ');

  const systemPrompt = `You are a creative technical writer who crafts compelling narratives about software development journeys. Your stories are insightful, engaging, and celebrate the craft of programming.

Output your story in the following JSON format (no markdown code fences, just raw JSON):
{
  "title": "Story title",
  "subtitle": "A brief tagline",
  "chapters": [
    {
      "index": 0,
      "title": "Chapter title",
      "content": "Chapter content in markdown format",
      "dateRange": { "start": "ISO date", "end": "ISO date", "totalDays": number },
      "repoIds": ["repo-full-name"],
      "anchorId": "chapter-slug"
    }
  ],
  "milestones": [
    {
      "date": "ISO date",
      "title": "Milestone title",
      "description": "What happened",
      "repoId": "repo-full-name",
      "repoName": "repo-name",
      "type": "project-start|major-release|pivot|breakthrough|collaboration|milestone|achievement",
      "significance": 1-5,
      "relatedCommits": [],
      "icon": "emoji"
    }
  ]
}`;

  const userMessage = `Write the development story of the repository "${repoMeta.fullName}".

Repository metadata:
- Name: ${repoMeta.name}
- Description: ${repoMeta.description || 'No description provided'}
- Languages: ${languageList || repoMeta.language || 'Unknown'}
- Stars: ${repoMeta.starCount} | Created: ${repoMeta.createdAt.slice(0, 10)}
- Topics: ${repoMeta.topics?.join(', ') || 'None'}

Development activity:
${summaryText}

Create a compelling 3-6 chapter story tracing this project's evolution.

IMPORTANT: Chapters MUST be in strict chronological order — start with the earliest events (project creation, first commits) and end with the most recent activity. Chapter 1 should cover the oldest period, and the last chapter should cover the most recent period.`;

  const fullContent = await callClaudeApiStreaming(
    claudeToken,
    {
      model: CLAUDE_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      systemPrompt,
      userMessage,
      temperature: 0.7,
      stream: true,
    },
    onChunk
  );

  return parseStoryResponse(fullContent, repoMeta.fullName, 'repo');
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

function extractJSON(text: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try to find JSON in the text
  }

  // Look for JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Try to fix common issues
    }
  }

  // Try to fix truncated JSON
  let candidate = text.trim();
  if (!candidate.startsWith('{')) {
    const idx = candidate.indexOf('{');
    if (idx !== -1) candidate = candidate.slice(idx);
  }

  // Balance braces
  let braceCount = 0;
  let lastValidIdx = -1;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] === '{') braceCount++;
    if (candidate[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        lastValidIdx = i;
        break;
      }
    }
  }

  if (lastValidIdx > 0) {
    try {
      return JSON.parse(candidate.slice(0, lastValidIdx + 1));
    } catch {
      // give up
    }
  }

  throw new Error('Could not extract valid JSON from Claude response');
}

function parseStoryResponse(
  content: string,
  repoId: string | null,
  type: 'repo' | 'unified'
): GeneratedStory {
  try {
    const parsed = extractJSON(content);

    const rawChapters: StoryChapter[] = (
      (parsed.chapters as Array<Record<string, unknown>>) || []
    ).map(
      (ch, i): StoryChapter => ({
        index: typeof ch.index === 'number' ? ch.index : i,
        title: String(ch.title || `Chapter ${i + 1}`),
        content: String(ch.content || ''),
        dateRange: (ch.dateRange as DateRange) || { start: '', end: '', totalDays: 0 },
        repoIds: Array.isArray(ch.repoIds) ? ch.repoIds.map(String) : repoId ? [repoId] : [],
        anchorId: String(ch.anchorId || `chapter-${i + 1}`),
      })
    );

    // Sort chapters chronologically (oldest first) and re-index
    const chapters = rawChapters
      .sort((a, b) => {
        const aStart = a.dateRange.start ? new Date(a.dateRange.start).getTime() : 0;
        const bStart = b.dateRange.start ? new Date(b.dateRange.start).getTime() : 0;
        // If dates are equal or missing, preserve original index order
        if (aStart === bStart) return a.index - b.index;
        return aStart - bStart;
      })
      .map((ch, i) => ({
        ...ch,
        index: i,
        anchorId: `chapter-${i + 1}`,
      }));

    const milestones: StoryMilestone[] = (
      (parsed.milestones as Array<Record<string, unknown>>) || []
    ).map(
      (m): StoryMilestone => ({
        date: String(m.date || ''),
        title: String(m.title || ''),
        description: String(m.description || ''),
        repoId: (m.repoId as string) || repoId,
        repoName: (m.repoName as string) || null,
        type: (m.type as StoryMilestone['type']) || 'milestone',
        significance: typeof m.significance === 'number' ? m.significance : 3,
        relatedCommits: Array.isArray(m.relatedCommits)
          ? m.relatedCommits.map(String)
          : [],
        icon: String(m.icon || '🔖'),
      })
    ).sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;
      return aDate - bDate;
    });

    // Compute date range from chapters
    const allDates = [
      ...chapters.flatMap((ch) => [ch.dateRange.start, ch.dateRange.end]),
      ...milestones.map((m) => m.date),
    ].filter(Boolean);

    const sortedDates = allDates.sort();
    const dateRange: DateRange = {
      start: sortedDates[0] || new Date().toISOString(),
      end: sortedDates[sortedDates.length - 1] || new Date().toISOString(),
      totalDays: sortedDates.length > 1
        ? Math.ceil(
            (new Date(sortedDates[sortedDates.length - 1]).getTime() -
              new Date(sortedDates[0]).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 1,
    };

    return {
      id: `story-${type}-${repoId || 'unified'}-${Date.now()}`,
      type,
      repoId,
      title: String(parsed.title || (type === 'unified' ? 'Your Developer Journey' : `The Story of ${repoId}`)),
      subtitle: String(parsed.subtitle || 'A tale told through commits'),
      content: chapters.map((ch) => `## ${ch.title}\n\n${ch.content}`).join('\n\n'),
      chapters,
      milestones,
      generatedAt: Date.now(),
      dateRange,
      model: CLAUDE_MODEL,
    };
  } catch (parseError) {
    // If JSON parsing fails completely, create a story from raw markdown
    return {
      id: `story-${type}-${repoId || 'unified'}-${Date.now()}`,
      type,
      repoId,
      title: type === 'unified' ? 'Your Developer Journey' : `The Story of ${repoId}`,
      subtitle: 'A tale told through commits',
      content,
      chapters: [
        {
          index: 0,
          title: 'The Full Story',
          content,
          dateRange: { start: '', end: '', totalDays: 0 },
          repoIds: repoId ? [repoId] : [],
          anchorId: 'full-story',
        },
      ],
      milestones: [],
      generatedAt: Date.now(),
      dateRange: { start: '', end: '', totalDays: 0 },
      model: CLAUDE_MODEL,
    };
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Prepare commits for Claude API consumption.
 * Handles the batching and summarization pipeline.
 *
 * Rule 7: For 1000+ commits, this batches into groups of ~100 and summarizes each.
 */
export function prepareCommitsForClaude(
  commits: CommitData[],
  repoId: string,
  repoName: string
): CommitSummaryBatch[] {
  return batchCommits(commits, repoId, repoName, BATCH_SIZE_COMMITS);
}

/**
 * Validate a Claude API token by making a minimal request.
 */
export async function validateClaudeToken(token: string): Promise<boolean> {
  try {
    await callClaudeApi(token, {
      model: CLAUDE_MODEL,
      maxTokens: 10,
      systemPrompt: 'Respond with just "ok".',
      userMessage: 'ping',
      temperature: 0,
      stream: false,
    });
    return true;
  } catch (error) {
    if (error instanceof ClaudeApiError && error.code === 'UNAUTHORIZED') {
      return false;
    }
    // Other errors (rate limit, etc.) still mean the token is valid
    if (error instanceof ClaudeApiError && error.status === 429) {
      return true;
    }
    return false;
  }
}

export { callClaudeApi, callClaudeApiStreaming, batchCommits, formatBatchesForPrompt, estimateTokens, summarizeCommitBatch };
