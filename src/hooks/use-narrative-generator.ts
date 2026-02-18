'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGitData } from '@/context/git-data-provider';
import { useAuth } from '@/context/auth-provider';
import type {
  GeneratedStory,
  StoryChapter,
  StoryGenerationProgress,
  StoryPhase,
  StoryMilestone,
  DateRange,
} from '@/lib/types';
import type {
  EnrichedGeneratedStory,
  NarrativePipelineProgress,
} from '@/lib/narrative-types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseNarrativeGeneratorReturn {
  /** The enriched story from the multi-pass pipeline */
  story: EnrichedGeneratedStory | null;
  /** Partial story streaming in (chapters appear progressively) */
  partialStory: Partial<EnrichedGeneratedStory> | null;
  /** Converted GeneratedStory for backward-compatible components */
  unifiedStory: GeneratedStory | null;
  /** Empty array — new pipeline generates unified only, no per-repo stories */
  stories: GeneratedStory[];
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Progress mapped to StoryGenerationProgress for existing components */
  progress: StoryGenerationProgress;
  /** Rich pipeline progress with chapter/pass details */
  narrativeProgress: NarrativePipelineProgress;
  /** Start generating the narrative story */
  generateStory: () => Promise<void>;
  /** Abort + reset + regenerate */
  regenerate: () => Promise<void>;
  /** Error message if generation failed */
  error: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function createInitialProgress(): NarrativePipelineProgress {
  return {
    currentPass: 'preprocessing',
    overallProgress: 0,
    currentStep: 'Waiting to start...',
    chaptersCompleted: 0,
    totalChapters: 0,
    reposAnalyzed: 0,
    totalRepos: 0,
    error: null,
  };
}

/** Map NarrativePipelineProgress.currentPass → StoryPhase */
function mapPassToPhase(pass: NarrativePipelineProgress['currentPass']): StoryPhase {
  const map: Record<string, StoryPhase> = {
    preprocessing: 'preprocessing' as StoryPhase,
    analyzing: 'analyzing-repos' as StoryPhase,
    correlating: 'correlating' as StoryPhase,
    streaming: 'writing-chapters' as StoryPhase,
    writing: 'writing-chapters' as StoryPhase,
    enriching: 'enriching' as StoryPhase,
    complete: 'complete' as StoryPhase,
    error: 'error' as StoryPhase,
  };
  return map[pass] || ('idle' as StoryPhase);
}

// =============================================================================
// CONVERSION: EnrichedGeneratedStory -> GeneratedStory
// =============================================================================

/**
 * Wrap an EnrichedGeneratedStory as a GeneratedStory for compatibility
 * with the existing GitDataProvider's setUnifiedStory.
 */
function toGeneratedStory(enriched: EnrichedGeneratedStory): GeneratedStory {
  const chapters: StoryChapter[] = enriched.chapters.map((ch) => ({
    index: ch.index,
    title: ch.title,
    content: ch.content,
    dateRange: ch.dateRange as DateRange,
    repoIds: ch.repoIds,
    anchorId: ch.anchorId,
  }));

  const VALID_TYPES = new Set([
    'project-start', 'major-release', 'pivot', 'breakthrough',
    'collaboration', 'milestone', 'achievement',
  ]);

  const milestones = enriched.milestones.map((m) => ({
    date: m.date,
    title: m.title,
    description: m.description,
    repoId: m.relatedRepos[0] || null,
    repoName: m.relatedRepos[0]?.split('/').pop() || null,
    type: (VALID_TYPES.has(m.type) ? m.type : 'milestone') as StoryMilestone['type'],
    significance: m.significance,
    relatedCommits: m.relatedCommitShas || [],
    icon: m.icon,
  }));

  // Compute combined content
  const content = enriched.chapters
    .map((ch) => `## ${ch.title}\n\n${ch.content}`)
    .join('\n\n');

  return {
    id: enriched.id,
    type: 'unified',
    repoId: null,
    title: enriched.title,
    subtitle: enriched.subtitle,
    content,
    chapters,
    milestones,
    generatedAt: enriched.generatedAt,
    dateRange: enriched.dateRange as DateRange,
    model: enriched.model,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useNarrativeGenerator(): UseNarrativeGeneratorReturn {
  const {
    commitsByRepo,
    selectedRepositories,
    setUnifiedStory,
  } = useGitData();
  const { claudeToken } = useAuth();

  const [story, setStory] = useState<EnrichedGeneratedStory | null>(null);
  const [partialStory, setPartialStory] = useState<Partial<EnrichedGeneratedStory> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<NarrativePipelineProgress>(
    createInitialProgress()
  );
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateStory = useCallback(async () => {
    if (isGenerating) return;

    if (!claudeToken) {
      setError('Please connect your Claude API token to generate stories.');
      return;
    }

    const repoIds = Object.keys(commitsByRepo).filter(
      (id) => (commitsByRepo[id]?.length || 0) > 0
    );

    if (repoIds.length === 0) {
      setError(
        'No commit data available. Please select repositories and fetch commits first.'
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStory(null);
    setPartialStory(null);
    setProgress(createInitialProgress());

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Dynamically import the streaming pipeline
      const { generateNarrativeStreaming } = await import('@/lib/narrative-pipeline-v2');

      const enrichedStory = await generateNarrativeStreaming(
        commitsByRepo,
        selectedRepositories,
        claudeToken,
        (p: NarrativePipelineProgress) => {
          if (isMountedRef.current) {
            setProgress({ ...p });
          }
        },
        (partial: Partial<EnrichedGeneratedStory>) => {
          if (isMountedRef.current) {
            setPartialStory({ ...partial });
          }
        },
        abortController.signal
      );

      if (isMountedRef.current && enrichedStory) {
        setStory(enrichedStory);
        setPartialStory(null);

        // Also set as unified story in GitDataProvider for compatibility
        const generatedStory = toGeneratedStory(enrichedStory);
        setUnifiedStory(generatedStory);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError' || (err as Error).message === 'Aborted') {
        return;
      }
      console.error('Narrative generation error:', err);
      if (isMountedRef.current) {
        const msg =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during story generation.';
        setError(msg);
        setProgress((prev) => ({
          ...prev,
          currentPass: 'error',
          error: msg,
          currentStep: `Error: ${msg}`,
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    claudeToken,
    commitsByRepo,
    selectedRepositories,
    setUnifiedStory,
  ]);

  const regenerate = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStory(null);
    setPartialStory(null);
    setError(null);
    setProgress(createInitialProgress());
    setIsGenerating(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await generateStory();
  }, [generateStory]);

  // Compute backward-compatible values
  const unifiedStory = story ? toGeneratedStory(story) : null;
  const emptyStories: GeneratedStory[] = [];

  const totalCommits = Object.values(commitsByRepo).reduce(
    (sum, commits) => sum + (commits?.length || 0),
    0
  );

  const mappedProgress: StoryGenerationProgress = {
    phase: mapPassToPhase(progress.currentPass),
    overallProgress: progress.overallProgress,
    currentStep: progress.currentStep,
    reposProcessed: progress.reposAnalyzed,
    totalRepos: progress.totalRepos,
    commitsSummarized: totalCommits,
    totalCommits,
    estimatedTimeRemaining: null,
  };

  return {
    story,
    partialStory,
    unifiedStory,
    stories: emptyStories,
    isGenerating,
    progress: mappedProgress,
    narrativeProgress: progress,
    generateStory,
    regenerate,
    error,
  };
}
