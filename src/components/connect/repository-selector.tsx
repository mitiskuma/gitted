'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Star,
  GitCommitHorizontal,
  Clock,
  Building2,
  User,
  Filter,
  ArrowUpDown,
  Lock,
  GitFork,
  Archive,
  ChevronDown,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  FolderGit2,
  X,
} from 'lucide-react';
import type {
  RepositorySelectorProps,
  SelectableRepository,
  RepoFilter,
  RepoSortOption,
} from '@/lib/types';
import { RepoSortOption as RepoSort, GITHUB_LANGUAGE_COLORS } from '@/lib/types';

function getLanguageColor(language: string | null): string {
  if (!language) return '#94a3b8';
  return GITHUB_LANGUAGE_COLORS[language] || '#94a3b8';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function estimateCommits(repo: SelectableRepository): number {
  if (repo.commitCount !== null) return repo.commitCount;
  // Rough estimate based on repo size and age
  const ageInDays = Math.max(
    1,
    Math.floor(
      (new Date().getTime() - new Date(repo.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const sizeEstimate = Math.max(1, Math.floor(repo.size / 50));
  return Math.min(sizeEstimate, Math.floor(ageInDays * 0.5));
}

function truncateDescription(desc: string | null, maxLen: number = 100): string {
  if (!desc) return 'No description provided';
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen).trimEnd() + '…';
}

export function RepositorySelector({
  repositories,
  onSelectionChange,
  isLoading,
  hasMore,
  onLoadMore,
  filter,
  onFilterChange,
}: RepositorySelectorProps) {
  // Derive selection state from repositories
  const selectedIds = useMemo(
    () => repositories.filter((r) => r.isSelected).map((r) => r.id),
    [repositories]
  );

  const onToggleRepo = useCallback(
    (repoId: string) => {
      const current = new Set(selectedIds);
      if (current.has(repoId)) {
        current.delete(repoId);
      } else {
        current.add(repoId);
      }
      onSelectionChange(Array.from(current));
    },
    [selectedIds, onSelectionChange]
  );

  const onSelectAll = useCallback(() => {
    onSelectionChange(repositories.map((r) => r.id));
  }, [repositories, onSelectionChange]);

  const onDeselectAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);
  const [showFilters, setShowFilters] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Extract unique languages from repositories
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    repositories.forEach((repo) => {
      if (repo.language) langs.add(repo.language);
    });
    return Array.from(langs).sort();
  }, [repositories]);

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const groups: Record<string, { isOrg: boolean; avatarUrl: string; repos: SelectableRepository[] }> = {};

    repositories.forEach((repo) => {
      const ownerLogin = repo.owner.login;
      if (!groups[ownerLogin]) {
        groups[ownerLogin] = {
          isOrg: repo.owner.isOrg,
          avatarUrl: repo.owner.avatarUrl,
          repos: [],
        };
      }
      groups[ownerLogin].repos.push(repo);
    });

    // Sort: personal repos first, then orgs alphabetically
    const sorted = Object.entries(groups).sort(([, a], [, b]) => {
      if (!a.isOrg && b.isOrg) return -1;
      if (a.isOrg && !b.isOrg) return 1;
      return 0;
    });

    return sorted;
  }, [repositories]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filter, searchQuery: e.target.value });
    },
    [filter, onFilterChange]
  );

  const clearSearch = useCallback(() => {
    onFilterChange({ ...filter, searchQuery: '' });
    searchInputRef.current?.focus();
  }, [filter, onFilterChange]);

  const handleSortChange = useCallback(
    (value: string) => {
      onFilterChange({ ...filter, sortBy: value as RepoSortOption });
    },
    [filter, onFilterChange]
  );

  const handleLanguageChange = useCallback(
    (value: string) => {
      onFilterChange({ ...filter, language: value === 'all' ? null : value });
    },
    [filter, onFilterChange]
  );

  const handleVisibilityChange = useCallback(
    (value: string) => {
      onFilterChange({ ...filter, visibility: value as 'all' | 'public' | 'private' });
    },
    [filter, onFilterChange]
  );

  const handleOwnerTypeChange = useCallback(
    (value: string) => {
      onFilterChange({ ...filter, ownerType: value as 'all' | 'user' | 'org' });
    },
    [filter, onFilterChange]
  );

  const toggleForks = useCallback(() => {
    onFilterChange({ ...filter, includeForks: !filter.includeForks });
  }, [filter, onFilterChange]);

  const toggleArchived = useCallback(() => {
    onFilterChange({ ...filter, includeArchived: !filter.includeArchived });
  }, [filter, onFilterChange]);

  const allVisibleSelected = repositories.length > 0 && repositories.every((r) => selectedIds.includes(r.id));
  const someSelected = selectedIds.length > 0;
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.language) count++;
    if (filter.visibility !== 'all') count++;
    if (filter.ownerType !== 'all') count++;
    if (filter.includeForks) count++;
    if (filter.includeArchived) count++;
    return count;
  }, [filter]);

  return (
    <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-purple-400" />
            Select Repositories
          </CardTitle>
          {repositories.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-zinc-800 text-zinc-300 border-zinc-700 font-mono text-xs"
            >
              {selectedIds.length} / {repositories.length} selected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search repositories by name, description, or topic..."
            value={filter.searchQuery}
            onChange={handleSearchChange}
            className="pl-10 pr-10 bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500/20"
          />
          {filter.searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-zinc-200 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value={RepoSort.UPDATED_DESC}>Last Updated</SelectItem>
              <SelectItem value={RepoSort.NAME_ASC}>Name (A-Z)</SelectItem>
              <SelectItem value={RepoSort.NAME_DESC}>Name (Z-A)</SelectItem>
              <SelectItem value={RepoSort.STARS_DESC}>Most Stars</SelectItem>
              <SelectItem value={RepoSort.COMMITS_DESC}>Most Commits</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.language || 'all'}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-[160px] bg-zinc-800 border-zinc-700 text-zinc-200 text-sm">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[300px]">
              <SelectItem value="all">All Languages</SelectItem>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getLanguageColor(lang) }}
                    />
                    {lang}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors ${
              activeFilterCount > 0 ? 'border-purple-500/50' : ''
            }`}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-1.5 bg-purple-500/20 text-purple-300 border-purple-500/30 px-1.5 py-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={allVisibleSelected ? onDeselectAll : onSelectAll}
              className="text-zinc-400 hover:text-white text-xs"
            >
              {allVisibleSelected ? (
                <>
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  Select All
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Visibility</label>
                  <Select value={filter.visibility} onValueChange={handleVisibilityChange}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-600 text-zinc-200 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all">All Repos</SelectItem>
                      <SelectItem value="public">Public Only</SelectItem>
                      <SelectItem value="private">Private Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Owner Type</label>
                  <Select value={filter.ownerType} onValueChange={handleOwnerTypeChange}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-600 text-zinc-200 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all">All Owners</SelectItem>
                      <SelectItem value="user">Personal</SelectItem>
                      <SelectItem value="org">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="text-xs font-medium text-zinc-400">Include</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                      <Checkbox
                        checked={filter.includeForks}
                        onCheckedChange={toggleForks}
                        className="border-zinc-600 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                      <GitFork className="h-3.5 w-3.5 text-zinc-500" />
                      Forks
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                      <Checkbox
                        checked={filter.includeArchived}
                        onCheckedChange={toggleArchived}
                        className="border-zinc-600 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                      <Archive className="h-3.5 w-3.5 text-zinc-500" />
                      Archived
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && repositories.length === 0 && (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40">
                <Skeleton className="h-5 w-5 rounded bg-zinc-700" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 bg-zinc-700" />
                  <Skeleton className="h-3 w-72 bg-zinc-700/60" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full bg-zinc-700" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && repositories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Search className="h-7 w-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-sm font-medium mb-1">No repositories found</p>
            <p className="text-zinc-500 text-xs max-w-sm">
              {filter.searchQuery
                ? `No repos match "${filter.searchQuery}". Try a different search term or adjust your filters.`
                : 'Connect your GitHub account to see your repositories here.'}
            </p>
          </div>
        )}

        {/* Repository List — Grouped by Owner */}
        {!isLoading && repositories.length > 0 && (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {groupedRepos.map(([ownerLogin, group]) => (
              <div key={ownerLogin}>
                {/* Owner Group Header */}
                {groupedRepos.length > 1 && (
                  <div className="flex items-center gap-2 py-2 px-1 sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10 border-b border-zinc-800/50 mb-1">
                    <img
                      src={group.avatarUrl}
                      alt={ownerLogin}
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      {ownerLogin}
                    </span>
                    {group.isOrg ? (
                      <Building2 className="h-3 w-3 text-zinc-500" />
                    ) : (
                      <User className="h-3 w-3 text-zinc-500" />
                    )}
                    <Badge
                      variant="outline"
                      className="ml-auto border-zinc-700 text-zinc-500 text-[10px] px-1.5 py-0"
                    >
                      {group.repos.length} repos
                    </Badge>
                  </div>
                )}

                {/* Repo Rows */}
                <div className="space-y-1">
                  {group.repos.map((repo, index) => {
                    const isSelected = selectedIds.includes(repo.id);
                    const commitEstimate = estimateCommits(repo);

                    return (
                      <motion.div
                        key={repo.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.3) }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onToggleRepo(repo.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleRepo(repo.id); } }}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15'
                              : 'bg-zinc-800/30 border border-transparent hover:bg-zinc-800/60 hover:border-zinc-700/50'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isSelected}
                              className={`border-zinc-600 transition-colors ${
                                isSelected
                                  ? 'data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500'
                                  : ''
                              }`}
                              tabIndex={-1}
                            />
                          </div>

                          {/* Repo Info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-white truncate">
                                {repo.name}
                              </span>
                              {repo.isPrivate && (
                                <Badge
                                  variant="outline"
                                  className="border-yellow-500/30 text-yellow-400 text-[10px] px-1.5 py-0 flex-shrink-0"
                                >
                                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                                  Private
                                </Badge>
                              )}
                              {repo.isFork && (
                                <Badge
                                  variant="outline"
                                  className="border-zinc-600 text-zinc-500 text-[10px] px-1.5 py-0 flex-shrink-0"
                                >
                                  <GitFork className="h-2.5 w-2.5 mr-0.5" />
                                  Fork
                                </Badge>
                              )}
                              {repo.isArchived && (
                                <Badge
                                  variant="outline"
                                  className="border-orange-500/30 text-orange-400 text-[10px] px-1.5 py-0 flex-shrink-0"
                                >
                                  <Archive className="h-2.5 w-2.5 mr-0.5" />
                                  Archived
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-zinc-500 line-clamp-1">
                              {truncateDescription(repo.description)}
                            </p>

                            {/* Metadata Row */}
                            <div className="flex items-center gap-3 flex-wrap">
                              {repo.language && (
                                <span className="flex items-center gap-1 text-xs text-zinc-400">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getLanguageColor(repo.language) }}
                                  />
                                  {repo.language}
                                </span>
                              )}

                              {repo.starCount > 0 && (
                                <span className="flex items-center gap-1 text-xs text-zinc-400">
                                  <Star className="h-3 w-3 text-yellow-500" />
                                  {repo.starCount.toLocaleString()}
                                </span>
                              )}

                              <span className="flex items-center gap-1 text-xs text-zinc-500">
                                <GitCommitHorizontal className="h-3 w-3" />
                                ~{commitEstimate.toLocaleString()} commits
                              </span>

                              <span className="flex items-center gap-1 text-xs text-zinc-600">
                                <Clock className="h-3 w-3" />
                                {formatDate(repo.pushedAt || repo.updatedAt)}
                              </span>
                            </div>

                            {/* Topics */}
                            {repo.topics.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {repo.topics.slice(0, 4).map((topic) => (
                                  <Badge
                                    key={topic}
                                    variant="secondary"
                                    className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0"
                                  >
                                    {topic}
                                  </Badge>
                                ))}
                                {repo.topics.length > 4 && (
                                  <span className="text-[10px] text-zinc-600">
                                    +{repo.topics.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Selection Indicator */}
                          <div className="flex-shrink-0 pt-1">
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              >
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">
                                  Selected
                                </Badge>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load More / Infinite Scroll Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoading}
                  className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                      Load More Repositories
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* End of list */}
            {!hasMore && repositories.length > 0 && (
              <p className="text-center text-xs text-zinc-600 py-3">
                Showing all {repositories.length} repositories
              </p>
            )}
          </div>
        )}

        {/* Loading more indicator */}
        {isLoading && repositories.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
            <span className="text-xs text-zinc-500">Loading more repositories...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
