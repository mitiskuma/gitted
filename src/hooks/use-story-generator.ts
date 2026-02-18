'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGitData } from '@/context/git-data-provider';
import { useAuth } from '@/context/auth-provider';
import { useAppStore } from '@/stores/app-store';
import type { CommitBatch } from '@/lib/commit-processor';
import type {
  GeneratedStory,
  StoryGenerationProgress,
  StoryPhase,
  UseStoryGeneratorReturn,
  StoryChapter,
  StoryMilestone,
  CommitSummaryBatch,
  DateRange,
} from '@/lib/types';

const STORY_CACHE_TTL = 86400000; // 24 hours

function createInitialProgress(): StoryGenerationProgress {
  return {
    phase: 'idle' as StoryPhase,
    overallProgress: 0,
    currentStep: 'Waiting to start...',
    reposProcessed: 0,
    totalRepos: 0,
    commitsSummarized: 0,
    totalCommits: 0,
    estimatedTimeRemaining: null,
  };
}

function generateStoryId(type: 'repo' | 'unified', repoId?: string): string {
  const base = type === 'unified' ? 'unified' : `repo-${repoId}`;
  return `story-${base}-${Date.now()}`;
}

function computeDateRange(timestamps: number[]): DateRange {
  if (timestamps.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now, totalDays: 0 };
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  const start = new Date(sorted[0]).toISOString();
  const end = new Date(sorted[sorted.length - 1]).toISOString();
  const totalDays = Math.ceil((sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24));
  return { start, end, totalDays };
}

// Store the dynamically loaded function
type BatchCommitsForClaudeFn = (commits: import('@/lib/commit-processor').CommitData[], maxPerBatch: number) => CommitBatch[];

let batchCommitsForClaudeCache: BatchCommitsForClaudeFn | null = null;

async function loadBatchCommitsForClaude(): Promise<BatchCommitsForClaudeFn> {
  if (batchCommitsForClaudeCache) return batchCommitsForClaudeCache;
  const mod = await import('@/lib/commit-processor');
  batchCommitsForClaudeCache = mod.batchCommitsForClaude;
  return mod.batchCommitsForClaude;
}

