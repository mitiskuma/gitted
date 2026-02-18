// src/lib/narrative-pipeline-v2.ts
// Single-call streaming narrative pipeline.
// Pass 0: Local preprocessing (analyzeCommitIntelligence)
// Single Claude call: Architecture + prose in one streaming response.

import type { CommitData, Repository } from '@/lib/types';
import type {
  CommitIntelligenceResult,
  EnrichedGeneratedStory,
  EnrichedStoryChapter,
  ContributorSpotlight,
  NarrativePipelineProgress,
} from '@/lib/narrative-types';
import { analyzeCommitIntelligence, serializeForPrompt } from '@/lib/narrative-preprocessor';

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_OUTPUT_TOKENS = 16384;

// =============================================================================
// STREAMING PARSER TYPES
// =============================================================================

type ParserPhase =
  | 'before_metadata'
  | 'in_metadata'
  | 'between_chapters'
  | 'in_chapter'
  | 'done';

interface PartialChapter {
  id: string;
  index: number;
  title: string;
  dateRange: { start: string; end: string };
  repos: string[];
  chapterType: string;
  content: string;
  isComplete: boolean;
}

interface StoryMetadata {
  title: string;
  subtitle: string;
  overarchingArc: { title: string; theme: string; narrativeType: string };
  milestones: Array<{
    date: string;
    title: string;
    description: string;
    type: string;
    significance: number;
    relatedRepos: string[];
    relatedCommitShas: string[];
    icon: string;
    chapterId: string;
  }>;
  crossRepoConnections: Array<{
    type: string;
    fromRepo: string;
    toRepo: string;
    description: string;
  }>;
  contributorSpotlights: Array<{
    name: string;
    narrative: string;
    repos: string[];
    commitCount: number;
    chapterId: string;
  }>;
}

interface ParserState {
  phase: ParserPhase;
  buffer: string;
  metadata: StoryMetadata | null;
  chapters: PartialChapter[];
  currentChapterIdx: number;
}

// =============================================================================
// STREAMING PARSER
// =============================================================================

function createParserState(): ParserState {
  return {
    phase: 'before_metadata',
    buffer: '',
    metadata: null,
    chapters: [],
    currentChapterIdx: -1,
  };
}

const METADATA_START = '---METADATA_START---';
const METADATA_END = '---METADATA_END---';
const CHAPTER_START_PREFIX = '---CHAPTER_START';
const CHAPTER_END = '---CHAPTER_END---';

function parseChapterAttributes(line: string): Partial<PartialChapter> {
  const attrs: Partial<PartialChapter> = {};

  const idMatch = line.match(/id="([^"]+)"/);
  if (idMatch) attrs.id = idMatch[1];

  const indexMatch = line.match(/index="(\d+)"/);
  if (indexMatch) attrs.index = parseInt(indexMatch[1], 10);

  const titleMatch = line.match(/title="([^"]+)"/);
  if (titleMatch) attrs.title = titleMatch[1];

  const dateMatch = line.match(/dateRange="([^"]+)"/);
  if (dateMatch) {
    const parts = dateMatch[1].split('..');
    attrs.dateRange = { start: parts[0] || '', end: parts[1] || '' };
  }

  const reposMatch = line.match(/repos="([^"]+)"/);
  if (reposMatch) attrs.repos = reposMatch[1].split(',').map((r) => r.trim());

  const typeMatch = line.match(/type="([^"]+)"/);
  if (typeMatch) attrs.chapterType = typeMatch[1];

  return attrs;
}

/**
 * Process a new text chunk through the streaming parser.
 * Returns true if something changed (emit update to UI).
 */
