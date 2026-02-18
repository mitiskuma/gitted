'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  GitCommit,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  Code2,
  Zap,
  Target,
  ArrowRight,
} from 'lucide-react';
import type {
  GeneratedStory,
  StoryChapter,
  StoryMilestone,
  Repository,
} from '@/lib/types';

interface UnifiedDeveloperJourneyProps {
  story: GeneratedStory;
  repositories?: Repository[];
  onChapterVisible?: (chapterId: string) => void;
}

// Milestone callout component
function MilestoneCallout({ milestone }: { milestone: StoryMilestone }) {
  const typeColors: Record<string, string> = {
    'project-start': 'border-emerald-500/40 bg-emerald-500/5',
    'major-release': 'border-blue-500/40 bg-blue-500/5',
    'pivot': 'border-amber-500/40 bg-amber-500/5',
    'breakthrough': 'border-purple-500/40 bg-purple-500/5',
    'collaboration': 'border-cyan-500/40 bg-cyan-500/5',
    'milestone': 'border-indigo-500/40 bg-indigo-500/5',
    'achievement': 'border-yellow-500/40 bg-yellow-500/5',
  };

  const typeBadgeColors: Record<string, string> = {
    'project-start': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'major-release': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'pivot': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'breakthrough': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'collaboration': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'milestone': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    'achievement': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  };

  const formattedDate = new Date(milestone.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const typeLabel = milestone.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div
      className={`my-6 rounded-lg border-l-4 p-4 md:p-5 ${typeColors[milestone.type] || 'border-gray-500/40 bg-gray-500/5'}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl" role="img" aria-label={milestone.type}>
          {milestone.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white md:text-base">
              {milestone.title}
            </h4>
            <Badge
              variant="outline"
              className={`text-[10px] ${typeBadgeColors[milestone.type] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}
            >
              {typeLabel}
            </Badge>
          </div>
          <p className="mb-2 text-xs text-muted-foreground md:text-sm">
            {milestone.description}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formattedDate}</span>
            {milestone.repoName && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Code2 className="h-3 w-3" />
                <span>{milestone.repoName}</span>
              </>
            )}
            {milestone.significance >= 4 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Sparkles className="h-3 w-3 text-yellow-400" />
                <span className="text-yellow-400">Key Moment</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline commit reference link
function CommitRef({ sha, repoId }: { sha: string; repoId?: string | null }) {
  const shortSha = sha.slice(0, 7);
  const url = repoId
    ? `https://github.com/${repoId}/commit/${sha}`
    : '#';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-blue-400 transition-colors hover:bg-muted hover:text-blue-300"
    >
      <GitCommit className="h-3 w-3" />
      {shortSha}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}

// Custom markdown-like renderer
function RenderedMarkdown({
  content,
  repoId,
}: {
  content: string;
  repoId?: string | null;
}) {
  // Parse content into blocks
  const blocks = content.split('\n\n').filter(b => b.trim());

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        // Heading h3
        if (trimmed.startsWith('### ')) {
          return (
            <h3
              key={i}
              className="mt-6 mb-2 text-lg font-semibold tracking-tight text-white md:text-xl"
            >
              {renderInlineMarkdown(trimmed.slice(4))}
            </h3>
          );
        }

        // Heading h2
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={i}
              className="mt-8 mb-3 text-xl font-bold tracking-tight text-white md:text-2xl"
            >
              {renderInlineMarkdown(trimmed.slice(3))}
            </h2>
          );
        }

        // Unordered list
        if (trimmed.match(/^[-*]\s/m)) {
          const items = trimmed.split('\n').filter(l => l.trim().match(/^[-*]\s/));
          return (
            <ul key={i} className="space-y-2 pl-1">
              {items.map((item, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2 text-sm text-muted-foreground md:text-base"
                >
                  <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-primary" />
                  <span>{renderInlineMarkdown(item.replace(/^[-*]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
          const quoteContent = trimmed
            .split('\n')
            .map(l => l.replace(/^>\s?/, ''))
            .join(' ');
          return (
            <blockquote
              key={i}
              className="my-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground"
            >
              {renderInlineMarkdown(quoteContent)}
            </blockquote>
          );
        }

        // Horizontal rule
        if (trimmed.match(/^[-*_]{3,}$/)) {
          return (
            <div key={i} className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <Sparkles className="h-3 w-3 text-muted-foreground/50" />
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
          );
        }

        // Regular paragraph
        return (
          <p
            key={i}
            className="text-sm leading-relaxed text-muted-foreground md:text-base md:leading-7"
          >
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Render inline markdown (bold, italic, code, links)
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold + italic ***text***
    let match = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (match) {
      parts.push(
        <strong key={key++} className="font-bold italic text-white">
          {match[1]}
        </strong>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold **text**
    match = remaining.match(/^\*\*(.+?)\*\*/);
    if (match) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic *text*
    match = remaining.match(/^\*(.+?)\*/);
    if (match) {
      parts.push(
        <em key={key++} className="italic text-foreground/80">
          {match[1]}
        </em>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code `text`
    match = remaining.match(/^`(.+?)`/);
    if (match) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-primary"
        >
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Links [text](url)
    match = remaining.match(/^\[(.+?)\]\((.+?)\)/);
    if (match) {
      parts.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline underline-offset-2 transition-colors hover:text-blue-300"
        >
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Commit SHA pattern (7+ hex chars)
    match = remaining.match(/^([a-f0-9]{7,40})/);
    if (match && match[1].length >= 7) {
      parts.push(<CommitRef key={key++} sha={match[1]} />);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Regular character
    const nextSpecial = remaining.search(/[\*`\[\(]|[a-f0-9]{7,}/);
    if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining);
      remaining = '';
    }
  }

  return <>{parts}</>;
}

// Chapter component
function ChapterSection({
  chapter,
  isFirst,
  isLast,
  milestones,
  onVisible,
}: {
  chapter: StoryChapter;
  isFirst: boolean;
  isLast: boolean;
  milestones: StoryMilestone[];
  onVisible?: (anchorId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (!ref.current || !onVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(chapter.anchorId);
        }
      },
      { threshold: 0.3, rootMargin: '-100px 0px -40% 0px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [chapter.anchorId, onVisible]);

  const formattedStart = new Date(chapter.dateRange.start).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
  const formattedEnd = new Date(chapter.dateRange.end).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
  const dateRangeStr =
    formattedStart === formattedEnd ? formattedStart : `${formattedStart} — ${formattedEnd}`;

  // Find milestones that belong to this chapter's date range
  const chapterMilestones = milestones.filter(m => {
    const mDate = new Date(m.date).getTime();
    const startDate = new Date(chapter.dateRange.start).getTime();
    const endDate = new Date(chapter.dateRange.end).getTime();
    return mDate >= startDate && mDate <= endDate;
  });

  return (
    <div ref={ref} id={chapter.anchorId} className="scroll-mt-24">
      {/* Chapter divider */}
      {!isFirst && (
        <div className="my-10 flex items-center gap-4 md:my-14">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card px-4 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Chapter {chapter.index + 1}
            </span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>
      )}

      {/* Chapter header */}
      <div className="mb-6">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group flex w-full items-start justify-between text-left"
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white transition-colors md:text-2xl lg:text-3xl">
              {chapter.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-border/50 bg-card/50 text-xs text-muted-foreground"
              >
                <Calendar className="mr-1 h-3 w-3" />
                {dateRangeStr}
              </Badge>
              {chapter.repoIds.length > 0 && chapter.repoIds.length <= 3 && (
                <>
                  {chapter.repoIds.map(id => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="border-primary/20 bg-primary/5 text-xs text-primary"
                    >
                      <Code2 className="mr-1 h-3 w-3" />
                      {id.split('/').pop()}
                    </Badge>
                  ))}
                </>
              )}
              {chapter.repoIds.length > 3 && (
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/5 text-xs text-primary"
                >
                  <Code2 className="mr-1 h-3 w-3" />
                  {chapter.repoIds.length} repos
                </Badge>
              )}
            </div>
          </div>
          <div className="ml-4 mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-white">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        </button>
      </div>

      {/* Chapter content */}
      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Render milestones before content if they exist at the start */}
          {chapterMilestones.slice(0, 1).map((milestone, idx) => (
            <MilestoneCallout key={`pre-${idx}`} milestone={milestone} />
          ))}

          <RenderedMarkdown content={chapter.content} />

          {/* Render remaining milestones after content */}
          {chapterMilestones.slice(1).map((milestone, idx) => (
            <MilestoneCallout key={`post-${idx}`} milestone={milestone} />
          ))}
        </div>
      )}

      {/* Chapter end indicator for last chapter */}
      {isLast && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/30" />
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/30" />
          </div>
          <p className="text-sm italic text-muted-foreground">
            The journey continues with every commit...
          </p>
        </div>
      )}
    </div>
  );
}

// Stats bar component
function JourneyStatsBar({ story }: { story: GeneratedStory }) {
  const stats = [
    {
      icon: <BookOpen className="h-4 w-4" />,
      label: 'Chapters',
      value: story.chapters.length,
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: 'Milestones',
      value: story.milestones.length,
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Days Covered',
      value: story.dateRange.totalDays.toLocaleString(),
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: 'Key Moments',
      value: story.milestones.filter(m => m.significance >= 4).length,
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 backdrop-blur-sm"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {stat.icon}
          </div>
          <div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UnifiedDeveloperJourney({
  story,
  repositories,
  onChapterVisible,
}: UnifiedDeveloperJourneyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const formattedStart = new Date(story.dateRange.start).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedEnd = new Date(story.dateRange.end).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section ref={containerRef} id="unified-developer-journey" className="scroll-mt-20">
      {/* Section header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {story.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {story.subtitle}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedStart} — {formattedEnd}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{story.dateRange.totalDays} days</span>
          {story.model !== 'fallback' && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Badge
                variant="outline"
                className="border-purple-500/30 bg-purple-500/5 text-[10px] text-purple-400"
              >
                <Sparkles className="mr-1 h-2.5 w-2.5" />
                AI Generated
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <JourneyStatsBar story={story} />

      {/* Story content card */}
      <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
        <CardContent className="p-6 md:p-8 lg:p-10">
          {/* Prologue / intro if story has content before chapters */}
          {story.content && story.chapters.length > 0 && (
            <div className="mb-8">
              {/* Find content that appears before the first chapter heading */}
              {(() => {
                const firstChapterTitle = story.chapters[0]?.title;
                if (firstChapterTitle) {
                  const idx = story.content.indexOf(`## ${firstChapterTitle}`);
                  if (idx > 0) {
                    const prologueContent = story.content.slice(0, idx).trim();
                    if (prologueContent) {
                      return (
                        <div className="mb-8 rounded-lg border border-primary/10 bg-primary/5 p-5 md:p-6">
                          <div className="mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium uppercase tracking-wider text-primary">
                              Prologue
                            </span>
                          </div>
                          <RenderedMarkdown
                            content={prologueContent}
                            repoId={story.repoId}
                          />
                        </div>
                      );
                    }
                  }
                }
                return null;
              })()}
            </div>
          )}

          {/* Chapters */}
          {story.chapters.length > 0 ? (
            <div className="space-y-0">
              {story.chapters.map((chapter, index) => (
                <ChapterSection
                  key={chapter.anchorId}
                  chapter={chapter}
                  isFirst={index === 0}
                  isLast={index === story.chapters.length - 1}
                  milestones={story.milestones}
                  onVisible={onChapterVisible}
                />
              ))}
            </div>
          ) : (
            // Fallback: render the full content directly
            <RenderedMarkdown content={story.content} repoId={story.repoId} />
          )}
        </CardContent>
      </Card>

      {/* Generation metadata */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground/60">
        <span>
          Generated{' '}
          {new Date(story.generatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {story.model && story.model !== 'fallback' && (
          <span className="font-mono text-[10px]">
            model: {story.model}
          </span>
        )}
      </div>
    </section>
  );
}
