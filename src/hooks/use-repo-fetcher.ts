'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useGitData } from '@/context/git-data-provider';
import { useAuth } from '@/context/auth-provider';
import type {
  SelectableRepository,
  RepoFilter,
  RepoSortOption,
  Repository,
  UseRepoFetcherReturn,
} from '@/lib/types';
import { RepoSortOption as RepoSort } from '@/lib/types';

const REPOS_PER_PAGE = 30;

function matchesSearch(repo: Repository, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    repo.name.toLowerCase().includes(q) ||
    repo.fullName.toLowerCase().includes(q) ||
    (repo.description?.toLowerCase().includes(q) ?? false) ||
    repo.topics.some((t) => t.toLowerCase().includes(q))
  );
}

function matchesFilter(repo: Repository, filter: RepoFilter): boolean {
  // Language filter
  if (filter.language && repo.language !== filter.language) return false;

  // Visibility filter
  if (filter.visibility === 'public' && repo.isPrivate) return false;
  if (filter.visibility === 'private' && !repo.isPrivate) return false;

  // Fork filter
  if (!filter.includeForks && repo.isFork) return false;

  // Archived filter
  if (!filter.includeArchived && repo.isArchived) return false;

  // Owner type filter
  if (filter.ownerType === 'user' && repo.owner.isOrg) return false;
  if (filter.ownerType === 'org' && !repo.owner.isOrg) return false;

  // Search query
  if (!matchesSearch(repo, filter.searchQuery)) return false;

  return true;
}

function sortRepos(repos: SelectableRepository[], sortBy: RepoSortOption): SelectableRepository[] {
  const sorted = [...repos];
  switch (sortBy) {
    case RepoSort.NAME_ASC:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case RepoSort.NAME_DESC:
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case RepoSort.STARS_DESC:
      sorted.sort((a, b) => b.starCount - a.starCount);
      break;
    case RepoSort.UPDATED_DESC:
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case RepoSort.COMMITS_DESC:
      sorted.sort((a, b) => (b.commitCount ?? 0) - (a.commitCount ?? 0));
      break;
    default:
      break;
  }
  return sorted;
}

const DEFAULT_FILTER: RepoFilter = {
  searchQuery: '',
  language: null,
  visibility: 'all',
  includeForks: false,
  includeArchived: false,
  sortBy: RepoSort.UPDATED_DESC,
  ownerType: 'all',
};

export function useRepoFetcher(): UseRepoFetcherReturn {
  const gitData = useGitData();
  const auth = useAuth();

  const [currentFilter, setCurrentFilter] = useState<RepoFilter>(DEFAULT_FILTER);
  const [visibleCount, setVisibleCount] = useState(REPOS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Fetch repos on mount if we have a token but no repos loaded
  useEffect(() => {
    if (
      auth.isGitHubConnected &&
      auth.githubToken &&
      gitData.allRepositories.length === 0 &&
      !hasFetchedRef.current &&
      !isLoading
    ) {
      hasFetchedRef.current = true;
      setIsLoading(true);
      setError(null);

      // Use GitDataProvider to fetch repos - it handles caching internally
      const fetchRepos = async () => {
        try {
          const allRepos: Repository[] = [];
          let page = 1;
          let hasMorePages = true;

          while (hasMorePages && page <= 10) {
            const response = await fetch(
              `/api/github/repos?per_page=100&affiliation=owner,collaborator,organization_member&page=${page}`,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              if (response.status === 401) {
                throw new Error(
                  'Your GitHub session has expired. Please reconnect your GitHub account.'
                );
              }
              if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
                throw new Error(
                  `GitHub API rate limit exceeded. Please try again in ${seconds} seconds.`
                );
              }
              throw new Error(
                errorData?.error?.message || `Failed to fetch repositories (${response.status})`
              );
            }

            const result = await response.json();
            const repos: Repository[] = result.data || [];
            allRepos.push(...repos);

            hasMorePages = result.pagination?.hasMore ?? false;
            page++;
          }

          gitData.setAllRepositories(allRepos);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch repositories';
          setError(message);
          hasFetchedRef.current = false; // Allow retry
        } finally {
          setIsLoading(false);
        }
      };

      fetchRepos();
    }
  }, [auth.isGitHubConnected, auth.githubToken, gitData.allRepositories.length, gitData.setAllRepositories, isLoading]);

  // Convert Repository[] to SelectableRepository[] with selection state
  const allSelectableRepos: SelectableRepository[] = useMemo(() => {
    return gitData.allRepositories.map((repo) => ({
      ...repo,
      isSelected: false,
      fetchStatus: 'unfetched' as const,
    }));
  }, [gitData.allRepositories]);

  // Apply filters and search
  const filteredRepos: SelectableRepository[] = useMemo(() => {
    const filtered = allSelectableRepos.filter((repo) => matchesFilter(repo, currentFilter));
    return sortRepos(filtered, currentFilter.sortBy);
  }, [allSelectableRepos, currentFilter]);

  // Paginated repos
  const paginatedRepos = useMemo(() => {
    return filteredRepos.slice(0, visibleCount);
  }, [filteredRepos, visibleCount]);

  const hasMore = visibleCount < filteredRepos.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + REPOS_PER_PAGE, filteredRepos.length));
  }, [filteredRepos.length]);

  const search = useCallback((query: string) => {
    setCurrentFilter((prev) => ({ ...prev, searchQuery: query }));
    setVisibleCount(REPOS_PER_PAGE); // Reset pagination on search
  }, []);

  const filter = useCallback((partial: Partial<RepoFilter>) => {
    setCurrentFilter((prev) => ({ ...prev, ...partial }));
    setVisibleCount(REPOS_PER_PAGE); // Reset pagination on filter change
  }, []);

  return {
    repos: paginatedRepos,
    isLoading,
    hasMore,
    loadMore,
    search,
    filter,
    currentFilter,
    totalCount: filteredRepos.length,
    error,
  };
}
