// src/lib/narrative-pipeline.ts
// Multi-pass narrative generation orchestrator.
// Pass 0: Local preprocessing (analyzeCommitIntelligence)
// Pass 1: Per-repo narrative analysis via Claude (parallel, 5 at a time)
// Pass 2: Cross-repo correlation and chapter planning via Claude
// Pass 3: Per-chapter prose generation via Claude (parallel)

import type { CommitData, Repository } from '@/lib/types';
import type {
  CommitIntelligenceResult,
  RepoNarrativeAnalysis,
  NarrativeChapterPlan,
  EnrichedGeneratedStory,
  EnrichedStoryChapter,
  ContributorSpotlight,
  NarrativePipelineProgress,
  ChapterBlueprint,
} from '@/lib/narrative-types';
import { analyzeCommitIntelligence, serializeForPrompt } from '@/lib/narrative-preprocessor';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_PARALLEL_ANALYSIS = 5;

// Per-pass model selection: faster models for structured tasks, Sonnet for prose
const MODEL_PASS1 = 'claude-haiku-4-5-20251001';    // Structured JSON extraction
const MODEL_PASS2 = 'claude-sonnet-4-5-20250929';   // Cross-repo reasoning
const MODEL_PASS3 = 'claude-sonnet-4-5-20250929';   // Narrative prose

// =============================================================================
// HELPERS
// =============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract JSON from a Claude response that might contain markdown fences or preamble.
 */
function extractJSON<T>(text: string): T {
  // Try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue
  }

  // Try to find JSON block (object or array)
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // Continue
    }
  }

  // Try to strip markdown fences
  const stripped = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Continue
  }

  // Try to balance braces
  let candidate = text.trim();
  const startIdx = candidate.indexOf('{');
  if (startIdx === -1) {
    const arrIdx = candidate.indexOf('[');
    if (arrIdx !== -1) candidate = candidate.slice(arrIdx);
  } else {
    candidate = candidate.slice(startIdx);
  }

  let braceCount = 0;
  let lastValid = -1;
  const openChar = candidate[0];
  const closeChar = openChar === '{' ? '}' : ']';
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] === openChar) braceCount++;
    if (candidate[i] === closeChar) {
      braceCount--;
      if (braceCount === 0) {
        lastValid = i;
        break;
      }
    }
  }

  if (lastValid > 0) {
    try {
      return JSON.parse(candidate.slice(0, lastValid + 1)) as T;
    } catch {
      // Give up
    }
  }

  throw new Error('Could not extract valid JSON from Claude response');
}

// =============================================================================
// API CALL WRAPPER
// =============================================================================

interface ApiCallOptions {
  pass: 'analysis' | 'correlation' | 'narrative';
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  repoId?: string;
  claudeToken: string;
  signal?: AbortSignal;
}

