'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { useRepoFetcher } from '@/hooks/use-repo-fetcher';
import { useAppStore } from '@/stores/app-store';
import { useGitData } from '@/context/git-data-provider';
import { useAuth } from '@/context/auth-provider';
import { ClaudeOAuthInput } from '@/components/connect/claude-oauth-input';
import { GitHubOAuthConnect } from '@/components/connect/github-oauth-connect';
import { RepositorySelector } from '@/components/connect/repository-selector';
import { SelectedReposSummary } from '@/components/connect/selected-repos-summary';
import type { RepoFilter, SelectableRepository, ProcessingStatus } from '@/lib/types';
import { ProcessingStatus as ProcessingStatusEnum } from '@/lib/types';

export default function ConnectPage() {
  const router = useRouter();
  const auth = useAuth();
  const gitData = useGitData();
  const githubAuth = useGitHubAuth();
  const repoFetcher = useRepoFetcher();
  const appStore = useAppStore();

  // Claude token state
  const [claudeToken, setClaudeToken] = useState(auth.claudeToken || '');
  const [isClaudeVerified, setIsClaudeVerified] = useState(!!auth.claudeToken);
  const [isClaudeVerifying, setIsClaudeVerifying] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);

  // Selected repos tracking (local state synced to app store on generate)
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(
    new Set(appStore.selectedRepos)
  );

  // Generate state
  const [isGenerating, setIsGenerating] = useState(false);
  const generateTriggeredRef = useRef(false);

  // Determine which phase we're in
  const isPhase1 = !githubAuth.isConnected;
  const isPhase2 = githubAuth.isConnected;

  // Sync claude token from auth context
  useEffect(() => {
    if (auth.claudeToken) {
      setClaudeToken(auth.claudeToken);
      setIsClaudeVerified(true);
    }
  }, [auth.claudeToken]);

  // Handle Claude token verification
  const handleVerifyClaude = useCallback(async (): Promise<boolean> => {
    if (!claudeToken.trim()) {
      setClaudeError('Please enter your Claude API key');
      return false;
    }

    setIsClaudeVerifying(true);
    setClaudeError(null);

    try {
      // Validate the token format (sk-ant-* or similar patterns)
      const isValidFormat =
        claudeToken.startsWith('sk-ant-') ||
        claudeToken.startsWith('sk-') ||
        claudeToken.length > 20;

      if (!isValidFormat) {
        setClaudeError('Invalid token format. Claude API keys typically start with "sk-ant-"');
        setIsClaudeVerifying(false);
        return false;
      }

      // Attempt a lightweight API call to validate
      const success = await auth.setClaudeToken(claudeToken);
      if (success) {
        setIsClaudeVerified(true);
        setClaudeError(null);
        return true;
      } else {
        setClaudeError('Could not verify the token. Please check and try again.');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setClaudeError(message);
      return false;
    } finally {
      setIsClaudeVerifying(false);
    }
  }, [claudeToken, auth]);

  // Handle Claude token change
  const handleClaudeTokenChange = useCallback((value: string) => {
    setClaudeToken(value);
    setClaudeError(null);
    if (!value.trim()) {
      setIsClaudeVerified(false);
    }
  }, []);

  // Handle repo selection change from RepositorySelector
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedRepoIds(new Set(ids));
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filter: RepoFilter) => {
      // Apply individual filter properties
      repoFetcher.filter(filter);
    },
    [repoFetcher]
  );

  // Compute selected repos with metadata
  const selectedRepos: SelectableRepository[] = useMemo(() => {
    return repoFetcher.repos.filter((r) => selectedRepoIds.has(r.id));
  }, [repoFetcher.repos, selectedRepoIds]);

  // Estimated total commits across selected repos
  const estimatedCommits = useMemo(() => {
    let total = 0;
    for (const id of selectedRepoIds) {
      const repo = repoFetcher.repos.find((r) => r.id === id);
      if (repo) {
        // Estimate based on size/age if commitCount is null
        total += repo.commitCount ?? Math.max(Math.floor(repo.size / 10), 50);
      }
    }
    return total;
  }, [selectedRepoIds, repoFetcher.repos]);

  // Processing estimate text
  const processingEstimate = useMemo(() => {
    if (estimatedCommits < 500) return '~30 seconds';
    if (estimatedCommits < 2000) return '~1-2 minutes';
    if (estimatedCommits < 5000) return '~3-5 minutes';
    return '~5-10 minutes';
  }, [estimatedCommits]);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (generateTriggeredRef.current || selectedRepoIds.size === 0) return;
    generateTriggeredRef.current = true;
    setIsGenerating(true);

    try {
      // Step 1: Write selected repos to app store
      const selectedArray = Array.from(selectedRepoIds);
      appStore.setSelectedRepos(selectedArray);

      // Step 2: Set selected repositories in GitDataProvider
      const fullRepos = gitData.allRepositories.filter((r) => selectedRepoIds.has(r.id));
      gitData.setSelectedRepositories(fullRepos);

      // Step 3: Set processing status to fetching
      appStore.setProcessingStatus(ProcessingStatusEnum.FETCHING);

      // Step 4: Fetch commits for selected repos
      await gitData.fetchSelectedRepoData();

      // Step 5: Set processing status to analyzing
      appStore.setProcessingStatus(ProcessingStatusEnum.ANALYZING);

      // Step 6: Compute analytics via API route
      try {
        const response = await fetch('/api/analytics/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoIds: selectedArray,
          }),
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            gitData.setAnalytics(result.data);
          }
        }
      } catch {
        // Analytics computation failure is non-fatal — dashboard can recompute
        console.warn('Server-side analytics computation failed, will compute client-side');
      }

      // Step 7: Set processing status to idle, mark as initialized, and navigate
      appStore.setProcessingStatus(ProcessingStatusEnum.IDLE);
      appStore.setInitialized(true);
      router.push('/dashboard');
    } catch (err) {
      console.error('Generate failed:', err);
      appStore.setProcessingStatus(ProcessingStatusEnum.ERROR);
      appStore.setError(
        err instanceof Error ? err.message : 'Failed to generate your story'
      );
      setIsGenerating(false);
      generateTriggeredRef.current = false;
    }
  }, [selectedRepoIds, appStore, gitData, router]);

  const canGenerate = selectedRepoIds.size > 0 && !isGenerating;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#111118] to-[#0a0a0f]">
      {/* Background decorative elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Connect Your{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Code
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            Link your GitHub account and select the repositories that tell your developer story.
            We&apos;ll analyze your commits to generate beautiful visualizations of your coding journey.
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-10"
        >
          <div className="flex items-center justify-center gap-0">
            <StepIndicator
              step={1}
              label="Authenticate"
              isActive={isPhase1}
              isComplete={isPhase2}
            />
            <div
              className={`h-0.5 w-16 transition-colors duration-500 sm:w-24 ${
                isPhase2 ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            />
            <StepIndicator
              step={2}
              label="Select Repos"
              isActive={isPhase2 && selectedRepoIds.size === 0}
              isComplete={selectedRepoIds.size > 0}
            />
            <div
              className={`h-0.5 w-16 transition-colors duration-500 sm:w-24 ${
                selectedRepoIds.size > 0 ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            />
            <StepIndicator
              step={3}
              label="Generate"
              isActive={selectedRepoIds.size > 0}
              isComplete={false}
            />
          </div>
        </motion.div>

        {/* Phase 1: Authentication */}
        <AnimatePresence mode="wait">
          {isPhase1 && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Claude OAuth Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <ClaudeOAuthInput
                  value={claudeToken}
                  onChange={handleClaudeTokenChange}
                  onVerify={handleVerifyClaude}
                  isVerified={isClaudeVerified}
                  isVerifying={isClaudeVerifying}
                  error={claudeError}
                />
              </motion.div>

              {/* GitHub OAuth Connect */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
              >
                <GitHubOAuthConnect
                  isConnected={githubAuth.isConnected}
                  user={githubAuth.user}
                  onConnect={githubAuth.initiateOAuth}
                  onDisconnect={githubAuth.disconnect}
                  isConnecting={githubAuth.isLoading}
                />
              </motion.div>

              {/* Error display from GitHub Auth */}
              {githubAuth.error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg">⚠️</span>
                    <div>
                      <p className="font-medium">Authentication Error</p>
                      <p className="mt-1 text-red-400/80">{githubAuth.error}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Info card */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">🔒</span>
                  <div>
                    <h3 className="font-medium text-zinc-300">Your data stays private</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      We only read your public repository metadata and commit history. Your tokens
                      are stored locally in your browser and never sent to our servers. All
                      processing happens client-side.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Phase 2: Repository Selection */}
          {isPhase2 && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Connected user summary */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900/50 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  {githubAuth.user?.avatarUrl && (
                    <img
                      src={githubAuth.user.avatarUrl}
                      alt={githubAuth.user.login}
                      className="h-9 w-9 rounded-full ring-2 ring-emerald-500/30"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {githubAuth.user?.name || githubAuth.user?.login}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {githubAuth.user?.publicRepos} public repos
                      {githubAuth.user?.totalRepos &&
                        githubAuth.user.totalRepos > githubAuth.user.publicRepos &&
                        ` · ${githubAuth.user.totalRepos - githubAuth.user.publicRepos} private`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isClaudeVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                      Claude Connected
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    GitHub Connected
                  </span>
                </div>
              </motion.div>

              {/* Repository Selector */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <RepositorySelector
                  repositories={repoFetcher.repos.map((r) => ({
                    ...r,
                    isSelected: selectedRepoIds.has(r.id),
                  }))}
                  onSelectionChange={handleSelectionChange}
                  isLoading={repoFetcher.isLoading}
                  hasMore={repoFetcher.hasMore}
                  onLoadMore={repoFetcher.loadMore}
                  filter={repoFetcher.currentFilter}
                  onFilterChange={handleFilterChange}
                />
              </motion.div>

              {/* Repo fetcher error */}
              {repoFetcher.error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg">⚠️</span>
                    <div>
                      <p className="font-medium">Error Loading Repositories</p>
                      <p className="mt-1 text-red-400/80">{repoFetcher.error}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Bottom spacer for sticky summary bar */}
              <div className="h-28" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Repos Summary (sticky bottom bar) */}
        <AnimatePresence>
          {isPhase2 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SelectedReposSummary
                selectedCount={selectedRepoIds.size}
                estimatedCommits={estimatedCommits}
                canGenerate={canGenerate}
                onGenerate={handleGenerate}
                processingEstimate={processingEstimate}
                selectedRepos={selectedRepos}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generating overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-4 max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl"
            >
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-700 border-t-purple-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">🚀</span>
                  </div>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Generating Your Story</h3>
              <p className="mb-4 text-sm text-zinc-400">
                Analyzing {selectedRepoIds.size} repositories with ~{estimatedCommits.toLocaleString()}{' '}
                estimated commits
              </p>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '60%' }}
                  transition={{ duration: 8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-zinc-500">
                Estimated time: {processingEstimate}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Step indicator component
function StepIndicator({
  step,
  label,
  isActive,
  isComplete,
}: {
  step: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-500 ${
          isComplete
            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
            : isActive
              ? 'border-purple-500 bg-purple-500/20 text-purple-400'
              : 'border-zinc-700 bg-zinc-900 text-zinc-600'
        }`}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
      >
        {isComplete ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
      </motion.div>
      <span
        className={`text-xs font-medium transition-colors duration-300 ${
          isComplete
            ? 'text-emerald-400'
            : isActive
              ? 'text-purple-400'
              : 'text-zinc-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
