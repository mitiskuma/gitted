'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGitData } from '@/context/git-data-provider'
import { useAppStore } from '@/stores/app-store'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  type Repository,
  type CommitData,
  type Contributor,
  type DateRange,
} from '@/lib/types'
import { ArrowLeft, GitCommitHorizontal, FileCode2, Users, CalendarDays, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'

const RepoHeader = dynamic(() => import('@/components/repo-detail/repo-header').then(mod => ({ default: mod.RepoHeader })), { ssr: false })
const CommitHistoryGraph = dynamic(() => import('@/components/repo-detail/commit-history-graph').then(mod => ({ default: mod.CommitHistoryGraph })), { ssr: false })
const ContributorBreakdown = dynamic(() => import('@/components/repo-detail/contributor-breakdown').then(mod => ({ default: mod.ContributorBreakdown })), { ssr: false })
const FileChangeTreemap = dynamic(() => import('@/components/repo-detail/file-change-treemap').then(mod => ({ default: mod.FileChangeTreemap })), { ssr: false })
const CodeFrequencyChart = dynamic(() => import('@/components/repo-detail/code-frequency-chart').then(mod => ({ default: mod.CodeFrequencyChart })), { ssr: false })
const AIRepoSummary = dynamic(() => import('@/components/repo-detail/ai-repo-summary').then(mod => ({ default: mod.AIRepoSummary })), { ssr: false })
const QuickLinks = dynamic(() => import('@/components/repo-detail/quick-links').then(mod => ({ default: mod.QuickLinks })), { ssr: false })

// Compute contributors from commits
function computeContributorsFromCommits(commits: CommitData[]): Contributor[] {
  const contributorMap = new Map<string, Contributor>()

  for (const commit of commits) {
    const key = commit.author.login || commit.author.email || commit.author.name
    const existing = contributorMap.get(key)

    if (existing) {
      existing.totalCommits += 1
      existing.totalAdditions += commit.additions
      existing.totalDeletions += commit.deletions
      if (commit.timestamp < existing.firstCommitDate) existing.firstCommitDate = commit.timestamp
      if (commit.timestamp > existing.lastCommitDate) existing.lastCommitDate = commit.timestamp
      if (!existing.repos.includes(commit.repoId)) existing.repos.push(commit.repoId)
    } else {
      contributorMap.set(key, {
        id: key,
        name: commit.author.name,
        email: commit.author.email,
        login: commit.author.login,
        avatarUrl: commit.author.avatarUrl,
        totalCommits: 1,
        totalAdditions: commit.additions,
        totalDeletions: commit.deletions,
        firstCommitDate: commit.timestamp,
        lastCommitDate: commit.timestamp,
        repos: [commit.repoId],
        color: generateContributorColor(key),
      })
    }
  }

  return Array.from(contributorMap.values()).sort((a, b) => b.totalCommits - a.totalCommits)
}

function generateContributorColor(id: string): string {
  const colors = ['#60a5fa', '#f97316', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#fbbf24', '#2dd4bf', '#e879f9', '#38bdf8']
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function RepoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const gitData = useGitData()
  const { selectedRepos } = useAppStore()

  const repoId = decodeURIComponent(params.id as string)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const hasFetched = useRef(false)

  // Find repo from git data context
  const repository = useMemo(() => {
    return gitData.allRepositories.find((r: Repository) => r.fullName === repoId || r.id === repoId) || null
  }, [gitData.allRepositories, repoId])

  // Get commits for this repo
  const commits = useMemo(() => {
    return gitData.commitsByRepo[repoId] || []
  }, [gitData.commitsByRepo, repoId])

  // Compute derived data
  const contributors = useMemo(() => computeContributorsFromCommits(commits), [commits])

  const dateRange: DateRange | null = useMemo(() => {
    if (commits.length === 0) return null
    const sorted = [...commits].sort((a: CommitData, b: CommitData) => a.timestampMs - b.timestampMs)
    const start = sorted[0].timestamp
    const end = sorted[sorted.length - 1].timestamp
    const totalDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
    return { start, end, totalDays }
  }, [commits])

  const totalStats = useMemo(() => {
    return {
      totalCommits: commits.length,
      totalAdditions: commits.reduce((sum: number, c: CommitData) => sum + c.additions, 0),
      totalDeletions: commits.reduce((sum: number, c: CommitData) => sum + c.deletions, 0),
      totalFilesChanged: commits.reduce((sum: number, c: CommitData) => sum + c.filesChanged, 0),
      uniqueContributors: contributors.length,
    }
  }, [commits, contributors])

  // Fetch data if not available (direct navigation)
  useEffect(() => {
    if (hasFetched.current) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // If repo data is already in context, just mark as loaded
        if (repository && commits.length > 0) {
          setIsLoading(false)
          hasFetched.current = true
          return
        }

        // If data is not in context, try to fetch
        if (!repository || commits.length === 0) {
          // Check if the repo ID is in selectedRepos
          if (selectedRepos.includes(repoId)) {
            // Data should be loading or already loaded via GitDataProvider
            // Wait a bit and check again
            await new Promise((resolve) => setTimeout(resolve, 1000))
            if (gitData.commitsByRepo[repoId]?.length > 0) {
              setIsLoading(false)
              hasFetched.current = true
              return
            }
          }

          // Try to fetch directly
          try {
            await gitData.fetchSelectedRepoData()
          } catch {
            // If we still don't have data, show what we have or error
          }
        }

        setIsLoading(false)
        hasFetched.current = true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repository data')
        setIsLoading(false)
        hasFetched.current = true
      }
    }

    fetchData()
  }, [repoId, repository, commits.length, selectedRepos, gitData])

  // Update loading state when data arrives
  useEffect(() => {
    if (repository && commits.length > 0 && isLoading) {
      setIsLoading(false)
    }
  }, [repository, commits.length, isLoading])

  const handleRetry = async () => {
    setRetrying(true)
    hasFetched.current = false
    setError(null)
    try {
      await gitData.fetchSelectedRepoData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository data')
    }
    setRetrying(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-8 w-64" />
          </div>
          {/* Header skeleton */}
          <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
            <Skeleton className="mb-4 h-12 w-96" />
            <Skeleton className="mb-6 h-6 w-full max-w-2xl" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
          {/* Chart skeletons */}
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Failed to Load Repository</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={handleRetry} disabled={retrying}>
                <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No data state
  if (!repository) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileCode2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Repository Not Found</h2>
            <p className="text-sm text-muted-foreground">
              The repository <code className="rounded bg-muted px-2 py-0.5 text-xs">{repoId}</code> was not found in your data.
              Try connecting and selecting it first.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={() => router.push('/connect')}>
                Connect Repos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <div className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-muted-foreground">{repository.owner.login}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-medium">{repository.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {commits.length > 0 && (
              <Badge variant="secondary" className="gap-1.5">
                <GitCommitHorizontal className="h-3 w-3" />
                {totalStats.totalCommits.toLocaleString()} commits
              </Badge>
            )}
            {repository.language && (
              <Badge
                variant="outline"
                className="gap-1.5"
                style={{
                  borderColor: repository.languages?.[repository.language] ? undefined : '#3178c6',
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: '#3178c6' }}
                />
                {repository.language}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Repository Header */}
        <section className="mb-8">
          <RepoHeader
            repository={repository}
            dateRange={dateRange || { start: repository.createdAt, end: repository.updatedAt, totalDays: 0 }}
            commitCount={totalStats.totalCommits}
          />
        </section>

        {/* Quick Stats Row */}
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatMiniCard
              icon={<GitCommitHorizontal className="h-4 w-4" />}
              label="Total Commits"
              value={totalStats.totalCommits.toLocaleString()}
              color="text-blue-400"
            />
            <StatMiniCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Lines Added"
              value={`+${totalStats.totalAdditions.toLocaleString()}`}
              color="text-emerald-400"
            />
            <StatMiniCard
              icon={<TrendingUp className="h-4 w-4 rotate-180" />}
              label="Lines Deleted"
              value={`-${totalStats.totalDeletions.toLocaleString()}`}
              color="text-red-400"
            />
            <StatMiniCard
              icon={<Users className="h-4 w-4" />}
              label="Contributors"
              value={totalStats.uniqueContributors.toString()}
              color="text-purple-400"
            />
            <StatMiniCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Active Days"
              value={dateRange ? dateRange.totalDays.toLocaleString() : '—'}
              color="text-amber-400"
            />
          </div>
        </section>

        {/* Main content grid */}
        {commits.length > 0 ? (
          <>
            {/* Commit History Graph - Full width */}
            <section className="mb-8">
              <CommitHistoryGraph
                commits={commits}
              />
            </section>

            {/* Two column grid */}
            <div className="mb-8 grid gap-8 lg:grid-cols-2">
              {/* Contributor Breakdown */}
              <section>
                <ContributorBreakdown
                  contributors={contributors}
                  commits={commits}
                  totalCommits={totalStats.totalCommits}
                />
              </section>

              {/* File Change Treemap */}
              <section>
                <FileChangeTreemap
                  commits={commits}
                />
              </section>
            </div>

            {/* Code Frequency Chart - Full width */}
            <section className="mb-8">
              <CodeFrequencyChart
                commits={commits}
              />
            </section>

            {/* AI Summary */}
            <section className="mb-8">
              <AIRepoSummary
                repository={repository}
                dateRange={dateRange || { start: repository.createdAt, end: repository.updatedAt, totalDays: 0 }}
                commitCount={totalStats.totalCommits}
                topContributors={contributors.map(c => c.name)}
              />
            </section>
          </>
        ) : (
          <Card className="mb-8 border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <GitCommitHorizontal className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">No Commit Data Available</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Commit data for this repository hasn&apos;t been fetched yet. 
                  Go to the Connect page and select this repository for analysis.
                </p>
              </div>
              <Button onClick={() => router.push('/connect')}>
                Connect & Analyze
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <section className="mb-12">
          <QuickLinks
            repository={repository}
          />
        </section>
      </div>
    </div>
  )
}

// Mini stat card component
function StatMiniCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-colors hover:bg-card/80">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-lg font-bold tracking-tight sm:text-xl">{value}</span>
      </CardContent>
    </Card>
  )
}