async function callNarrativeApi(opts: ApiCallOptions): Promise<string> {
  const response = await fetch('/api/story/generate-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.claudeToken}`,
    },
    body: JSON.stringify({
      pass: opts.pass,
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      userMessage: opts.userMessage,
      maxTokens: opts.maxTokens || 4096,
      temperature: opts.temperature || 0.7,
      repoId: opts.repoId,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    let msg = `API error (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      msg = parsed.error?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const result = await response.json();
  if (!result.success || !result.data?.content) {
    throw new Error(result.error?.message || 'No content returned from API');
  }

  return result.data.content;
}

// =============================================================================
// PASS 1: PER-REPO ANALYSIS
// =============================================================================

async function runPass1(
  commitsByRepo: Record<string, CommitData[]>,
  intelligence: CommitIntelligenceResult,
  claudeToken: string,
  onProgress: (p: Partial<NarrativePipelineProgress>) => void,
  signal?: AbortSignal
): Promise<Map<string, RepoNarrativeAnalysis>> {
  const {
    buildPass1UserMessage,
    PASS1_ANALYSIS_SYSTEM,
  } = await import('@/lib/narrative-prompts');

  const repoIds = Object.keys(commitsByRepo).filter(
    (id) => (commitsByRepo[id]?.length || 0) > 0
  );
  const totalRepos = repoIds.length;
  const results = new Map<string, RepoNarrativeAnalysis>();

  // Process in parallel batches of MAX_PARALLEL_ANALYSIS
  for (let i = 0; i < repoIds.length; i += MAX_PARALLEL_ANALYSIS) {
    if (signal?.aborted) throw new Error('Aborted');

    const batch = repoIds.slice(i, i + MAX_PARALLEL_ANALYSIS);
    const batchPromises = batch.map(async (repoId) => {
      // Build per-repo signals from intelligence
      const repoSignals = buildRepoSignals(repoId, intelligence);
      const repoName = commitsByRepo[repoId][0]?.repoName || repoId;

      const userMessage = buildPass1UserMessage(repoId, repoName, repoSignals);

      // Truncate if needed
      const tokenEst = estimateTokens(PASS1_ANALYSIS_SYSTEM + userMessage);
      let finalMessage = userMessage;
      if (tokenEst > 150000) {
        const maxChars = 150000 * 4 - PASS1_ANALYSIS_SYSTEM.length * 4;
        finalMessage = userMessage.slice(0, maxChars) + '\n\n[Truncated to fit token limits]';
      }

      try {
        const content = await callNarrativeApi({
          pass: 'analysis',
          model: MODEL_PASS1,
          systemPrompt: PASS1_ANALYSIS_SYSTEM,
          userMessage: finalMessage,
          maxTokens: 4096,
          temperature: 0.6,
          repoId,
          claudeToken,
          signal,
        });

        const analysis = extractJSON<RepoNarrativeAnalysis>(content);
        analysis.repoId = repoId; // Ensure correct ID
        results.set(repoId, analysis);
      } catch (err) {
        console.error(`Pass 1 failed for ${repoId}:`, err);
        // Create a minimal fallback analysis
        results.set(repoId, {
          repoId,
          arcs: [{
            id: 'arc-fallback',
            title: `Development of ${repoId}`,
            dateRange: { start: '', end: '' },
            type: 'genesis',
            intensity: 5,
            keyEvents: ['Development activity detected'],
            keyCommitShas: [],
            contributors: [],
          }],
          turningPoints: [],
          repoPersonality: 'A software project with active development.',
          narrativeHooks: [],
        });
      }
    });

    await Promise.all(batchPromises);

    onProgress({
      reposAnalyzed: Math.min(i + batch.length, totalRepos),
      totalRepos,
      overallProgress: 15 + Math.round(((i + batch.length) / totalRepos) * 25),
      currentStep: `Analyzed ${Math.min(i + batch.length, totalRepos)} of ${totalRepos} repositories`,
    });
  }

  return results;
}

/**
 * Build per-repo signals from the intelligence result for Pass 1.
 */
function buildRepoSignals(
  repoId: string,
  intelligence: CommitIntelligenceResult
): string {
  const parts: string[] = [];

  // Filter windows that include this repo
  const repoWindows = intelligence.windows.filter((wa) =>
    wa.repoBreakdown.some((rb) => rb.repoId === repoId)
  );

  // Filter events for this repo
  const repoEvents = intelligence.narrativeEvents.filter((e) =>
    e.repoIds.includes(repoId) || e.repoIds.length === 0
  );

  // Filter contributors for this repo
  const repoContributors = intelligence.contributors.filter((c) =>
    c.repoActivity.some((ra) => ra.repoId === repoId)
  );

  // Filter interesting commits for this repo
  const repoCommits = intelligence.interestingCommits.filter(
    (sc) => sc.repoId === repoId
  );

  parts.push(`## Repo: ${repoId}`);
  parts.push(
    `Total commits: ${intelligence.meta.totalCommits}, ` +
    `Date range: ${intelligence.meta.dateRange.start.slice(0, 10)} to ${intelligence.meta.dateRange.end.slice(0, 10)}`
  );

  // Events
  if (repoEvents.length > 0) {
    parts.push('\n### Events');
    for (const e of repoEvents.slice(0, 10)) {
      parts.push(
        `- [${e.date}] ${e.category}: ${e.title} (${e.significance}/10) — ${e.description}`
      );
    }
  }

  // Windows
  if (repoWindows.length > 0) {
    parts.push('\n### Time Periods');
    for (const wa of repoWindows) {
      const rb = wa.repoBreakdown.find((r) => r.repoId === repoId);
      if (!rb) continue;
      parts.push(
        `- ${wa.window.startDate.slice(0, 10)} to ${wa.window.endDate.slice(0, 10)}: ` +
        `${rb.commitCount} commits, +${rb.additions}/-${rb.deletions}` +
        (wa.dominantTheme ? `, theme: ${wa.dominantTheme.label}` : '') +
        ` (interest: ${wa.interestingnessScore}/10)`
      );
      if (wa.dominantTheme?.representativeMessages.length) {
        parts.push(`  > "${wa.dominantTheme.representativeMessages[0]}"`);
      }
    }
  }

  // Contributors
  if (repoContributors.length > 0) {
    parts.push('\n### Contributors');
    for (const c of repoContributors.slice(0, 3)) {
      const ra = c.repoActivity.find((r) => r.repoId === repoId);
      parts.push(
        `- ${c.name}: ${ra?.commitCount || 0} commits, ${c.inferredRole}`
      );
    }
  }

  // Interesting commits
  if (repoCommits.length > 0) {
    parts.push('\n### Notable Commits');
    for (const sc of repoCommits.slice(0, 10)) {
      parts.push(
        `- [${sc.timestamp.slice(0, 10)}] "${sc.messageHeadline}" ` +
        `by ${sc.authorName} (+${sc.additions}/-${sc.deletions})`
      );
    }
  }

  return parts.join('\n');
}

// =============================================================================
// PASS 2: CORRELATION & CHAPTER PLANNING
// =============================================================================

async function runPass2(
  repoAnalyses: Map<string, RepoNarrativeAnalysis>,
  intelligence: CommitIntelligenceResult,
  claudeToken: string,
  onProgress: (p: Partial<NarrativePipelineProgress>) => void,
  signal?: AbortSignal
): Promise<NarrativeChapterPlan> {
  const {
    buildPass2UserMessage,
    PASS2_CORRELATION_SYSTEM,
  } = await import('@/lib/narrative-prompts');

  onProgress({
    currentPass: 'correlating',
    overallProgress: 45,
    currentStep: 'Designing chapter structure and cross-repo connections...',
  });

  // Build repo analysis summaries for the prompt
  const analysisEntries: Array<{ repoId: string; analysis: string }> = [];
  for (const [repoId, analysis] of repoAnalyses) {
    analysisEntries.push({
      repoId,
      analysis: JSON.stringify(analysis, null, 1),
    });
  }

  // Build cross-repo data
  const crossRepoLines: string[] = [];
  if (intelligence.crossRepoCorrelations.length > 0) {
    crossRepoLines.push('### Cross-Repo Correlations');
    for (const c of intelligence.crossRepoCorrelations.slice(0, 10)) {
      crossRepoLines.push(
        `- ${c.repoA} <-> ${c.repoB}: ${c.type} (strength: ${c.strength}) — ${c.evidence}`
      );
    }
  }
  if (intelligence.discontinuities.length > 0) {
    crossRepoLines.push('\n### Discontinuities');
    for (const d of intelligence.discontinuities.slice(0, 5)) {
      crossRepoLines.push(
        `- ${d.type}: ${d.description} (${d.startDate}${d.endDate ? ` to ${d.endDate}` : ''})`
      );
    }
  }
  crossRepoLines.push('\n### Narrative Arc Suggestion');
  crossRepoLines.push(`Arc type: ${intelligence.narrativeArc.arcType}`);
  crossRepoLines.push(`Summary: ${intelligence.narrativeArc.arcSummary}`);
  for (const act of intelligence.narrativeArc.acts) {
    crossRepoLines.push(`- Act ${act.number}: ${act.suggestedTitle} — ${act.characterization}`);
  }

  // Contributor summaries
  const contributorLines: string[] = [];
  for (const c of intelligence.contributors.slice(0, 10)) {
    contributorLines.push(
      `- ${c.name}${c.login ? ` (@${c.login})` : ''}: ${c.inferredRole}, ` +
      `${c.repoActivity.length} repos, ` +
      `first: ${c.firstSeenDate}, last: ${c.lastSeenDate}, ` +
      `${c.commitsPerActiveDay} commits/active-day, ` +
      `peak hours: ${c.peakHours.join('/')}, ` +
      `${c.weekendPercentage}% weekend`
    );
  }

  const userMessage = buildPass2UserMessage(
    analysisEntries,
    crossRepoLines.join('\n'),
    contributorLines.join('\n')
  );

  // Truncate if needed
  const totalTokens = estimateTokens(PASS2_CORRELATION_SYSTEM + userMessage);
  let finalMessage = userMessage;
  if (totalTokens > 150000) {
    const maxChars = 150000 * 4 - PASS2_CORRELATION_SYSTEM.length * 4;
    finalMessage = userMessage.slice(0, maxChars) + '\n\n[Truncated to fit token limits]';
  }

  const content = await callNarrativeApi({
    pass: 'correlation',
    model: MODEL_PASS2,
    systemPrompt: PASS2_CORRELATION_SYSTEM,
    userMessage: finalMessage,
    maxTokens: 8192,
    temperature: 0.7,
    claudeToken,
    signal,
  });

  const plan = extractJSON<NarrativeChapterPlan>(content);

  // Validate and fix chapter indices
  if (plan.chapters) {
    plan.chapters.sort((a, b) => {
      const aStart = a.dateRange?.start ? new Date(a.dateRange.start).getTime() : 0;
      const bStart = b.dateRange?.start ? new Date(b.dateRange.start).getTime() : 0;
      return aStart - bStart;
    });
    plan.chapters.forEach((ch, i) => {
      ch.index = i;
      if (!ch.id) ch.id = `ch-${i + 1}`;
    });
  }

  onProgress({
    overallProgress: 55,
    totalChapters: plan.chapters?.length || 0,
    currentStep: `Designed ${plan.chapters?.length || 0} chapters`,
  });

  return plan;
}

// =============================================================================
// PASS 3: NARRATIVE PROSE
// =============================================================================

async function runPass3(
  chapterPlan: NarrativeChapterPlan,
  intelligence: CommitIntelligenceResult,
  claudeToken: string,
  onProgress: (p: Partial<NarrativePipelineProgress>) => void,
  signal?: AbortSignal
): Promise<EnrichedStoryChapter[]> {
  const {
    buildPass3UserMessage,
    PASS3_NARRATIVE_SYSTEM,
  } = await import('@/lib/narrative-prompts');

  const totalChapters = chapterPlan.chapters.length;

  onProgress({
    currentPass: 'writing',
    overallProgress: 55,
    chaptersCompleted: 0,
    totalChapters,
    currentStep: `Writing all ${totalChapters} chapters in parallel...`,
  });

  if (signal?.aborted) throw new Error('Aborted');

  // Build chapter context from the plan for continuity (instead of sequential previousEnding)
  const chapterSummaries = chapterPlan.chapters.map((bp) =>
    `"${bp.title}" (${bp.dateRange?.start?.slice(0, 10) || '?'} – ${bp.dateRange?.end?.slice(0, 10) || '?'})`
  );

  // Generate all chapters in parallel
  const chapterPromises = chapterPlan.chapters.map(async (blueprint, i) => {
    const dataSlice = buildChapterDataSlice(blueprint, intelligence);

    // Build continuity context from the chapter plan instead of previous chapter's literal text
    const prevContext = i > 0
      ? `Previous chapter: ${chapterSummaries[i - 1]}. Next you are writing chapter ${i + 1} of ${totalChapters}.`
      : null;

    const userMessage = buildPass3UserMessage(
      blueprint,
      dataSlice,
      totalChapters,
      prevContext,
      chapterPlan.storyTitle
    );

    const totalTokens = estimateTokens(PASS3_NARRATIVE_SYSTEM + userMessage);
    let finalMessage = userMessage;
    if (totalTokens > 150000) {
      const maxChars = 150000 * 4 - PASS3_NARRATIVE_SYSTEM.length * 4;
      finalMessage = userMessage.slice(0, maxChars) + '\n\n[Truncated]';
    }

    try {
      const content = await callNarrativeApi({
        pass: 'narrative',
        model: MODEL_PASS3,
        systemPrompt: PASS3_NARRATIVE_SYSTEM,
        userMessage: finalMessage,
        maxTokens: blueprint.suggestedLength === 'long' ? 4096 : blueprint.suggestedLength === 'medium' ? 2048 : 1024,
        temperature: 0.75,
        claudeToken,
        signal,
      });

      const cleanContent = content.trim();
      const startDate = blueprint.dateRange?.start || '';
      const endDate = blueprint.dateRange?.end || '';
      const startMs = startDate ? new Date(startDate).getTime() : 0;
      const endMs = endDate ? new Date(endDate).getTime() : 0;

      return {
        id: blueprint.id,
        index: i,
        title: blueprint.title,
        content: cleanContent,
        dateRange: {
          start: startDate,
          end: endDate,
          totalDays: startMs && endMs ? Math.ceil((endMs - startMs) / 86400000) : 0,
        },
        repoIds: blueprint.repos || [],
        anchorId: `chapter-${i + 1}`,
        chapterType: blueprint.chapterType || 'growth',
        moodProgression: blueprint.moodProgression || '',
      } as EnrichedStoryChapter;
    } catch (err) {
      console.error(`Pass 3 failed for chapter ${i + 1}:`, err);
      return {
        id: blueprint.id,
        index: i,
        title: blueprint.title,
        content: `*This chapter covers the period from ${blueprint.dateRange?.start || 'the beginning'} to ${blueprint.dateRange?.end || 'the present'}.* ${blueprint.narrativeFocus || ''}`,
        dateRange: {
          start: blueprint.dateRange?.start || '',
          end: blueprint.dateRange?.end || '',
          totalDays: 0,
        },
        repoIds: blueprint.repos || [],
        anchorId: `chapter-${i + 1}`,
        chapterType: blueprint.chapterType || 'growth',
        moodProgression: blueprint.moodProgression || '',
      } as EnrichedStoryChapter;
    }
  });

  const chapters = await Promise.all(chapterPromises);

  onProgress({
    overallProgress: 90,
    chaptersCompleted: chapters.length,
    currentStep: `All ${chapters.length} chapters written`,
  });

  return chapters.sort((a, b) => a.index - b.index);
}

/**
 * Build a data slice for a specific chapter from the intelligence result.
 */
function buildChapterDataSlice(
  blueprint: ChapterBlueprint,
  intelligence: CommitIntelligenceResult
): string {
  const parts: string[] = [];
  const startDate = blueprint.dateRange?.start;
  const endDate = blueprint.dateRange?.end;

  // Filter windows by date range
  let relevantWindows = intelligence.windows;
  if (startDate && endDate) {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    relevantWindows = intelligence.windows.filter(
      (wa) => wa.window.startMs <= endMs && wa.window.endMs >= startMs
    );
  }

  // Further filter by repos if specified
  const repoSet = new Set(blueprint.repos || []);
  if (repoSet.size > 0) {
    relevantWindows = relevantWindows.filter((wa) =>
      wa.repoBreakdown.some((rb) => repoSet.has(rb.repoId))
    );
  }

  // Time period details (capped for speed)
  for (const wa of relevantWindows.slice(0, 5)) {
    const relevantRepos = repoSet.size > 0
      ? wa.repoBreakdown.filter((rb) => repoSet.has(rb.repoId))
      : wa.repoBreakdown;

    parts.push(
      `### ${wa.window.startDate.slice(0, 10)} to ${wa.window.endDate.slice(0, 10)} ` +
      `(${wa.metrics.totalCommits} commits, interest: ${wa.interestingnessScore}/10)`
    );

    for (const rb of relevantRepos) {
      parts.push(
        `- ${rb.repoName}: ${rb.commitCount} commits, +${rb.additions}/-${rb.deletions}, ` +
        `modules: ${rb.topModules.join(', ')}`
      );
    }

    if (wa.dominantTheme) {
      parts.push(`Theme: ${wa.dominantTheme.label}`);
      if (wa.dominantTheme.representativeMessages.length) {
        parts.push(`> "${wa.dominantTheme.representativeMessages[0]}"`);
      }
    }

    for (const nc of wa.notableCommits.slice(0, 2)) {
      parts.push(`Notable: "${nc.message}" by ${nc.author} — ${nc.reason}`);
    }

    parts.push('');
  }

  // Events in this range
  const relevantEvents = intelligence.narrativeEvents.filter((e) => {
    if (startDate && endDate) {
      const evMs = e.timestampMs;
      return evMs >= new Date(startDate).getTime() && evMs <= new Date(endDate).getTime();
    }
    return true;
  });

  if (relevantEvents.length > 0) {
    parts.push('### Events');
    for (const e of relevantEvents.slice(0, 5)) {
      parts.push(
        `- [${e.date}] ${e.category}: ${e.title} — ${e.description}` +
        (e.evidenceCommits.length > 0 ? ` [${e.evidenceCommits[0].slice(0, 7)}]` : '')
      );
    }
    parts.push('');
  }

  // Interesting commits in range
  const relevantCommits = intelligence.interestingCommits.filter((sc) => {
    if (startDate && endDate) {
      const cMs = new Date(sc.timestamp).getTime();
      return cMs >= new Date(startDate).getTime() && cMs <= new Date(endDate).getTime();
    }
    return true;
  });

  if (relevantCommits.length > 0) {
    parts.push('### Interesting Commits');
    for (const sc of relevantCommits.slice(0, 5)) {
      parts.push(
        `- [${sc.timestamp.slice(0, 10)}] ${sc.shortSha} "${sc.messageHeadline}" ` +
        `by ${sc.authorName} in ${sc.repoName} ` +
        `(+${sc.additions}/-${sc.deletions}) [${sc.scoreReasons.join(', ')}]`
      );
    }
  }

  // Contributor spotlight data
  if (blueprint.contributorSpotlights.length > 0) {
    const spotlightNames = new Set(
      blueprint.contributorSpotlights.map((s) => s.toLowerCase())
    );
    const spotlightContributors = intelligence.contributors.filter((c) =>
      spotlightNames.has(c.name.toLowerCase()) ||
      (c.login && spotlightNames.has(c.login.toLowerCase()))
    );

    if (spotlightContributors.length > 0) {
      parts.push('\n### Contributor Details');
      for (const c of spotlightContributors) {
        parts.push(
          `- ${c.name}: ${c.inferredRole}, ${c.commitsPerActiveDay} commits/active-day, ` +
          `peak hours: ${c.peakHours.join('/')}, ${c.weekendPercentage}% weekend, ` +
          `specializations: ${c.specializations.map((s) => `${s.module} (${s.percentage}%)`).join(', ')}`
        );
      }
    }
  }

  return parts.join('\n');
}

// =============================================================================
// ASSEMBLY
// =============================================================================

function assembleStory(
  chapters: EnrichedStoryChapter[],
  chapterPlan: NarrativeChapterPlan,
  intelligence: CommitIntelligenceResult,
  startTime: number,
  totalApiCalls: number
): EnrichedGeneratedStory {
  // Build contributor spotlights
  const spotlights: ContributorSpotlight[] = [];
  for (const chapter of chapterPlan.chapters) {
    for (const name of chapter.contributorSpotlights || []) {
      const contributor = intelligence.contributors.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() ||
          c.login?.toLowerCase() === name.toLowerCase()
      );
      if (contributor) {
        spotlights.push({
          contributorId: contributor.id,
          contributorName: contributor.name,
          avatarUrl: contributor.avatarUrl,
          narrative: `${contributor.name} contributed across ${contributor.repoActivity.length} repos with an average of ${contributor.commitsPerActiveDay} commits per active day, specializing in ${contributor.specializations.slice(0, 2).map((s) => s.module).join(' and ')}.`,
          repos: contributor.repoActivity.map((ra) => ra.repoId),
          commitCount: contributor.repoActivity.reduce(
            (s, ra) => s + ra.commitCount,
            0
          ),
          chapterId: chapter.id,
        });
      }
    }
  }

  // Build milestones from chapter plan
  const milestones = (chapterPlan.milestones || []).map((m) => ({
    date: m.date,
    title: m.title,
    description: m.description,
    type: m.type || 'milestone',
    significance: m.significance,
    relatedRepos: m.relatedRepos || [],
    relatedCommitShas: m.relatedCommitShas || [],
    icon: m.icon || '🔖',
    chapterId: m.chapterId || '',
  }));

  // Build cross-repo connections
  const connections = (chapterPlan.crossRepoConnections || []).map((c) => ({
    type: c.type,
    fromRepo: c.fromRepo,
    toRepo: c.toRepo,
    description: c.description,
  }));

  const endTime = Date.now();

  return {
    id: `narrative-${Date.now()}`,
    type: 'unified',
    title: chapterPlan.storyTitle || 'Your Developer Journey',
    subtitle: chapterPlan.storySubtitle || 'A story told through commits',
    overarchingArc: chapterPlan.overarchingArc || {
      title: 'A Developer\'s Journey',
      theme: 'Growth',
      narrativeType: 'growth',
    },
    chapters,
    milestones,
    crossRepoConnections: connections,
    contributorSpotlights: spotlights,
    generatedAt: endTime,
    dateRange: {
      start: intelligence.meta.dateRange.start,
      end: intelligence.meta.dateRange.end,
      totalDays: intelligence.meta.dateRange.totalDays,
    },
    model: MODEL_PASS3,
    passMetadata: {
      totalApiCalls,
      totalGenerationTimeMs: endTime - startTime,
    },
  };
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Generate a rich, multi-pass narrative story.
 *
 * Flow:
 * 1. Pass 0: Local preprocessing (analyzeCommitIntelligence)
 * 2. Pass 1: Per-repo narrative analysis via Claude (parallel)
 * 3. Pass 2: Cross-repo correlation and chapter planning via Claude
 * 4. Pass 3: Per-chapter prose generation via Claude (parallel)
 * 5. Assembly into EnrichedGeneratedStory
 */
export async function generateNarrative(
  commitsByRepo: Record<string, CommitData[]>,
  repositories: Repository[],
  claudeToken: string,
  onProgress: (progress: NarrativePipelineProgress) => void,
  signal?: AbortSignal
): Promise<EnrichedGeneratedStory> {
  const startTime = Date.now();
  let totalApiCalls = 0;

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

    const intelligence = analyzeCommitIntelligence(
      commitsByRepo,
      repositories
    );

    updateProgress({
      overallProgress: 15,
      currentStep: `Found ${intelligence.narrativeEvents.length} events, ${intelligence.windows.length} time periods, ${intelligence.contributors.length} contributors`,
    });

    if (signal?.aborted) throw new Error('Aborted');

    // =========================================================================
    // PASS 1: Per-repo analysis
    // =========================================================================
    updateProgress({
      currentPass: 'analyzing',
      overallProgress: 15,
      currentStep: 'Analyzing each repository for narrative structure...',
    });

    const repoAnalyses = await runPass1(
      commitsByRepo,
      intelligence,
      claudeToken,
      updateProgress,
      signal
    );
    totalApiCalls += repoAnalyses.size;

    if (signal?.aborted) throw new Error('Aborted');

    // =========================================================================
    // PASS 2: Correlation & chapter planning
    // =========================================================================
    updateProgress({
      currentPass: 'correlating',
      overallProgress: 45,
      currentStep: 'Designing the narrative architecture...',
    });

    const chapterPlan = await runPass2(
      repoAnalyses,
      intelligence,
      claudeToken,
      updateProgress,
      signal
    );
    totalApiCalls += 1;

    if (signal?.aborted) throw new Error('Aborted');

    // =========================================================================
    // PASS 3: Chapter prose
    // =========================================================================
    updateProgress({
      currentPass: 'writing',
      overallProgress: 55,
      currentStep: 'Writing your story...',
      totalChapters: chapterPlan.chapters.length,
    });

    const chapters = await runPass3(
      chapterPlan,
      intelligence,
      claudeToken,
      updateProgress,
      signal
    );
    totalApiCalls += chapters.length;

    if (signal?.aborted) throw new Error('Aborted');

    // =========================================================================
    // ASSEMBLY
    // =========================================================================
    updateProgress({
      currentPass: 'enriching',
      overallProgress: 95,
      currentStep: 'Assembling your story...',
      chaptersCompleted: chapters.length,
    });

    const story = assembleStory(
      chapters,
      chapterPlan,
      intelligence,
      startTime,
      totalApiCalls
    );

    updateProgress({
      currentPass: 'complete',
      overallProgress: 100,
      currentStep: 'Your story is ready!',
      chaptersCompleted: chapters.length,
    });

    return story;
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
