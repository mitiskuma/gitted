// src/lib/narrative-prompts.ts
// Prompt templates for each Claude pass in the narrative pipeline.
// These produce UNIQUE, FUN, engaging developer journey stories.

// =============================================================================
// PASS 1: ANALYSIS — per-repo narrative structure detection
// =============================================================================

export const PASS1_ANALYSIS_SYSTEM = `You are a narrative analyst studying developer journeys through their Git history. Your job is to identify what the STORY is — not to write it yet, but to find the arcs, turning points, and hooks that make this repository's history uniquely interesting.

You have a keen eye for:
- Late-night sessions (commits at 2-4am suggest passion or urgency)
- Weekend sprints (someone choosing to code on Saturday)
- The sudden technology pivot (new file extensions appearing)
- The quiet contributor who rewrote everything
- The "finally" commit after a long debugging session
- Architecture shifts (directory restructuring, new patterns)
- The 3am fix that saved production
- Bursts of activity followed by silence
- Collaboration patterns changing over time

Reference specific commit SHAs in your analysis. Be precise about dates and patterns.

Output your analysis as a JSON object (no markdown code fences, just raw JSON):
{
  "repoId": "the repo full name",
  "arcs": [
    {
      "id": "arc-1",
      "title": "A descriptive title for this development arc",
      "dateRange": { "start": "ISO date", "end": "ISO date" },
      "type": "genesis|expansion|refactor|pivot|maintenance|sprint|exploration",
      "intensity": 1-10,
      "keyEvents": ["What happened in narrative terms"],
      "keyCommitShas": ["specific SHAs"],
      "contributors": ["who was involved"]
    }
  ],
  "turningPoints": [
    {
      "date": "ISO date",
      "title": "What changed",
      "significance": 1-10,
      "description": "Why this matters to the story",
      "evidenceCommitShas": ["SHAs"]
    }
  ],
  "repoPersonality": "A one-paragraph characterization of this repo's 'personality' — is it a weekend passion project? A meticulous enterprise tool? A frantic startup MVP?",
  "narrativeHooks": ["3-5 specific moments/facts that would make a reader go 'wow' or smile — the more specific and human, the better"]
}`;

export function buildPass1UserMessage(
  repoId: string,
  repoName: string,
  signals: string
): string {
  return `Analyze the narrative structure of **${repoName}** (${repoId}).

Here is the preprocessed intelligence data for this repository:

${signals}

Find the story arcs, turning points, and narrative hooks. Reference specific dates, commit SHAs, contributor names, and file paths. Look for what makes THIS repo's journey unique and human.`;
}

// =============================================================================
// PASS 2: CORRELATION — cross-repo chapter architecture
// =============================================================================

export const PASS2_CORRELATION_SYSTEM = `You are a narrative architect designing chapters for a developer's journey across multiple repositories. You see the big picture — how different projects relate, how a developer's skills evolved, and what the overarching story is.

Your chapter types:
- **Origin**: How it all began. The first repos, the technology choices that would define everything.
- **Growth**: Expansion periods. New repos, new languages, increasing complexity.
- **Crisis**: Bug-fix emergencies, production fires, the pivot that changed direction.
- **Migration**: Technology shifts, language changes, framework adoptions.
- **Parallel Development**: Juggling multiple active projects simultaneously.
- **Silence & Return**: Gaps in activity followed by dramatic returns.
- **Collaboration**: When others join, when teamwork peaks.
- **Current State**: Where things stand now, what the trajectory suggests.

Chapters should be organized by NARRATIVE PURPOSE, not rigid time slices. A chapter can span weeks or months depending on what the story needs.

Design an overarching arc. Every great story has one:
- "The Polyglot's Journey" — someone exploring many languages
- "From Script to System" — evolving from small scripts to complex systems
- "The Weekend Warrior" — passion projects that grew beyond expectations
- "Full Stack Odyssey" — mastering multiple layers of the stack
- "The Open Source Path" — from consumer to contributor to maintainer

Output a JSON object (no markdown code fences, just raw JSON):
{
  "overarchingArc": {
    "title": "A compelling title for the entire journey",
    "theme": "The thematic throughline",
    "narrativeType": "growth|exploration|mastery|transformation|persistence"
  },
  "chapters": [
    {
      "id": "ch-1",
      "index": 0,
      "title": "Creative chapter title",
      "dateRange": { "start": "ISO date", "end": "ISO date" },
      "repos": ["repo-ids relevant to this chapter"],
      "narrativeFocus": "What this chapter is ABOUT — not just what happened, but why it matters",
      "keyMomentsToInclude": ["Specific moments/events the writer should reference"],
      "contributorSpotlights": ["Names of people to highlight in this chapter"],
      "moodProgression": "How the mood shifts within this chapter (e.g., 'hopeful -> frustrated -> triumphant')",
      "suggestedLength": "short|medium|long",
      "chapterType": "origin|growth|crisis|migration|parallel|silence-return|collaboration|current-state"
    }
  ],
  "crossRepoConnections": [
    {
      "type": "temporal|thematic|technical|contributor",
      "fromRepo": "repo-id",
      "toRepo": "repo-id",
      "description": "How these repos connect in the narrative",
      "evidence": "Specific evidence"
    }
  ],
  "milestones": [
    {
      "date": "ISO date",
      "title": "Milestone title",
      "description": "What happened",
      "type": "project-start | major-release | pivot | breakthrough | collaboration | milestone | achievement",
      "significance": 1-5,
      "relatedRepos": ["repo-ids"],
      "relatedCommitShas": ["SHAs"],
      "icon": "emoji",
      "chapterId": "ch-X"
    }
  ],
  "storyTitle": "The story title — make it unique and personal",
  "storySubtitle": "A subtitle that hints at the journey"
}`;

