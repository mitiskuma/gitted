'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { StoryPhase, StoryGenerationProgress } from '@/lib/types';
import { BookOpen, RefreshCw, Sparkles, AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';

interface StoryHeaderProps {
  dateRangeStart?: string;
  dateRangeEnd?: string;
  progress: StoryGenerationProgress;
  isGenerating: boolean;
  error: string | null;
  onRegenerate: () => void;
  totalRepos?: number;
  totalCommits?: number;
}

function getStatusConfig(phase: StoryPhase, isGenerating: boolean, error: string | null) {
  if (error) {
    return {
      label: 'Generation Failed',
      variant: 'destructive' as const,
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/20',
      pulse: false,
    };
  }

  if (phase === ('complete' as StoryPhase)) {
    return {
      label: 'Story Complete',
      variant: 'default' as const,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      pulse: false,
    };
  }

  if (isGenerating) {
    return {
      label: getPhaseLabel(phase),
      variant: 'secondary' as const,
      icon: Loader2,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10 border-violet-500/20',
      pulse: true,
    };
  }

  return {
    label: 'Ready to Generate',
    variant: 'outline' as const,
    icon: Sparkles,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 border-zinc-500/20',
    pulse: false,
  };
}

function getPhaseLabel(phase: StoryPhase): string {
  switch (phase) {
    case 'preprocessing':
      return 'Analyzing Commits';
    case 'analyzing-repos':
      return 'Analyzing Repositories';
    case 'correlating':
      return 'Finding Connections';
    case 'writing-chapters':
      return 'Writing Chapters';
    case 'enriching':
      return 'Finishing Touches';
    case 'batching-commits':
      return 'Preparing Commits';
    case 'summarizing':
      return 'Analyzing Patterns';
    case 'generating-narrative':
      return 'Crafting Narrative';
    case 'extracting-milestones':
      return 'Finding Milestones';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    default:
      return 'Initializing';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins}m ${secs}s remaining`;
}

export function StoryHeader({
  dateRangeStart,
  dateRangeEnd,
  progress,
  isGenerating,
  error,
  onRegenerate,
  totalRepos,
  totalCommits,
}: StoryHeaderProps) {
  const status = getStatusConfig(progress.phase as StoryPhase, isGenerating, error);
  const StatusIcon = status.icon;

  const handleRegenerate = useCallback(() => {
    onRegenerate();
  }, [onRegenerate]);

  const hasDateRange = dateRangeStart && dateRangeEnd;
  const formattedStart = formatDate(dateRangeStart);
  const formattedEnd = formatDate(dateRangeEnd);
  const timeRemaining = formatTimeRemaining(progress.estimatedTimeRemaining);

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Top meta row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge
              variant={status.variant}
              className={`${status.bgColor} border ${status.color} text-xs font-medium px-3 py-1 flex items-center gap-1.5`}
            >
              <StatusIcon className={`h-3 w-3 ${status.pulse ? 'animate-spin' : ''}`} />
              {status.label}
            </Badge>

            {totalRepos && totalRepos > 0 && (
              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700 bg-zinc-800/50">
                {totalRepos} {totalRepos === 1 ? 'repository' : 'repositories'}
              </Badge>
            )}

            {totalCommits && totalCommits > 0 && (
              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700 bg-zinc-800/50">
                {totalCommits.toLocaleString()} commits analyzed
              </Badge>
            )}
          </div>

          {/* Main title */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/20">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                  Your Developer Journey
                </h1>
              </div>

              {hasDateRange ? (
                <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
                  A narrative spanning from{' '}
                  <span className="text-zinc-200 font-medium">{formattedStart}</span>
                  {' '}to{' '}
                  <span className="text-zinc-200 font-medium">{formattedEnd}</span>
                  {' '}— powered by AI analysis of your commit history, code changes, and development timeline.
                </p>
              ) : (
                <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
                  AI-generated narrative crafted from your commit messages, code changes, and development timeline. Every commit tells a story — let&apos;s read yours.
                </p>
              )}

              {/* Generation progress indicator */}
              {isGenerating && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{progress.currentStep}</span>
                    <span className="text-violet-400 font-mono text-xs">
                      {progress.overallProgress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress.overallProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>
                      {progress.reposProcessed}/{progress.totalRepos} repos processed
                    </span>
                    {timeRemaining && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeRemaining}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Story generation encountered an error</p>
                    <p className="text-red-400/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Regenerate button */}
            <div className="shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      variant={error ? 'default' : 'outline'}
                      size="lg"
                      className={
                        error
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-violet-500/20 transition-all duration-200'
                          : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-200 hover:text-white transition-all duration-200 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10'
                      }
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                      {isGenerating ? 'Generating...' : error ? 'Retry Generation' : 'Regenerate Story'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <p>
                      {isGenerating
                        ? 'Story generation is in progress...'
                        : 'Generate a fresh AI narrative from your commit history'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Decorative bottom border */}
          <div className="mt-8 sm:mt-10 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        </div>
      </div>
    </section>
  );
}
