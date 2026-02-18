'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, GitCommitHorizontal, FolderGit2, Clock, Zap, X } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { ProcessingStatus } from '@/lib/types';
import type { SelectedReposSummaryProps, Repository } from '@/lib/types';

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (latest) => Math.round(latest).toLocaleString());
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(v);
    });
    return unsubscribe;
  }, [display]);

  return <span className={className}>{displayValue}</span>;
}

function getProcessingEstimate(commits: number): string {
  if (commits === 0) return 'Select repos to begin';
  if (commits < 500) return '~30 seconds';
  if (commits < 2000) return '~1-2 minutes';
  if (commits < 5000) return '~3-5 minutes';
  if (commits < 10000) return '~5-10 minutes';
  return '~10-15 minutes (large dataset)';
}

function getEstimateColor(commits: number): string {
  if (commits < 500) return 'text-emerald-400';
  if (commits < 2000) return 'text-sky-400';
  if (commits < 5000) return 'text-amber-400';
  return 'text-orange-400';
}

interface SelectedReposSummaryFullProps extends SelectedReposSummaryProps {
  selectedRepos: Repository[];
  onRemoveRepo?: (repoId: string) => void;
}

export function SelectedReposSummary({
  selectedCount,
  estimatedCommits,
  canGenerate,
  onGenerate,
  processingEstimate,
  selectedRepos = [],
  onRemoveRepo,
}: SelectedReposSummaryFullProps) {
  const appStore = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRepoList, setShowRepoList] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const currentStatus = appStore.processingStatus;
  const isProcessing =
    currentStatus === ProcessingStatus.FETCHING ||
    currentStatus === ProcessingStatus.ANALYZING ||
    currentStatus === ProcessingStatus.GENERATING;

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating || isProcessing) return;

    setIsGenerating(true);
    try {
      await onGenerate();
    } catch {
      setIsGenerating(false);
    }
  };

  const estimateText = processingEstimate || getProcessingEstimate(estimatedCommits);
  const estimateColorClass = getEstimateColor(estimatedCommits);

  // Unique languages across selected repos
  const uniqueLanguages = Array.from(
    new Set(selectedRepos.filter((r) => r.language).map((r) => r.language!))
  ).slice(0, 5);

  // Total stars
  const totalStars = selectedRepos.reduce((sum, r) => sum + r.starCount, 0);

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          ref={summaryRef}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50"
        >
          {/* Gradient top border */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

          {/* Glass background */}
          <div className="bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-2xl shadow-purple-900/20">
            {/* Expandable repo list */}
            <AnimatePresence>
              {showRepoList && selectedRepos.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-border/30"
                >
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {selectedRepos.map((repo) => (
                        <motion.div
                          key={repo.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          layout
                        >
                          <Badge
                            variant="secondary"
                            className="bg-muted/50 border border-border/50 flex items-center gap-1.5 py-1 px-2.5 text-xs hover:bg-muted/80 transition-colors"
                          >
                            <FolderGit2 className="h-3 w-3 text-purple-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{repo.fullName}</span>
                            {repo.language && (
                              <span className="text-muted-foreground">· {repo.language}</span>
                            )}
                            {onRemoveRepo && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveRepo(repo.id);
                                }}
                                className="ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                                aria-label={`Remove ${repo.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main summary bar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                {/* Left: Stats */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-5 flex-1 min-w-0">
                  {/* Repo count - clickable to expand */}
                  <button
                    onClick={() => setShowRepoList(!showRepoList)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group"
                  >
                    <div className="relative">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30 flex items-center justify-center">
                        <FolderGit2 className="h-4 w-4 text-purple-400" />
                      </div>
                      <motion.div
                        key={selectedCount}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-purple-500/50"
                      >
                        {selectedCount}
                      </motion.div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-foreground leading-tight">
                        <AnimatedNumber value={selectedCount} /> repo{selectedCount !== 1 ? 's' : ''}
                      </div>
                      <div className="text-[10px] text-muted-foreground group-hover:text-purple-400 transition-colors">
                        {showRepoList ? 'Hide list' : 'Show list'}
                      </div>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="hidden sm:block h-8 w-px bg-border/50" />

                  {/* Estimated commits */}
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/30 flex items-center justify-center">
                      <GitCommitHorizontal className="h-4 w-4 text-sky-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground leading-tight">
                        ~<AnimatedNumber value={estimatedCommits} /> commits
                      </div>
                      <div className="text-[10px] text-muted-foreground">to analyze</div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:block h-8 w-px bg-border/50" />

                  {/* Processing estimate */}
                  <div className="hidden md:flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <div className={`text-sm font-semibold leading-tight ${estimateColorClass}`}>
                        {estimateText}
                      </div>
                      <div className="text-[10px] text-muted-foreground">estimated time</div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden lg:block h-8 w-px bg-border/50" />

                  {/* Languages preview */}
                  {uniqueLanguages.length > 0 && (
                    <div className="hidden lg:flex items-center gap-1.5">
                      {uniqueLanguages.map((lang) => (
                        <Badge
                          key={lang}
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 border-border/50 text-muted-foreground"
                        >
                          {lang}
                        </Badge>
                      ))}
                      {totalStars > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ⭐ {totalStars.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Generate button */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Mobile processing estimate */}
                  <div className="flex md:hidden items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className={estimateColorClass}>{estimateText}</span>
                  </div>

                  <div className="flex-1 sm:flex-initial">
                    <Button
                      onClick={handleGenerate}
                      disabled={!canGenerate || isGenerating || isProcessing}
                      size="lg"
                      className="w-full sm:w-auto relative overflow-hidden bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:shadow-none border-0 h-11 px-6 font-semibold"
                    >
                      {isProcessing ? (
                        <motion.div
                          className="flex items-center gap-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>
                            {currentStatus === ProcessingStatus.FETCHING && 'Fetching commits...'}
                            {currentStatus === ProcessingStatus.ANALYZING && 'Analyzing data...'}
                            {currentStatus === ProcessingStatus.GENERATING && 'Generating story...'}
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          className="flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {canGenerate ? (
                            <Sparkles className="h-4 w-4" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          <span>Generate My Story</span>
                        </motion.div>
                      )}

                      {/* Shimmer effect */}
                      {canGenerate && !isProcessing && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 3,
                            ease: 'linear',
                          }}
                        />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Progress bar when processing */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500 bg-[length:200%_100%]"
                        initial={{ width: '0%' }}
                        animate={{
                          width:
                            currentStatus === ProcessingStatus.FETCHING
                              ? '33%'
                              : currentStatus === ProcessingStatus.ANALYZING
                              ? '66%'
                              : '90%',
                          backgroundPosition: ['0% 0%', '100% 0%'],
                        }}
                        transition={{
                          width: { duration: 0.5, ease: 'easeOut' },
                          backgroundPosition: {
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'linear',
                          },
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Processing {selectedCount} repositories...
                      </span>
                      <span className="text-[10px] text-purple-400">
                        {currentStatus === ProcessingStatus.FETCHING && 'Step 1/3'}
                        {currentStatus === ProcessingStatus.ANALYZING && 'Step 2/3'}
                        {currentStatus === ProcessingStatus.GENERATING && 'Step 3/3'}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