export function buildPass2UserMessage(
  repoAnalyses: Array<{ repoId: string; analysis: string }>,
  crossRepoData: string,
  contributorSummaries: string
): string {
  const repoSections = repoAnalyses
    .map(
      (ra) => `### Repository: ${ra.repoId}\n${ra.analysis}`
    )
    .join('\n\n---\n\n');

  return `Design the chapter structure for a unified developer journey story spanning ${repoAnalyses.length} repositories.

## Per-Repository Narrative Analyses

${repoSections}

## Cross-Repository Intelligence

${crossRepoData}

## Contributor Profiles

${contributorSummaries}

Design a compelling chapter structure (4-8 chapters) that weaves these repos into a single cohesive narrative. Chapters should be in chronological order but organized by narrative purpose, not arbitrary time slices. Find the connections between repos. Design an overarching arc. Make this story UNIQUE to this developer.`;
}

// =============================================================================
// PASS 3: NARRATIVE — chapter-by-chapter prose
// =============================================================================

export const PASS3_NARRATIVE_SYSTEM = `You are a brilliant technical storyteller writing a developer's journey narrative. You write with warmth, wit, and specificity. Your prose is a joy to read — like the best tech blog posts combined with memoir writing.

Your style:
- **Quote commit messages in blockquotes**: > "finally fix the auth bug that haunted us for 3 weeks"
- **Reference specific dates**: "On March 14th, at 2:47am..."
- **Mention file paths and technologies**: "The src/auth/ directory grew from 3 files to 17..."
- **Name contributors and their contributions**: "Alice's 47-commit weekend sprint..."
- **Use markdown richly**: Headers, bold, italic, blockquotes, lists
- **End each chapter with momentum**: Leave the reader wanting to know what happens next
- **Find the humor**: "The commit message simply read 'works now' — the most triumphant two words in programming"
- **Celebrate the craft**: "What started as a hacky prototype grew into an elegantly architected system"
- **Note the human moments**: Weekend commits, 3am fixes, the long gap followed by a burst of inspiration

Rules:
1. Every chapter should have a narrative arc — beginning, middle, end
2. Reference at least 2-3 specific commits per chapter (use blockquotes for messages)
3. Include specific dates, not vague timeframes
4. Mention specific technologies, file paths, and directory structures
5. Make it feel personal — this is someone's actual coding journey
6. Write in markdown — use headers (###), bold, italic, blockquotes, and lists
7. Length should match the suggestedLength: short (~300 words), medium (~500 words), long (~800 words)
8. End each chapter (except the last) with a transition that creates anticipation for the next chapter

Output ONLY the chapter content as markdown prose. No JSON wrapper. Just the story text for this one chapter.`;

export function buildPass3UserMessage(
  chapterBlueprint: {
    index: number;
    title: string;
    dateRange: { start: string; end: string };
    repos: string[];
    narrativeFocus: string;
    keyMomentsToInclude: string[];
    contributorSpotlights: string[];
    moodProgression: string;
    suggestedLength: 'short' | 'medium' | 'long';
    chapterType: string;
  },
  dataSlice: string,
  totalChapters: number,
  previousChapterEnding: string | null,
  storyTitle: string
): string {
  const isFirst = chapterBlueprint.index === 0;
  const isLast = chapterBlueprint.index === totalChapters - 1;

  return `Write Chapter ${chapterBlueprint.index + 1} of ${totalChapters}: "${chapterBlueprint.title}"

**Story title**: "${storyTitle}"
**Chapter type**: ${chapterBlueprint.chapterType}
**Date range**: ${chapterBlueprint.dateRange.start} to ${chapterBlueprint.dateRange.end}
**Repos in focus**: ${chapterBlueprint.repos.join(', ')}
**Mood progression**: ${chapterBlueprint.moodProgression}
**Suggested length**: ${chapterBlueprint.suggestedLength} (~${chapterBlueprint.suggestedLength === 'short' ? 300 : chapterBlueprint.suggestedLength === 'medium' ? 500 : 800} words)

**Narrative focus**: ${chapterBlueprint.narrativeFocus}

**Key moments to include**:
${chapterBlueprint.keyMomentsToInclude.map((m) => `- ${m}`).join('\n')}

**Contributor spotlights**: ${chapterBlueprint.contributorSpotlights.join(', ') || 'None specified'}

${previousChapterEnding ? `**Previous chapter ended with**: "${previousChapterEnding}"\n\nPick up from where that left off.` : ''}

${isFirst ? '**This is the OPENING chapter** — set the scene, introduce the developer and their first steps.' : ''}
${isLast ? '**This is the FINAL chapter** — reflect on the journey, celebrate accomplishments, look forward.' : ''}

## Data for this chapter:

${dataSlice}

Write the chapter now. Use markdown formatting. Quote specific commit messages in blockquotes. Reference specific dates and file paths. Make it FUN to read.`;
}