function processChunk(
  state: ParserState,
  text: string
): boolean {
  state.buffer += text;
  let changed = false;

  // Keep processing until no more delimiters are found in the buffer
  let continueProcessing = true;
  while (continueProcessing) {
    continueProcessing = false;

    switch (state.phase) {
      case 'before_metadata': {
        const startIdx = state.buffer.indexOf(METADATA_START);
        if (startIdx !== -1) {
          state.buffer = state.buffer.slice(startIdx + METADATA_START.length);
          state.phase = 'in_metadata';
          continueProcessing = true;
        }
        break;
      }

      case 'in_metadata': {
        const endIdx = state.buffer.indexOf(METADATA_END);
        if (endIdx !== -1) {
          const jsonStr = state.buffer.slice(0, endIdx).trim();
          state.buffer = state.buffer.slice(endIdx + METADATA_END.length);

          try {
            state.metadata = JSON.parse(jsonStr) as StoryMetadata;
          } catch {
            // Try to extract JSON object from potentially malformed content
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                state.metadata = JSON.parse(jsonMatch[0]) as StoryMetadata;
              } catch {
                // Use defaults
                state.metadata = {
                  title: 'Your Developer Journey',
                  subtitle: 'A story told through commits',
                  overarchingArc: { title: 'A Developer\'s Journey', theme: 'Growth', narrativeType: 'growth' },
                  milestones: [],
                  crossRepoConnections: [],
                  contributorSpotlights: [],
                };
              }
            }
          }

          state.phase = 'between_chapters';
          changed = true;
          continueProcessing = true;
        }
        break;
      }

      case 'between_chapters': {
        const chapterIdx = state.buffer.indexOf(CHAPTER_START_PREFIX);
        if (chapterIdx !== -1) {
          // Find the end of the delimiter line (---)
          const lineEnd = state.buffer.indexOf('---', chapterIdx + CHAPTER_START_PREFIX.length);
          if (lineEnd !== -1) {
            const delimiterLine = state.buffer.slice(chapterIdx, lineEnd + 3);
            state.buffer = state.buffer.slice(lineEnd + 3);

            // Remove leading newlines from buffer
            state.buffer = state.buffer.replace(/^\n+/, '');

            const attrs = parseChapterAttributes(delimiterLine);
            const chapterNum = state.chapters.length;

            const chapter: PartialChapter = {
              id: attrs.id || `ch-${chapterNum + 1}`,
              index: attrs.index ?? chapterNum,
              title: attrs.title || `Chapter ${chapterNum + 1}`,
              dateRange: attrs.dateRange || { start: '', end: '' },
              repos: attrs.repos || [],
              chapterType: attrs.chapterType || 'growth',
              content: '',
              isComplete: false,
            };

            state.chapters.push(chapter);
            state.currentChapterIdx = state.chapters.length - 1;
            state.phase = 'in_chapter';
            changed = true;
            continueProcessing = true;
          }
        }
        break;
      }

      case 'in_chapter': {
        const endIdx = state.buffer.indexOf(CHAPTER_END);
        if (endIdx !== -1) {
          // Chapter complete — emit the full chapter at once
          const content = state.buffer.slice(0, endIdx).trimEnd();
          state.chapters[state.currentChapterIdx].content = content;
          state.chapters[state.currentChapterIdx].isComplete = true;
          state.buffer = state.buffer.slice(endIdx + CHAPTER_END.length);
          state.phase = 'between_chapters';
          changed = true;
          continueProcessing = true;
        }
        // While chapter is still streaming, do NOT emit partial content.
        // The chapter will appear all at once when complete — no flickering.
        break;
      }

      case 'done':
        break;
    }
  }

  return changed;
}

/**
 * Finalize the parser state — handle any remaining buffered content.
 */
function finalizeParser(state: ParserState): void {
  // If we're still in a chapter, finalize it with whatever we have
  if (state.phase === 'in_chapter' && state.currentChapterIdx >= 0) {
    state.chapters[state.currentChapterIdx].content = state.buffer.trim();
    state.chapters[state.currentChapterIdx].isComplete = true;
    state.buffer = '';
  }

  // If no chapters or metadata were found, create a fallback
  if (state.chapters.length === 0 && state.buffer.trim().length > 0) {
    // Entire response was unstructured — wrap as a single chapter
    state.chapters.push({
      id: 'ch-1',
      index: 0,
      title: 'Your Developer Journey',
      dateRange: { start: '', end: '' },
      repos: [],
      chapterType: 'growth',
      content: state.buffer.trim(),
      isComplete: true,
    });
  }

  if (!state.metadata) {
    state.metadata = {
      title: 'Your Developer Journey',
      subtitle: 'A story told through commits',
      overarchingArc: { title: 'A Developer\'s Journey', theme: 'Growth', narrativeType: 'growth' },
      milestones: [],
      crossRepoConnections: [],
      contributorSpotlights: [],
    };
  }

  state.phase = 'done';
}

