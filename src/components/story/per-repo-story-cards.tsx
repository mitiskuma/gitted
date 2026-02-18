'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  GitCommit,
  Calendar,
  Code2,
  BookOpen,
  ExternalLink,
  FileText,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { GeneratedStory, Repository } from '@/lib/types';

// Language color mapping
const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

// Gradient presets per language
const LANG_GRADIENTS: Record<string, [string, string]> = {
  TypeScript: ['#1e3a5f', '#3178c6'],
  JavaScript: ['#4a3f00', '#f1e05a'],
  Python: ['#1a2d4a', '#3572A5'],
  Java: ['#3d2800', '#b07219'],
  Go: ['#003d4d', '#00ADD8'],
  Rust: ['#4a3020', '#dea584'],
  Ruby: ['#2d0a0a', '#701516'],
  CSS: ['#2a1f3d', '#563d7c'],
  default: ['#1a1a2e', '#533483'],
};

function getGradient(language: string | null): [string, string] {
  if (!language) return ['#1a1a2e', '#533483'];
  const grad = LANG_GRADIENTS[language];
  if (Array.isArray(grad)) return grad;
  return ['#1a1a2e', '#533483'];
}

function getLanguageColor(language: string | null): string {
  if (!language) return '#94a3b8';
  return LANG_COLORS[language] || '#94a3b8';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

function extractSummary(story: GeneratedStory): string {
  // Try to get the first paragraph of content
  const content = story.content;
  const paragraphs = content.split('\n\n').filter(p => {
    const trimmed = p.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('-');
  });

  if (paragraphs.length > 0) {
    // Strip markdown bold/italic/links
    let summary = paragraphs[0]
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .trim();

    if (summary.length > 220) {
      summary = summary.slice(0, 220).trim() + '...';
    }
    return summary;
  }

  return story.subtitle || `A story spanning ${story.dateRange.totalDays} days of development.`;
}

function getStoryStats(story: GeneratedStory) {
  const chapters = story.chapters.length;
  const milestones = story.milestones.length;
  const repos = [...new Set(story.chapters.flatMap(c => c.repoIds))].length;
  return { chapters, milestones, repos };
}

interface PerRepoStoryCardsProps {
  stories: GeneratedStory[];
  repositories?: Repository[];
}

function StoryCard({
  story,
  repository,
  index,
}: {
  story: GeneratedStory;
  repository?: Repository;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const repoName = story.repoId
    ? story.repoId.split('/').pop() || story.repoId
    : 'Unknown';

  const language = repository?.language || null;
  const langColor = getLanguageColor(language);
  const gradient = getGradient(language);
  const summary = extractSummary(story);
  const stats = getStoryStats(story);
  const dateRange = `${formatShortDate(story.dateRange.start)} — ${formatShortDate(story.dateRange.end)}`;

  const totalCommits = story.milestones.reduce(
    (sum, m) => sum + m.relatedCommits.length,
    0
  );

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Render markdown-like content as styled paragraphs
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={key++} className="h-3" />);
        continue;
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={key++}
            className="mt-6 mb-3 text-lg font-bold text-white/95 flex items-center gap-2"
          >
            <span className="inline-block h-1 w-5 rounded-full" style={{ backgroundColor: langColor }} />
            {trimmed.replace(/^##\s+/, '')}
          </h3>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={key++} className="mt-4 mb-2 text-base font-semibold text-white/90">
            {trimmed.replace(/^###\s+/, '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ')) {
        elements.push(
          <div key={key++} className="flex items-start gap-2 pl-2 mb-1.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
            <span
              className="text-sm text-white/70 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdown(trimmed.replace(/^-\s+/, '')),
              }}
            />
          </div>
        );
      } else {
        elements.push(
          <p
            key={key++}
            className="text-sm text-white/70 leading-relaxed mb-2"
            dangerouslySetInnerHTML={{
              __html: renderInlineMarkdown(trimmed),
            }}
          />
        );
      }
    }

    return elements;
  };

  const renderInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-white/80">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono text-emerald-300/80">$1</code>')
      .replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400/80 hover:text-blue-300 underline underline-offset-2">$1</a>'
      );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="overflow-hidden border border-white/[0.08] bg-black/40 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-white/[0.15] hover:shadow-3xl">
        {/* Gradient Header */}
        <div
          className="relative px-5 py-4 sm:px-6 sm:py-5"
          style={{
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: langColor }}
                />
                <h3 className="truncate text-lg font-bold text-white tracking-tight">
                  {repoName}
                </h3>
              </div>

              <p className="text-xs text-white/50 font-medium">
                <Calendar className="mr-1 inline-block h-3 w-3" />
                {dateRange}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {language && (
                <Badge
                  variant="secondary"
                  className="border-0 bg-white/15 text-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-0.5"
                >
                  <Code2 className="mr-1 h-3 w-3" />
                  {language}
                </Badge>
              )}
              {repository?.starCount != null && repository.starCount > 0 && (
                <Badge
                  variant="secondary"
                  className="border-0 bg-white/15 text-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-0.5"
                >
                  ⭐ {repository.starCount.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Card Content */}
        <CardContent className="p-5 sm:p-6">
          {/* Summary */}
          <p className="text-sm leading-relaxed text-white/65 mb-4">
            {summary}
          </p>

          {/* Quick Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <BookOpen className="h-3.5 w-3.5 text-purple-400/70" />
              </div>
              <p className="text-lg font-bold text-white/90">{stats.chapters}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Chapters
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-400/70" />
              </div>
              <p className="text-lg font-bold text-white/90">{story.milestones.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Milestones
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-400/70" />
              </div>
              <p className="text-lg font-bold text-white/90">{story.dateRange.totalDays}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Days
              </p>
            </div>
          </div>

          {/* Milestones Preview */}
          {story.milestones.length > 0 && !isExpanded && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1.5">
                {story.milestones.slice(0, 3).map((milestone, mIdx) => (
                  <span
                    key={mIdx}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-xs text-white/60"
                  >
                    <span>{milestone.icon}</span>
                    <span className="truncate max-w-[150px]">{milestone.title}</span>
                  </span>
                ))}
                {story.milestones.length > 3 && (
                  <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-white/40">
                    +{story.milestones.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            onClick={toggleExpand}
            className="w-full justify-center gap-2 text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Collapse Story
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Read Full Story
              </>
            )}
          </Button>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="overflow-hidden"
              >
                <div className="mt-4 border-t border-white/[0.06] pt-5">
                  {/* Chapter Navigation */}
                  {story.chapters.length > 1 && (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {story.chapters.map((chapter, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => {
                            const el = document.getElementById(
                              `${story.id}-${chapter.anchorId}`
                            );
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="rounded-md bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.1] hover:text-white/80 transition-colors"
                        >
                          Ch. {cIdx + 1}: {chapter.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Story Content by Chapters */}
                  <div className="space-y-6">
                    {story.chapters.map((chapter, cIdx) => (
                      <div
                        key={cIdx}
                        id={`${story.id}-${chapter.anchorId}`}
                        className="scroll-mt-24"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white/90"
                            style={{
                              background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                            }}
                          >
                            {cIdx + 1}
                          </span>
                          <h4 className="text-base font-bold text-white/90">
                            {chapter.title}
                          </h4>
                        </div>

                        <div className="ml-10">
                          <div className="mb-2 text-[10px] uppercase tracking-wider text-white/30 font-medium">
                            {formatShortDate(chapter.dateRange.start)} — {formatShortDate(chapter.dateRange.end)}
                          </div>
                          <div className="prose-sm">{renderContent(chapter.content)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Milestones Section (expanded) */}
                  {story.milestones.length > 0 && (
                    <div className="mt-6 border-t border-white/[0.06] pt-5">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80">
                        <TrendingUp className="h-4 w-4 text-amber-400/70" />
                        Key Milestones
                      </h4>
                      <div className="relative ml-3 space-y-3 border-l border-white/[0.1] pl-5">
                        {story.milestones.map((milestone, mIdx) => (
                          <motion.div
                            key={mIdx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: mIdx * 0.05 }}
                            className="relative"
                          >
                            <div
                              className="absolute -left-[25px] top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs border border-white/[0.1]"
                              style={{
                                background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                              }}
                            >
                              {milestone.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold text-white/85">
                                  {milestone.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="border-white/[0.1] text-[10px] text-white/40 px-1.5 py-0"
                                >
                                  {milestone.type.replace(/-/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-white/50 mb-0.5">
                                {formatDate(milestone.date)}
                              </p>
                              <p className="text-xs text-white/55 leading-relaxed">
                                {milestone.description}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Link to repo */}
                  {story.repoId && (
                    <div className="mt-5 flex justify-end">
                      <a
                        href={`https://github.com/${story.repoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View on GitHub
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function PerRepoStoryCards({ stories, repositories = [] }: PerRepoStoryCardsProps) {
  // Filter to repo stories and sort chronologically (oldest first)
  const repoStories = stories
    .filter(s => s.type === 'repo')
    .sort((a, b) => {
      const aStart = a.dateRange?.start ? new Date(a.dateRange.start).getTime() : 0;
      const bStart = b.dateRange?.start ? new Date(b.dateRange.start).getTime() : 0;
      return aStart - bStart;
    });

  if (repoStories.length === 0) {
    return (
      <section id="per-repo-stories" className="py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
            <FileText className="h-4.5 w-4.5 text-purple-400/70" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white/90 tracking-tight">
              Repository Stories
            </h2>
            <p className="text-sm text-white/40">
              Individual narratives for each of your selected repositories
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-12 text-center">
          <GitCommit className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">
            No repository stories generated yet. Generate your story to see individual repo narratives.
          </p>
        </div>
      </section>
    );
  }

  // Create a lookup for repositories by ID
  const repoMap = new Map(repositories.map(r => [r.fullName || r.id, r]));

  return (
    <section id="per-repo-stories" className="py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
          <FileText className="h-4.5 w-4.5 text-purple-400/70" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white/90 tracking-tight">
            Repository Stories
          </h2>
          <p className="text-sm text-white/40">
            {repoStories.length} {repoStories.length === 1 ? 'repository' : 'repositories'} — each with its own unique narrative
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {repoStories.map((story, idx) => {
          const repo = story.repoId ? repoMap.get(story.repoId) : undefined;
          return (
            <StoryCard
              key={story.id}
              story={story}
              repository={repo}
              index={idx}
            />
          );
        })}
      </div>
    </section>
  );
}