export function useStoryGenerator(): UseStoryGeneratorReturn {
  const { commitsByRepo, allCommitsSorted, selectedRepositories, stories: cachedStories, unifiedStory: cachedUnifiedStory, addStory, setUnifiedStory } = useGitData();
  const { claudeToken } = useAuth();
  const { selectedRepos } = useAppStore();

  const [stories, setStories] = useState<GeneratedStory[]>(cachedStories || []);
  const [unifiedStory, setUnifiedStoryLocal] = useState<GeneratedStory | null>(cachedUnifiedStory || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<StoryGenerationProgress>(createInitialProgress());
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

  // Sync cached stories from GitDataProvider
  useEffect(() => {
    if (cachedStories && cachedStories.length > 0) {
      setStories(cachedStories);
    }
  }, [cachedStories]);

  useEffect(() => {
    if (cachedUnifiedStory) {
      setUnifiedStoryLocal(cachedUnifiedStory);
    }
  }, [cachedUnifiedStory]);

  const updateProgress = useCallback((update: Partial<StoryGenerationProgress>) => {
    if (!isMountedRef.current) return;
    setProgress(prev => ({ ...prev, ...update }));
  }, []);

  const generateRepoStory = useCallback(async (
    repoId: string,
    batches: CommitSummaryBatch[],
    signal: AbortSignal
  ): Promise<GeneratedStory | null> => {
    if (!claudeToken) {
      throw new Error('Claude token is required for story generation');
    }

    try {
      // Find repo metadata from selectedRepositories
      const repo = selectedRepositories.find(r => r.fullName === repoId || r.id === repoId);
      const repoMeta = {
        name: repo?.name || batches[0]?.repoName || repoId.split('/').pop() || repoId,
        fullName: repo?.fullName || repoId,
        description: repo?.description || null,
        language: repo?.language || null,
        languages: repo?.languages || {},
        starCount: repo?.starCount || 0,
        createdAt: repo?.createdAt || batches[0]?.period.start || new Date().toISOString(),
        topics: repo?.topics || [],
        isPrivate: repo?.isPrivate || false,
        defaultBranch: repo?.defaultBranch || 'main',
      };

      if (isMountedRef.current) {
        updateProgress({
          currentStep: `Generating story for ${repoMeta.name}...`,
        });
      }

      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${claudeToken}`,
        },
        body: JSON.stringify({
          type: 'single',
          repoMeta,
          commitSummaries: batches,
          stream: false,
        }),
        signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: { message: 'Story generation failed' } }));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Story generation returned no data');
      }

      return result.data as GeneratedStory;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      throw err;
    }
  }, [claudeToken, updateProgress, selectedRepositories]);

  const generateUnifiedStoryFromBatches = useCallback(async (
    allBatches: CommitSummaryBatch[],
    repoStories: GeneratedStory[],
    signal: AbortSignal
  ): Promise<GeneratedStory | null> => {
    if (!claudeToken) {
      throw new Error('Claude token is required for story generation');
    }

    try {
      if (isMountedRef.current) {
        updateProgress({
          currentStep: 'Weaving your unified developer journey...',
        });
      }

      // Group batches by repoId and build repo metadata for each
      const batchesByRepo: Record<string, CommitSummaryBatch[]> = {};
      for (const batch of allBatches) {
        if (!batchesByRepo[batch.repoId]) {
          batchesByRepo[batch.repoId] = [];
        }
        batchesByRepo[batch.repoId].push(batch);
      }

      const repos = Object.entries(batchesByRepo).map(([repoId, repoBatches]) => {
        const repo = selectedRepositories.find(r => r.fullName === repoId || r.id === repoId);
        return {
          repoMeta: {
            name: repo?.name || repoBatches[0]?.repoName || repoId.split('/').pop() || repoId,
            fullName: repo?.fullName || repoId,
            description: repo?.description || null,
            language: repo?.language || null,
            languages: repo?.languages || {},
            starCount: repo?.starCount || 0,
            createdAt: repo?.createdAt || repoBatches[0]?.period.start || new Date().toISOString(),
            topics: repo?.topics || [],
            isPrivate: repo?.isPrivate || false,
            defaultBranch: repo?.defaultBranch || 'main',
          },
          commitSummaries: repoBatches,
        };
      });

      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${claudeToken}`,
        },
        body: JSON.stringify({
          type: 'unified',
          repos,
          stream: false,
        }),
        signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: { message: 'Unified story generation failed' } }));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Unified story generation returned no data');
      }

      return result.data as GeneratedStory;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      throw err;
    }
  }, [claudeToken, updateProgress, selectedRepositories]);

  const generateStory = useCallback(async () => {
    if (isGenerating) return;
    if (!claudeToken) {
      setError('Please connect your Claude API token to generate stories.');
      return;
    }
    if (selectedRepos.length === 0) {
      setError('No repositories selected. Please select repos from the Connect page.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStories([]);
    setUnifiedStoryLocal(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const totalRepos = selectedRepos.length;
    const totalCommits = allCommitsSorted.length;

    updateProgress({
      phase: 'batching-commits' as StoryPhase,
      overallProgress: 5,
      currentStep: 'Preparing commit data for analysis...',
      reposProcessed: 0,
      totalRepos,
      commitsSummarized: 0,
      totalCommits,
      estimatedTimeRemaining: totalRepos * 15,
    });

    try {
      // Dynamically load the batchCommitsForClaude function
      const batchCommitsForClaude = await loadBatchCommitsForClaude();

      // Step 1: Batch commits per repo
      const allBatches: CommitSummaryBatch[] = [];
      const batchesByRepo: Record<string, CommitSummaryBatch[]> = {};

      for (const repoId of selectedRepos) {
        if (abortController.signal.aborted) return;

        const repoCommits = commitsByRepo[repoId] || [];
        if (repoCommits.length === 0) continue;

        const batches = batchCommitsForClaude(repoCommits, 100);

        // Convert CommitBatch[] to CommitSummaryBatch[] format
        const summaryBatches: CommitSummaryBatch[] = batches.map((batch: CommitBatch) => {
          const messages = batch.commits.map(c => c.messageHeadline);
          const uniqueMessages = [...new Set(messages)];
          const keyFiles = [...new Set(
            batch.commits.flatMap(c => c.files.map(f => f.path)).slice(0, 20)
          )];
          const contributors = [...new Set(batch.commits.map(c => c.author.name))];
          const netAdditions = batch.commits.reduce((sum, c) => sum + c.additions, 0);
          const netDeletions = batch.commits.reduce((sum, c) => sum + c.deletions, 0);

          const timestamps = batch.commits.map(c => c.timestampMs);
          const period = computeDateRange(timestamps);

          // Detect patterns
          const patterns: string[] = [];
          const fixCount = batch.commits.filter(c => /\bfix\b/i.test(c.messageHeadline)).length;
          const featCount = batch.commits.filter(c => /\b(feat|feature)\b/i.test(c.messageHeadline)).length;
          const refactorCount = batch.commits.filter(c => /\brefactor\b/i.test(c.messageHeadline)).length;

          if (fixCount > batch.commits.length * 0.3) patterns.push('bug-fixing-heavy');
          if (featCount > batch.commits.length * 0.3) patterns.push('feature-development');
          if (refactorCount > batch.commits.length * 0.2) patterns.push('refactoring-phase');
          if (netAdditions > netDeletions * 3) patterns.push('rapid-growth');
          if (netDeletions > netAdditions * 2) patterns.push('cleanup-phase');

          return {
            repoId: batch.repoId,
            repoName: repoCommits[0]?.repoName || repoId.split('/').pop() || repoId,
            period,
            commitCount: batch.commits.length,
            messageSummary: uniqueMessages.slice(0, 50).join('; '),
            keyFilesChanged: keyFiles,
            netAdditions,
            netDeletions,
            contributors,
            patterns,
          };
        });

        batchesByRepo[repoId] = summaryBatches;
        allBatches.push(...summaryBatches);
      }

      if (abortController.signal.aborted) return;

      updateProgress({
        phase: 'summarizing' as StoryPhase,
        overallProgress: 20,
        currentStep: 'Analyzing commit patterns and themes...',
        commitsSummarized: totalCommits,
        totalCommits,
      });

      // Step 2: Generate per-repo stories
      const generatedStories: GeneratedStory[] = [];

      for (let i = 0; i < selectedRepos.length; i++) {
        if (abortController.signal.aborted) return;

        const repoId = selectedRepos[i];
        const repoBatches = batchesByRepo[repoId];

        if (!repoBatches || repoBatches.length === 0) continue;

        updateProgress({
          phase: 'generating-narrative' as StoryPhase,
          overallProgress: 20 + Math.round(((i + 1) / totalRepos) * 50),
          currentStep: `Crafting story for ${repoBatches[0]?.repoName || repoId}... (${i + 1}/${totalRepos})`,
          reposProcessed: i,
          totalRepos,
          estimatedTimeRemaining: (totalRepos - i) * 12,
        });

        try {
          const story = await generateRepoStory(repoId, repoBatches, abortController.signal);
          if (story && isMountedRef.current) {
            generatedStories.push(story);
            setStories(prev => [...prev, story]);
            addStory(story);
          }
        } catch (repoErr) {
          console.error(`Failed to generate story for ${repoId}:`, repoErr);
          // Generate a fallback story from the batch data
          const fallbackStory = createFallbackStory(repoId, repoBatches);
          generatedStories.push(fallbackStory);
          if (isMountedRef.current) {
            setStories(prev => [...prev, fallbackStory]);
            addStory(fallbackStory);
          }
        }
      }

      if (abortController.signal.aborted) return;

      // Step 3: Generate unified developer journey
      updateProgress({
        phase: 'generating-narrative' as StoryPhase,
        overallProgress: 75,
        currentStep: 'Weaving your complete developer journey...',
        reposProcessed: totalRepos,
        totalRepos,
        estimatedTimeRemaining: 20,
      });

      // Sort all batches chronologically (oldest first) before unified story generation
      const chronologicalBatches = [...allBatches].sort((a, b) => {
        const aStart = new Date(a.period.start).getTime();
        const bStart = new Date(b.period.start).getTime();
        return aStart - bStart;
      });

      try {
        const unified = await generateUnifiedStoryFromBatches(
          chronologicalBatches,
          generatedStories,
          abortController.signal
        );

        if (unified && isMountedRef.current) {
          setUnifiedStoryLocal(unified);
          setUnifiedStory(unified);
        }
      } catch (unifiedErr) {
        console.error('Failed to generate unified story:', unifiedErr);
        // Create fallback unified story
        const fallbackUnified = createFallbackUnifiedStory(generatedStories, chronologicalBatches);
        if (isMountedRef.current) {
          setUnifiedStoryLocal(fallbackUnified);
          setUnifiedStory(fallbackUnified);
        }
      }

      if (abortController.signal.aborted) return;

      // Step 4: Extract milestones
      updateProgress({
        phase: 'extracting-milestones' as StoryPhase,
        overallProgress: 90,
        currentStep: 'Identifying key milestones in your journey...',
        estimatedTimeRemaining: 5,
      });

      // Small delay to show milestone phase
      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete
      updateProgress({
        phase: 'complete' as StoryPhase,
        overallProgress: 100,
        currentStep: 'Your developer story is ready!',
        reposProcessed: totalRepos,
        totalRepos,
        commitsSummarized: totalCommits,
        totalCommits,
        estimatedTimeRemaining: 0,
      });

    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Story generation error:', err);
      if (isMountedRef.current) {
        setError((err as Error).message || 'An unexpected error occurred during story generation.');
        updateProgress({
          phase: 'error' as StoryPhase,
          currentStep: 'Generation failed. Please try again.',
        });
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
    selectedRepos,
    allCommitsSorted,
    commitsByRepo,
    selectedRepositories,
    updateProgress,
    generateRepoStory,
    generateUnifiedStoryFromBatches,
    addStory,
    setUnifiedStory,
  ]);

  const regenerate = useCallback(async () => {
    // Abort any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset state
    setStories([]);
    setUnifiedStoryLocal(null);
    setError(null);
    setProgress(createInitialProgress());
    setIsGenerating(false);

    // Wait a tick then regenerate
    await new Promise(resolve => setTimeout(resolve, 100));
    await generateStory();
  }, [generateStory]);

  return {
    stories,
    unifiedStory,
    isGenerating,
    progress,
    generateStory,
    regenerate,
    error,
  };
}

// Helper: Parse the AI response into a structured GeneratedStory
function parseStoryResponse(
  rawContent: string,
  type: 'repo' | 'unified',
  repoId: string | null,
  batches: CommitSummaryBatch[]
): GeneratedStory {
  // Try to parse as JSON first (if the API returns structured data)
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed.title && parsed.content) {
      return {
        id: generateStoryId(type, repoId || undefined),
        type,
        repoId,
        title: parsed.title,
        subtitle: parsed.subtitle || '',
        content: parsed.content,
        chapters: parsed.chapters || extractChaptersFromContent(parsed.content, batches),
        milestones: parsed.milestones || extractMilestonesFromBatches(batches),
        generatedAt: Date.now(),
        dateRange: computeDateRangeFromBatches(batches),
        model: 'claude-opus-4-6',
      };
    }
  } catch {
    // Not JSON, treat as raw markdown
  }

  // Parse raw markdown content
  const title = extractTitleFromMarkdown(rawContent) ||
    (type === 'unified'
      ? 'Your Developer Journey'
      : `The Story of ${batches[0]?.repoName || repoId || 'Unknown'}`);

  const subtitle = type === 'unified'
    ? `A narrative spanning ${batches.length} chapters across ${new Set(batches.map(b => b.repoId)).size} repositories`
    : `${batches.reduce((sum, b) => sum + b.commitCount, 0)} commits that shaped this project`;

  const content = cleanMarkdownContent(rawContent);

  return {
    id: generateStoryId(type, repoId || undefined),
    type,
    repoId,
    title,
    subtitle,
    content,
    chapters: extractChaptersFromContent(content, batches),
    milestones: extractMilestonesFromBatches(batches),
    generatedAt: Date.now(),
    dateRange: computeDateRangeFromBatches(batches),
    model: 'claude-opus-4-6',
  };
}

function extractTitleFromMarkdown(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function cleanMarkdownContent(content: string): string {
  // Remove leading title if present (we extract it separately)
  return content.replace(/^#\s+.+\n+/, '').trim();
}

function extractChaptersFromContent(
  content: string,
  batches: CommitSummaryBatch[]
): StoryChapter[] {
  const chapters: StoryChapter[] = [];
  const sections = content.split(/(?=^##\s)/m).filter(s => s.trim());

  if (sections.length === 0) {
    // No clear sections, treat the whole content as one chapter
    return [{
      index: 0,
      title: 'The Beginning',
      content,
      dateRange: computeDateRangeFromBatches(batches),
      repoIds: [...new Set(batches.map(b => b.repoId))],
      anchorId: 'chapter-0',
    }];
  }

  sections.forEach((section, index) => {
    const titleMatch = section.match(/^##\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `Chapter ${index + 1}`;
    const chapterContent = section.replace(/^##\s+.+\n+/, '').trim();

    // Determine which repos this chapter relates to
    const relatedRepoIds = batches
      .filter(b => {
        const repoName = b.repoName.toLowerCase();
        return chapterContent.toLowerCase().includes(repoName);
      })
      .map(b => b.repoId);

    const uniqueRepoIds = [...new Set(relatedRepoIds.length > 0 ? relatedRepoIds : batches.map(b => b.repoId))];

    // Approximate date range for this chapter
    const chapterBatchIndex = Math.floor((index / sections.length) * batches.length);
    const chapterBatches = batches.slice(
      chapterBatchIndex,
      Math.min(chapterBatchIndex + Math.ceil(batches.length / sections.length), batches.length)
    );

    chapters.push({
      index,
      title,
      content: chapterContent,
      dateRange: computeDateRangeFromBatches(chapterBatches.length > 0 ? chapterBatches : batches),
      repoIds: uniqueRepoIds,
      anchorId: `chapter-${index}`,
    });
  });

  return chapters;
}

function extractMilestonesFromBatches(batches: CommitSummaryBatch[]): StoryMilestone[] {
  const milestones: StoryMilestone[] = [];

  // 1. Project start milestones — first batch per repo
  const repoStarts = new Map<string, CommitSummaryBatch>();
  for (const batch of batches) {
    if (!repoStarts.has(batch.repoId)) {
      repoStarts.set(batch.repoId, batch);
    }
  }

  for (const [repoId, batch] of repoStarts) {
    milestones.push({
      date: batch.period.start,
      title: `${batch.repoName} Created`,
      description: `The first commits were made to ${batch.repoName}, marking the beginning of a new project.`,
      repoId,
      repoName: batch.repoName,
      type: 'project-start',
      significance: 5,
      relatedCommits: [],
      icon: '🚀',
    });
  }

  // 2. Detect high-activity periods as breakthroughs
  const sortedBatches = [...batches].sort((a, b) => b.commitCount - a.commitCount);
  const avgCommitsPerBatch = batches.reduce((s, b) => s + b.commitCount, 0) / Math.max(batches.length, 1);
  const topBatches = sortedBatches.filter(b => b.commitCount > avgCommitsPerBatch * 2).slice(0, 5);

  for (const batch of topBatches) {
    milestones.push({
      date: batch.period.start,
      title: `Intense Development on ${batch.repoName}`,
      description: `A burst of ${batch.commitCount} commits with ${batch.netAdditions.toLocaleString()} lines added. ${batch.patterns.includes('feature-development') ? 'Major features were being built.' : batch.patterns.includes('bug-fixing-heavy') ? 'A focused bug-fixing sprint.' : 'Rapid iteration and development.'}`,
      repoId: batch.repoId,
      repoName: batch.repoName,
      type: 'breakthrough',
      significance: 3,
      relatedCommits: [],
      icon: '⚡',
    });
  }

  // 3. Detect pivots (major refactoring — large deletions followed by additions)
  for (let i = 1; i < batches.length; i++) {
    const prev = batches[i - 1];
    const curr = batches[i];

    if (prev.repoId === curr.repoId) {
      if (prev.netDeletions > prev.netAdditions * 2 && curr.netAdditions > curr.netDeletions * 2) {
        milestones.push({
          date: curr.period.start,
          title: `Architecture Pivot in ${curr.repoName}`,
          description: `After removing significant code, a new direction emerged with fresh implementations and patterns.`,
          repoId: curr.repoId,
          repoName: curr.repoName,
          type: 'pivot',
          significance: 4,
          relatedCommits: [],
          icon: '🔄',
        });
      }
    }
  }

  // 4. Detect largest single-batch contributions (most lines added)
  const largestByLines = [...batches].sort((a, b) => b.netAdditions - a.netAdditions);
  const topByLines = largestByLines.slice(0, 2);
  for (const batch of topByLines) {
    if (batch.netAdditions > 1000) {
      const alreadyExists = milestones.some(
        m => m.repoId === batch.repoId && m.date === batch.period.start
      );
      if (!alreadyExists) {
        milestones.push({
          date: batch.period.start,
          title: `Major Code Push to ${batch.repoName}`,
          description: `${batch.netAdditions.toLocaleString()} lines of code added across ${batch.keyFilesChanged.length} key files — a significant expansion of the codebase.`,
          repoId: batch.repoId,
          repoName: batch.repoName,
          type: 'achievement',
          significance: 3,
          relatedCommits: [],
          icon: '📈',
        });
      }
    }
  }

  // 5. Detect multi-contributor collaboration (if batch has many unique authors)
  for (const batch of batches) {
    if (batch.contributors && batch.contributors.length > 3) {
      milestones.push({
        date: batch.period.start,
        title: `Team Collaboration on ${batch.repoName}`,
        description: `${batch.contributors.length} contributors worked together during this period, showing strong team collaboration.`,
        repoId: batch.repoId,
        repoName: batch.repoName,
        type: 'collaboration',
        significance: 3,
        relatedCommits: [],
        icon: '🤝',
      });
    }
  }

  // 6. Detect milestone commit counts (100th, 500th, 1000th commit per repo)
  const commitCountPerRepo = new Map<string, number>();
  const commitThresholds = [100, 500, 1000, 5000];

  for (const batch of batches) {
    const prev = commitCountPerRepo.get(batch.repoId) || 0;
    const next = prev + batch.commitCount;
    commitCountPerRepo.set(batch.repoId, next);

    for (const threshold of commitThresholds) {
      if (prev < threshold && next >= threshold) {
        milestones.push({
          date: batch.period.end,
          title: `${threshold.toLocaleString()} Commits in ${batch.repoName}`,
          description: `${batch.repoName} reached ${threshold.toLocaleString()} commits — a testament to sustained development effort.`,
          repoId: batch.repoId,
          repoName: batch.repoName,
          type: 'milestone',
          significance: threshold >= 1000 ? 5 : threshold >= 500 ? 4 : 3,
          relatedCommits: [],
          icon: '🎯',
        });
      }
    }
  }

  // Sort milestones by date and deduplicate by date+title
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const seen = new Set<string>();
  return milestones.filter(m => {
    const key = `${m.date}:${m.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeDateRangeFromBatches(batches: CommitSummaryBatch[]): DateRange {
  if (batches.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now, totalDays: 0 };
  }

  const starts = batches.map(b => new Date(b.period.start).getTime());
  const ends = batches.map(b => new Date(b.period.end).getTime());

  const earliest = Math.min(...starts);
  const latest = Math.max(...ends);

  return {
    start: new Date(earliest).toISOString(),
    end: new Date(latest).toISOString(),
    totalDays: Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)),
  };
}

function createFallbackStory(
  repoId: string,
  batches: CommitSummaryBatch[]
): GeneratedStory {
  const repoName = batches[0]?.repoName || repoId.split('/').pop() || repoId;
  const totalCommits = batches.reduce((sum, b) => sum + b.commitCount, 0);
  const totalAdditions = batches.reduce((sum, b) => sum + b.netAdditions, 0);
  const totalDeletions = batches.reduce((sum, b) => sum + b.netDeletions, 0);
  const contributors = [...new Set(batches.flatMap(b => b.contributors))];
  const dateRange = computeDateRangeFromBatches(batches);

  const content = `## The Genesis of ${repoName}

Every great project starts with a single commit. **${repoName}** began its journey on ${new Date(dateRange.start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}, and has since grown through **${totalCommits} commits** of dedicated development.

## Building the Foundation

Over ${dateRange.totalDays} days, ${contributors.length > 1 ? `a team of ${contributors.length} contributors` : 'a dedicated developer'} shaped this codebase, adding **${totalAdditions.toLocaleString()} lines** while carefully removing **${totalDeletions.toLocaleString()} lines** — a testament to thoughtful iteration and refinement.

## Key Themes

${batches.some(b => b.patterns.includes('feature-development')) ? '- **Feature-driven development**: Consistent focus on building new capabilities\n' : ''}${batches.some(b => b.patterns.includes('bug-fixing-heavy')) ? '- **Quality-first mindset**: Dedicated effort to squashing bugs and improving reliability\n' : ''}${batches.some(b => b.patterns.includes('refactoring-phase')) ? '- **Code craftsmanship**: Regular refactoring to maintain clean architecture\n' : ''}${batches.some(b => b.patterns.includes('rapid-growth')) ? '- **Rapid growth**: Significant expansion of the codebase during key periods\n' : ''}

## Looking Forward

With ${totalCommits} commits in the rearview mirror, ${repoName} stands as a living document of problem-solving, creativity, and engineering discipline.`;

  return {
    id: generateStoryId('repo', repoId),
    type: 'repo',
    repoId,
    title: `The Story of ${repoName}`,
    subtitle: `${totalCommits} commits spanning ${dateRange.totalDays} days`,
    content,
    chapters: extractChaptersFromContent(content, batches),
    milestones: extractMilestonesFromBatches(batches),
    generatedAt: Date.now(),
    dateRange,
    model: 'fallback',
  };
}

function createFallbackUnifiedStory(
  repoStories: GeneratedStory[],
  allBatches: CommitSummaryBatch[]
): GeneratedStory {
  const totalCommits = allBatches.reduce((sum, b) => sum + b.commitCount, 0);
  const repoNames = [...new Set(allBatches.map(b => b.repoName))];
  const dateRange = computeDateRangeFromBatches(allBatches);

  const content = `## A Developer's Journey

This is the story of ${totalCommits.toLocaleString()} commits across ${repoNames.length} repositories — a narrative of growth, problem-solving, and creative engineering.

## The Projects

${repoStories.map(story => `### ${story.title}

${story.chapters[0]?.content?.slice(0, 200) || story.content.slice(0, 200)}...
`).join('\n')}

## The Arc

From ${new Date(dateRange.start).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} to ${new Date(dateRange.end).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}, this journey spans ${dateRange.totalDays} days of dedicated development across multiple codebases.

## Common Threads

Across all ${repoNames.length} repositories, patterns emerge: a commitment to iterative improvement, a willingness to refactor and rethink, and a steady rhythm of feature delivery that speaks to engineering maturity.

## What It All Means

Every commit tells a micro-story — a problem identified, a solution crafted, a test written, a bug squashed. Together, these ${totalCommits.toLocaleString()} micro-stories weave into something larger: a portrait of a developer in motion, constantly learning and building.`;

  return {
    id: generateStoryId('unified'),
    type: 'unified',
    repoId: null,
    title: 'Your Developer Journey',
    subtitle: `${totalCommits.toLocaleString()} commits across ${repoNames.length} repositories`,
    content,
    chapters: extractChaptersFromContent(content, allBatches),
    milestones: extractMilestonesFromBatches(allBatches),
    generatedAt: Date.now(),
    dateRange,
    model: 'fallback',
  };
}

// Suppress unused variable warning for STORY_CACHE_TTL
void STORY_CACHE_TTL;