// =============================================================================
// BUILD ENRICHED STORY FROM PARSER STATE
// =============================================================================

function buildPartialStory(
  state: ParserState,
  intelligence: CommitIntelligenceResult,
  startTime: number
): Partial<EnrichedGeneratedStory> {
  const meta = state.metadata;

  const chapters: EnrichedStoryChapter[] = state.chapters.map((ch) => {
    const startMs = ch.dateRange.start ? new Date(ch.dateRange.start).getTime() : 0;
    const endMs = ch.dateRange.end ? new Date(ch.dateRange.end).getTime() : 0;

    return {
      id: ch.id,
      index: ch.index,
      title: ch.title,
      content: ch.content,
      dateRange: {
        start: ch.dateRange.start,
        end: ch.dateRange.end,
        totalDays: startMs && endMs ? Math.ceil((endMs - startMs) / 86400000) : 0,
      },
      repoIds: ch.repos,
      anchorId: `chapter-${ch.index + 1}`,
      chapterType: ch.chapterType,
      moodProgression: '',
    };
  });

  // Build contributor spotlights from metadata + intelligence data
  const spotlights: ContributorSpotlight[] = [];
  if (meta?.contributorSpotlights) {
    for (const cs of meta.contributorSpotlights) {
      const contributor = intelligence.contributors.find(
        (c) =>
          c.name.toLowerCase() === cs.name.toLowerCase() ||
          c.login?.toLowerCase() === cs.name.toLowerCase()
      );
      spotlights.push({
        contributorId: contributor?.id || cs.name,
        contributorName: cs.name,
        avatarUrl: contributor?.avatarUrl || null,
        narrative: cs.narrative,
        repos: cs.repos || [],
        commitCount: cs.commitCount || 0,
        chapterId: cs.chapterId || '',
      });
    }
  }

  return {
    id: `narrative-${Date.now()}`,
    type: 'unified' as const,
    title: meta?.title || 'Your Developer Journey',
    subtitle: meta?.subtitle || 'A story told through commits',
    overarchingArc: meta?.overarchingArc || {
      title: 'A Developer\'s Journey',
      theme: 'Growth',
      narrativeType: 'growth',
    },
    chapters,
    milestones: (meta?.milestones || []).map((m) => ({
      date: m.date,
      title: m.title,
      description: m.description,
      type: m.type || 'milestone',
      significance: m.significance,
      relatedRepos: m.relatedRepos || [],
      relatedCommitShas: m.relatedCommitShas || [],
      icon: m.icon || '🔖',
      chapterId: m.chapterId || '',
    })),
    crossRepoConnections: (meta?.crossRepoConnections || []).map((c) => ({
      type: c.type,
      fromRepo: c.fromRepo,
      toRepo: c.toRepo,
      description: c.description,
    })),
    contributorSpotlights: spotlights,
    generatedAt: Date.now(),
    dateRange: {
      start: intelligence.meta.dateRange.start,
      end: intelligence.meta.dateRange.end,
      totalDays: intelligence.meta.dateRange.totalDays,
    },
    model: MODEL,
    passMetadata: {
      totalApiCalls: 1,
      totalGenerationTimeMs: Date.now() - startTime,
    },
  };
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export async function generateNarrativeStreaming(
  commitsByRepo: Record<string, CommitData[]>,
  repositories: Repository[],
  claudeToken: string,
  onProgress: (progress: NarrativePipelineProgress) => void,
  onPartialStory: (partial: Partial<EnrichedGeneratedStory>) => void,
  signal?: AbortSignal
): Promise<EnrichedGeneratedStory> {
  const startTime = Date.now();

  const progress: NarrativePipelineProgress = {
    currentPass: 'preprocessing',
    overallProgress: 0,
    currentStep: 'Analyzing commit intelligence...',
    chaptersCompleted: 0,
    totalChapters: 0,
    reposAnalyzed: 0,
    totalRepos: Object.keys(commitsByRepo).length,
    error: null,
  };

  const updateProgress = (update: Partial<NarrativePipelineProgress>) => {
    Object.assign(progress, update);
    onProgress({ ...progress });
  };

  try {
    // =========================================================================
    // PASS 0: Local preprocessing
    // =========================================================================
    updateProgress({
      currentPass: 'preprocessing',
      overallProgress: 5,
      currentStep: 'Extracting signals from commit data...',
    });

    const intelligence = analyzeCommitIntelligence(commitsByRepo, repositories);

    updateProgress({
      overallProgress: 10,
      currentStep: `Found ${intelligence.narrativeEvents.length} events, ${intelligence.windows.length} time periods`,
    });

    if (signal?.aborted) throw new Error('Aborted');

    // =========================================================================
    // SERIALIZE DATA FOR PROMPT
    // =========================================================================
    const serialized = serializeForPrompt(intelligence, 50000);

    // =========================================================================
    // SINGLE STREAMING CALL
    // =========================================================================
    updateProgress({
      currentPass: 'streaming',
      overallProgress: 12,
      currentStep: 'Connecting to Claude...',
    });

    const { UNIFIED_NARRATIVE_SYSTEM, buildUnifiedUserMessage } =
      await import('@/lib/narrative-prompts-v2');

    const userMessage = buildUnifiedUserMessage(
      serialized,
      intelligence.meta.totalRepos,
      intelligence.meta.totalCommits,
      intelligence.meta.uniqueContributors
    );

    // Fetch SSE from our streaming API route
    const response = await fetch('/api/story/generate-v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${claudeToken}`,
      },
      body: JSON.stringify({
        systemPrompt: UNIFIED_NARRATIVE_SYSTEM,
        userMessage,
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        model: MODEL,
      }),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      let msg = `API error (${response.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        msg = parsed.error?.message || parsed.error || msg;
      } catch {
        msg = errorBody || msg;
      }
      throw new Error(msg);
    }

    if (!response.body) {
      throw new Error('No response body from streaming API');
    }

    // =========================================================================
    // STREAM PARSING
    // =========================================================================
    updateProgress({
      currentPass: 'writing',
      overallProgress: 15,
      currentStep: 'Generating your story...',
    });

    const state = createParserState();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let lastProgressUpdate = Date.now();

    while (true) {
      if (signal?.aborted) throw new Error('Aborted');

      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the buffer
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.text) {
              const changed = processChunk(state, event.text);

              if (changed) {
                // Emit partial story only on key events:
                // metadata parsed, new chapter started, chapter completed
                const partial = buildPartialStory(state, intelligence, startTime);
                onPartialStory(partial);
              }

              // Update progress text periodically (every 500ms) even without story changes
              const now = Date.now();
              if (changed || now - lastProgressUpdate > 500) {
                lastProgressUpdate = now;
                const completedChapters = state.chapters.filter((c) => c.isComplete).length;
                const totalChapters = state.chapters.length;
                const inProgressChapter = state.chapters[state.currentChapterIdx];
                const progressPct = state.metadata
                  ? 20 + Math.round((completedChapters / Math.max(totalChapters, 4)) * 70)
                  : 15;

                updateProgress({
                  currentPass: 'writing',
                  overallProgress: Math.min(progressPct, 92),
                  chaptersCompleted: completedChapters,
                  totalChapters,
                  currentStep: inProgressChapter && !inProgressChapter.isComplete
                    ? `Writing "${inProgressChapter.title}"...`
                    : state.metadata
                      ? `${completedChapters} of ${totalChapters} chapters complete`
                      : 'Planning your story...',
                });
              }
            }
          } catch {
            // Skip malformed SSE data
          }
        }

        if (line.startsWith('event: error')) {
          // Next data line will contain the error
          continue;
        }
      }
    }

    // =========================================================================
    // FINALIZE
    // =========================================================================
    finalizeParser(state);

    const finalStory = buildPartialStory(
      state,
      intelligence,
      startTime
    ) as EnrichedGeneratedStory;

    // Emit final story
    onPartialStory(finalStory);

    updateProgress({
      currentPass: 'complete',
      overallProgress: 100,
      chaptersCompleted: state.chapters.length,
      totalChapters: state.chapters.length,
      currentStep: 'Your story is ready!',
    });

    return finalStory;
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown error during narrative generation';
    updateProgress({
      currentPass: 'error',
      error: errorMsg,
      currentStep: `Error: ${errorMsg}`,
    });
    throw err;
  }
}
