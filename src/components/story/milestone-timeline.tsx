'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { StoryMilestone, Repository, MilestoneTimelineProps } from '@/lib/types';
import { GITHUB_LANGUAGE_COLORS } from '@/lib/types';

const MILESTONE_TYPE_CONFIG: Record<
  StoryMilestone['type'],
  { color: string; bgColor: string; borderColor: string; label: string }
> = {
  'project-start': {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    label: 'Project Start',
  },
  'major-release': {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Major Release',
  },
  pivot: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: 'Pivot',
  },
  breakthrough: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    label: 'Breakthrough',
  },
  collaboration: {
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    label: 'Collaboration',
  },
  milestone: {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    label: 'Milestone',
  },
  achievement: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    label: 'Achievement',
  },
};

const REPO_COLORS = [
  '#3178c6', // TypeScript blue
  '#f1e05a', // JavaScript yellow
  '#e94560', // Vibrant red
  '#34d399', // Emerald green
  '#a78bfa', // Purple
  '#fb923c', // Orange
  '#f472b6', // Pink
  '#2dd4bf', // Teal
  '#60a5fa', // Light blue
  '#fbbf24', // Amber
];

function getRepoColor(repoId: string, repositories: Repository[], repoColorMap: Map<string, string>): string {
  if (repoColorMap.has(repoId)) {
    return repoColorMap.get(repoId)!;
  }

  const repo = repositories.find(r => r.id === repoId || r.fullName === repoId);
  if (repo?.language && GITHUB_LANGUAGE_COLORS[repo.language]) {
    const color = GITHUB_LANGUAGE_COLORS[repo.language];
    repoColorMap.set(repoId, color);
    return color;
  }

  const index = repoColorMap.size % REPO_COLORS.length;
  const color = REPO_COLORS[index];
  repoColorMap.set(repoId, color);
  return color;
}

function formatMilestoneDate(dateStr: string): { month: string; day: string; year: string; full: string } {
  const date = new Date(dateStr);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: 'numeric' }),
    year: date.toLocaleDateString('en-US', { year: 'numeric' }),
    full: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

function getSignificanceSize(significance: number): string {
  if (significance >= 5) return 'w-5 h-5';
  if (significance >= 4) return 'w-4 h-4';
  if (significance >= 3) return 'w-3.5 h-3.5';
  return 'w-3 h-3';
}

interface MilestoneNodeProps {
  milestone: StoryMilestone;
  index: number;
  isLeft: boolean;
  repoColor: string;
  isVisible: boolean;
  onClick?: (milestone: StoryMilestone) => void;
}

function MilestoneNode({ milestone, index, isLeft, repoColor, isVisible, onClick }: MilestoneNodeProps) {
  const typeConfig = MILESTONE_TYPE_CONFIG[milestone.type];
  const dateInfo = formatMilestoneDate(milestone.date);
  const dotSize = getSignificanceSize(milestone.significance);

  return (
    <div
      className={`relative flex items-start gap-4 md:gap-8 transition-all duration-700 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : isLeft
            ? 'opacity-0 -translate-x-8'
            : 'opacity-0 translate-x-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Mobile layout: single column */}
      <div className="flex md:hidden w-full">
        {/* Timeline line + dot */}
        <div className="flex flex-col items-center mr-4 flex-shrink-0">
          <div
            className={`${dotSize} rounded-full ring-2 ring-offset-2 ring-offset-[#0a0a0f] flex-shrink-0 z-10`}
            style={{
              backgroundColor: repoColor,
              outlineColor: repoColor,
              boxShadow: `0 0 12px ${repoColor}40, 0 0 24px ${repoColor}20`,
            }}
          />
          <div
            className="w-px flex-1 min-h-[40px]"
            style={{
              background: `linear-gradient(to bottom, ${repoColor}60, ${repoColor}10)`,
            }}
          />
        </div>

        {/* Content */}
        <Card
          className={`flex-1 mb-6 cursor-pointer border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${typeConfig.bgColor} ${typeConfig.borderColor} bg-[#0f0f1a]/80 backdrop-blur-sm`}
          onClick={() => onClick?.(milestone)}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" role="img" aria-label={typeConfig.label}>
                {milestone.icon}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium ${typeConfig.color} ${typeConfig.borderColor}`}
              >
                {typeConfig.label}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {dateInfo.month} {dateInfo.day}, {dateInfo.year}
              </span>
            </div>
            <h4 className="font-semibold text-sm text-foreground mb-1">{milestone.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{milestone.description}</p>
            {milestone.repoName && (
              <div className="mt-2 flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: repoColor }}
                />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {milestone.repoName}
                </span>
              </div>
            )}
            {/* Significance indicators */}
            <div className="mt-2 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i < milestone.significance ? '' : 'bg-muted/20'
                  }`}
                  style={{
                    backgroundColor: i < milestone.significance ? repoColor : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Desktop layout: alternating sides */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 w-full">
        {/* Left content */}
        <div className={`flex ${isLeft ? 'justify-end' : 'justify-end'}`}>
          {isLeft ? (
            <Card
              className={`max-w-md cursor-pointer border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${typeConfig.bgColor} ${typeConfig.borderColor} bg-[#0f0f1a]/80 backdrop-blur-sm`}
              onClick={() => onClick?.(milestone)}
            >
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="text-xs text-muted-foreground font-mono">
                    {dateInfo.full}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${typeConfig.color} ${typeConfig.borderColor}`}
                  >
                    {typeConfig.label}
                  </Badge>
                  <span className="text-lg" role="img" aria-label={typeConfig.label}>
                    {milestone.icon}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground mb-1.5 text-right">{milestone.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed text-right">
                  {milestone.description}
                </p>
                {milestone.repoName && (
                  <div className="mt-3 flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-muted-foreground font-mono">
                      {milestone.repoName}
                    </span>
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: repoColor }}
                    />
                  </div>
                )}
                <div className="mt-2 flex gap-0.5 justify-end">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < milestone.significance ? '' : 'bg-muted/20'
                      }`}
                      style={{
                        backgroundColor: i < milestone.significance ? repoColor : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-end pr-2">
              <span className="text-xs text-muted-foreground/60 font-mono">
                {dateInfo.month} {dateInfo.year}
              </span>
            </div>
          )}
        </div>

        {/* Center timeline */}
        <div className="flex flex-col items-center relative">
          <div
            className={`${dotSize} rounded-full ring-[3px] ring-offset-[3px] ring-offset-[#0a0a0f] flex-shrink-0 z-10 transition-transform duration-300 hover:scale-150`}
            style={{
              backgroundColor: repoColor,
              outlineColor: repoColor,
              boxShadow: `0 0 16px ${repoColor}50, 0 0 32px ${repoColor}25`,
            }}
          />
        </div>

        {/* Right content */}
        <div className={`flex ${!isLeft ? 'justify-start' : 'justify-start'}`}>
          {!isLeft ? (
            <Card
              className={`max-w-md cursor-pointer border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${typeConfig.bgColor} ${typeConfig.borderColor} bg-[#0f0f1a]/80 backdrop-blur-sm`}
              onClick={() => onClick?.(milestone)}
            >
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg" role="img" aria-label={typeConfig.label}>
                    {milestone.icon}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${typeConfig.color} ${typeConfig.borderColor}`}
                  >
                    {typeConfig.label}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {dateInfo.full}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground mb-1.5">{milestone.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {milestone.description}
                </p>
                {milestone.repoName && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: repoColor }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {milestone.repoName}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < milestone.significance ? '' : 'bg-muted/20'
                      }`}
                      style={{
                        backgroundColor: i < milestone.significance ? repoColor : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex items-center pl-2">
              <span className="text-xs text-muted-foreground/60 font-mono">
                {dateInfo.month} {dateInfo.year}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RepoLegendProps {
  repoColorMap: Map<string, string>;
  repositories: Repository[];
}

function RepoLegend({ repoColorMap, repositories }: RepoLegendProps) {
  if (repoColorMap.size <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
      {Array.from(repoColorMap.entries()).map(([repoId, color]) => {
        const repo = repositories.find(r => r.id === repoId || r.fullName === repoId);
        const displayName = repo?.name || repoId.split('/').pop() || repoId;

        return (
          <div key={repoId} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}40`,
              }}
            />
            <span className="text-xs text-muted-foreground font-mono">{displayName}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MilestoneTimeline({
  milestones,
  repositories,
  onMilestoneClick,
}: MilestoneTimelineProps) {
  const [visibleNodes, setVisibleNodes] = useState<Set<number>>(new Set());
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const repoColorMapRef = useRef<Map<string, string>>(new Map());

  // Build repo color map
  const repoColorMap = repoColorMapRef.current;
  for (const milestone of milestones) {
    if (milestone.repoId) {
      getRepoColor(milestone.repoId, repositories, repoColorMap);
    }
  }

  // Intersection observer for scroll-reveal animation
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            setVisibleNodes((prev) => {
              const next = new Set(prev);
              next.add(index);
              return next;
            });
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observers.push(observer);

    // Observe all registered nodes
    nodeRefs.current.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [milestones.length]);

  const setNodeRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(index, el);
    } else {
      nodeRefs.current.delete(index);
    }
  }, []);

  if (milestones.length === 0) {
    return (
      <section id="milestone-timeline" className="py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-muted-foreground/30" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Milestone Timeline
            </h2>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground text-sm">
            No milestones detected yet. Generate a story to uncover key moments in your development journey.
          </p>
        </div>
      </section>
    );
  }

  // Group milestones by year for visual grouping
  const milestonesByYear = milestones.reduce<Record<string, { milestones: StoryMilestone[]; startIndex: number }>>((acc, milestone, index) => {
    const year = new Date(milestone.date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = { milestones: [], startIndex: index };
    }
    acc[year].milestones.push(milestone);
    return acc;
  }, {});

  const years = Object.keys(milestonesByYear).sort();

  return (
    <section id="milestone-timeline" className="py-12" ref={containerRef}>
      {/* Section header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-500/50" />
          <span className="text-cyan-400 text-sm font-mono uppercase tracking-widest">Timeline</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-500/50" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
          Key Milestones
        </h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          The pivotal moments, breakthroughs, and turning points extracted from your commit history and AI analysis.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <span className="font-mono">
            {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}
          </span>
          <span>•</span>
          <span className="font-mono">
            {years.length} year{years.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Repo color legend */}
      <RepoLegend repoColorMap={repoColorMap} repositories={repositories} />

      {/* Timeline */}
      <div className="relative max-w-4xl mx-auto">
        {/* Vertical line (desktop) */}
        <div
          className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(96, 165, 250, 0.2) 5%, rgba(96, 165, 250, 0.15) 90%, transparent)',
          }}
        />

        {/* Year groups */}
        {years.map((year) => {
          const group = milestonesByYear[year];
          return (
            <div key={year} className="relative">
              {/* Year label */}
              <div className="flex items-center justify-center mb-6 md:mb-8 relative z-10">
                <div className="px-4 py-1.5 rounded-full bg-[#0f0f1a] border border-muted/20 shadow-lg">
                  <span className="text-sm font-bold font-mono bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {year}
                  </span>
                </div>
              </div>

              {/* Milestones in this year */}
              <div className="space-y-2 md:space-y-6">
                {group.milestones.map((milestone, localIndex) => {
                  const globalIndex = group.startIndex + localIndex;
                  const isLeft = globalIndex % 2 === 0;
                  const milestoneRepoColor = milestone.repoId
                    ? getRepoColor(milestone.repoId, repositories, repoColorMap)
                    : '#60a5fa';

                  return (
                    <div
                      key={`${milestone.date}-${milestone.title}-${globalIndex}`}
                      ref={(el) => setNodeRef(globalIndex, el)}
                      data-index={globalIndex}
                    >
                      <MilestoneNode
                        milestone={milestone}
                        index={globalIndex}
                        isLeft={isLeft}
                        repoColor={milestoneRepoColor}
                        isVisible={visibleNodes.has(globalIndex)}
                        onClick={onMilestoneClick}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Spacer between years */}
              <div className="h-8 md:h-12" />
            </div>
          );
        })}

        {/* End cap */}
        <div className="flex items-center justify-center relative z-10">
          <div className="w-8 h-8 rounded-full bg-[#0f0f1a] border-2 border-muted/30 flex items-center justify-center shadow-lg">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 animate-pulse" />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground/50 mt-3 font-mono">
          The journey continues...
        </p>
      </div>

      {/* Milestone type legend */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        {Object.entries(MILESTONE_TYPE_CONFIG).map(([type, config]) => (
          <div
            key={type}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor} ${config.borderColor} border`}
          >
            <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
