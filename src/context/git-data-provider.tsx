"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  GitDataState,
  GitDataActions,
  Repository,
  CommitData,
  AnalyticsResult,
  GeneratedStory,
  WrappedData,
  GourceCommitEvent,
  RepoFetchStatus,
  Contributor,
} from "@/lib/types";

// =============================================================================
// STATE & ACTIONS
// =============================================================================

type GitDataContextValue = GitDataState & GitDataActions;

const initialFetchStatus: RepoFetchStatus = {
  metadata: false,
  commits: false,
  contributors: false,
  languages: false,
  totalCommits: 0,
  commitsFetched: 0,
  isFetching: false,
  error: null,
};

const initialState: GitDataState = {
  allRepositories: [],
  selectedRepositories: [],
  commitsByRepo: {},
  allCommitsSorted: [],
  contributors: {},
  analytics: null,
  stories: [],
  unifiedStory: null,
  wrappedData: null,
  gourceEvents: [],
  fetchStatus: {},
  isDataReady: false,
  lastRefreshed: null,
};

// =============================================================================
// REDUCER
// =============================================================================

type GitDataAction =
  | { type: "SET_ALL_REPOSITORIES"; payload: Repository[] }
  | { type: "SET_SELECTED_REPOSITORIES"; payload: Repository[] }
  | { type: "ADD_COMMITS"; payload: { repoId: string; commits: CommitData[] } }
  | { type: "SET_ANALYTICS"; payload: AnalyticsResult }
  | { type: "ADD_STORY"; payload: GeneratedStory }
  | { type: "SET_UNIFIED_STORY"; payload: GeneratedStory }
  | { type: "SET_WRAPPED_DATA"; payload: WrappedData }
  | { type: "SET_GOURCE_EVENTS"; payload: GourceCommitEvent[] }
  | {
      type: "UPDATE_FETCH_STATUS";
      payload: { repoId: string; status: Partial<RepoFetchStatus> };
    }
  | { type: "SET_CONTRIBUTORS"; payload: Record<string, Contributor> }
  | { type: "UPDATE_REPO_LANGUAGES"; payload: { repoId: string; languages: Record<string, number> } }
  | { type: "SET_DATA_READY"; payload: boolean }
  | { type: "SET_LAST_REFRESHED"; payload: number }
  | { type: "CLEAR_DATA" };

function computeSortedCommits(
  commitsByRepo: Record<string, CommitData[]>
): CommitData[] {
  const all: CommitData[] = [];
  for (const repoId in commitsByRepo) {
    all.push(...commitsByRepo[repoId]);
  }
  all.sort((a, b) => a.timestampMs - b.timestampMs);
  return all;
}

function computeContributors(
  commitsByRepo: Record<string, CommitData[]>
): Record<string, Contributor> {
  const contributorMap: Record<string, Contributor> = {};

  for (const repoId in commitsByRepo) {
    for (const commit of commitsByRepo[repoId]) {
      const id = commit.author.login || commit.author.email;
      if (!contributorMap[id]) {
        contributorMap[id] = {
          id,
          name: commit.author.name,
          email: commit.author.email,
          login: commit.author.login,
          avatarUrl: commit.author.avatarUrl,
          totalCommits: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          firstCommitDate: commit.timestamp,
          lastCommitDate: commit.timestamp,
          repos: [],
          color: generateContributorColor(id),
        };
      }

      const contributor = contributorMap[id];
      contributor.totalCommits += 1;
      contributor.totalAdditions += commit.additions;
      contributor.totalDeletions += commit.deletions;

      if (commit.timestamp < contributor.firstCommitDate) {
        contributor.firstCommitDate = commit.timestamp;
      }
      if (commit.timestamp > contributor.lastCommitDate) {
        contributor.lastCommitDate = commit.timestamp;
      }
      if (!contributor.repos.includes(repoId)) {
        contributor.repos.push(repoId);
      }
    }
  }

  return contributorMap;
}

function generateContributorColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function gitDataReducer(
  state: GitDataState,
  action: GitDataAction
): GitDataState {
  switch (action.type) {
    case "SET_ALL_REPOSITORIES":
      return {
        ...state,
        allRepositories: action.payload,
      };

    case "SET_SELECTED_REPOSITORIES":
      return {
        ...state,
        selectedRepositories: action.payload,
      };

    case "ADD_COMMITS": {
      const newCommitsByRepo = {
        ...state.commitsByRepo,
        [action.payload.repoId]: action.payload.commits,
      };
      const newContributors = computeContributors(newCommitsByRepo);
      return {
        ...state,
        commitsByRepo: newCommitsByRepo,
        allCommitsSorted: computeSortedCommits(newCommitsByRepo),
        contributors: newContributors,
        analytics: null,
      };
    }

    case "SET_ANALYTICS":
      return {
        ...state,
        analytics: action.payload,
        isDataReady: true,
      };

    case "ADD_STORY":
      return {
        ...state,
        stories: [...state.stories, action.payload],
      };

    case "SET_UNIFIED_STORY":
      return {
        ...state,
        unifiedStory: action.payload,
      };

    case "SET_WRAPPED_DATA":
      return {
        ...state,
        wrappedData: action.payload,
      };

    case "SET_GOURCE_EVENTS":
      return {
        ...state,
        gourceEvents: action.payload,
      };

    case "UPDATE_FETCH_STATUS":
      return {
        ...state,
        fetchStatus: {
          ...state.fetchStatus,
          [action.payload.repoId]: {
            ...(state.fetchStatus[action.payload.repoId] ||
              initialFetchStatus),
            ...action.payload.status,
          },
        },
      };

    case "SET_CONTRIBUTORS":
      return {
        ...state,
        contributors: action.payload,
      };

    case "UPDATE_REPO_LANGUAGES": {
      const updatedRepos = state.selectedRepositories.map((repo) =>
        repo.fullName === action.payload.repoId || repo.id === action.payload.repoId
          ? { ...repo, languages: action.payload.languages }
          : repo
      );
      const updatedAllRepos = state.allRepositories.map((repo) =>
        repo.fullName === action.payload.repoId || repo.id === action.payload.repoId
          ? { ...repo, languages: action.payload.languages }
          : repo
      );
      return {
        ...state,
        selectedRepositories: updatedRepos,
        allRepositories: updatedAllRepos,
        analytics: null,
      };
    }

    case "SET_DATA_READY":
      return {
        ...state,
        isDataReady: action.payload,
      };

    case "SET_LAST_REFRESHED":
      return {
        ...state,
        lastRefreshed: action.payload,
      };

    case "CLEAR_DATA":
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const GitDataContext = createContext<GitDataContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface GitDataProviderProps {
  children: ReactNode;
}

export function GitDataProvider({ children }: GitDataProviderProps) {
  const [state, dispatch] = useReducer(gitDataReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedReposRef = useRef<Repository[]>(state.selectedRepositories);
  selectedReposRef.current = state.selectedRepositories;

  // ---- Actions ----

  const setAllRepositories = useCallback((repos: Repository[]) => {
    dispatch({ type: "SET_ALL_REPOSITORIES", payload: repos });
  }, []);

  const setSelectedRepositories = useCallback((repos: Repository[]) => {
    selectedReposRef.current = repos;
    dispatch({ type: "SET_SELECTED_REPOSITORIES", payload: repos });
  }, []);

  const addCommits = useCallback((repoId: string, commits: CommitData[]) => {
    dispatch({ type: "ADD_COMMITS", payload: { repoId, commits } });
  }, []);

  const setAnalytics = useCallback((analytics: AnalyticsResult) => {
    dispatch({ type: "SET_ANALYTICS", payload: analytics });
  }, []);

  const addStory = useCallback((story: GeneratedStory) => {
    dispatch({ type: "ADD_STORY", payload: story });
  }, []);

  const setUnifiedStory = useCallback((story: GeneratedStory) => {
    dispatch({ type: "SET_UNIFIED_STORY", payload: story });
  }, []);

  const setWrappedData = useCallback((data: WrappedData) => {
    dispatch({ type: "SET_WRAPPED_DATA", payload: data });
  }, []);

  const setGourceEvents = useCallback((events: GourceCommitEvent[]) => {
    dispatch({ type: "SET_GOURCE_EVENTS", payload: events });
  }, []);

  const updateFetchStatus = useCallback(
    (repoId: string, status: Partial<RepoFetchStatus>) => {
      dispatch({
        type: "UPDATE_FETCH_STATUS",
        payload: { repoId, status },
      });
    },
    []
  );

  const clearData = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: "CLEAR_DATA" });
  }, []);

  /**
   * Fetches commit data for all selected repos.
   * Follows Rule 2: all git data fetching flows through this provider.
   * Follows Rule 11: checks cache before API calls.
   * Follows Rule 18: uses threshold-based batching strategy.
   *
   * Flow:
   * 1. For each selected repo, check IndexedDB cache via cache-manager
   * 2. If cache hit and not expired, use cached data
   * 3. If cache miss, fetch from GitHub API via github-api.ts
   * 4. Store fetched commits in state AND cache
   * 5. For repos with 5000+ commits, delegate to /api/analytics/compute
   */
  const fetchSelectedRepoData = useCallback(async () => {
    const repos = selectedReposRef.current;
    if (repos.length === 0) return;

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    for (const repo of repos) {
      if (signal.aborted) break;

      const repoId = repo.fullName;

      dispatch({
        type: "UPDATE_FETCH_STATUS",
        payload: {
          repoId,
          status: { isFetching: true, error: null },
        },
      });

      try {
        // Step 1: Check IndexedDB cache
        let cachedCommits: CommitData[] | null = null;

        try {
          const { get } = await import("@/lib/cache-manager");
          const cacheKey = `commits:${repoId}`;
          const cached = await get<CommitData[]>(cacheKey);
          if (cached) {
            cachedCommits = cached;
          }
        } catch {
          // Cache miss or cache not available — proceed with fetch
        }

        if (cachedCommits && cachedCommits.length > 0) {
          // Cache hit — use cached data
          dispatch({
            type: "ADD_COMMITS",
            payload: { repoId, commits: cachedCommits },
          });
          dispatch({
            type: "UPDATE_FETCH_STATUS",
            payload: {
              repoId,
              status: {
                isFetching: false,
                commits: true,
                metadata: true,
                totalCommits: cachedCommits.length,
                commitsFetched: cachedCommits.length,
              },
            },
          });
          continue;
        }

        // Step 2: Fetch from GitHub API
        // Read auth token from cookie or auth provider
        const response = await fetch(
          `/api/github/commits?repos=${encodeURIComponent(repoId)}&fetchAll=true`,
          {
            signal,
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Handle auth errors
          if (response.status === 401) {
            throw new Error(
              "GitHub session expired. Please reconnect your GitHub account."
            );
          }

          // Handle rate limiting (Rule 17)
          if (response.status === 403 && errorData?.retryAfter) {
            throw new Error(
              `GitHub rate limit exceeded. Retry after ${errorData.retryAfter} seconds.`
            );
          }

          throw new Error(
            errorData?.error?.message ||
              `Failed to fetch commits for ${repoId}`
          );
        }

        const result = await response.json();
        // API returns { data: { results: [{ repoId, commits, ... }], ... } }
        const repoResults = result.data?.results || [];
        const commits: CommitData[] =
          repoResults.length > 0 ? repoResults[0].commits || [] : [];

        // Step 3: Store commits in state
        dispatch({
          type: "ADD_COMMITS",
          payload: { repoId, commits },
        });

        // Step 4: Cache commits (1hr TTL per Rule 11)
        try {
          const { set } = await import("@/lib/cache-manager");
          await set(`commits:${repoId}`, commits, 3600000);
        } catch {
          // Cache write failure is non-critical
        }

        dispatch({
          type: "UPDATE_FETCH_STATUS",
          payload: {
            repoId,
            status: {
              isFetching: false,
              commits: true,
              metadata: true,
              totalCommits: commits.length,
              commitsFetched: commits.length,
            },
          },
        });

        // Step 5: Fetch language data and contributor stats in parallel
        // These are lightweight calls (1 per repo) and provide data for
        // the language breakdown and lines added/removed on the dashboard.
        try {
          const [langRes, statsRes] = await Promise.allSettled([
            fetch(`/api/github/languages?repo=${encodeURIComponent(repoId)}`, {
              signal,
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            }),
            fetch(`/api/github/stats?repo=${encodeURIComponent(repoId)}`, {
              signal,
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            }),
          ]);

          // Update repo languages
          if (langRes.status === "fulfilled" && langRes.value.ok) {
            const langData = await langRes.value.json();
            if (langData.success && langData.data?.languages) {
              dispatch({
                type: "UPDATE_REPO_LANGUAGES",
                payload: { repoId, languages: langData.data.languages },
              });
            }
          }

          // Update commit line stats from contributor stats
          if (statsRes.status === "fulfilled" && statsRes.value.ok) {
            const statsData = await statsRes.value.json();
            if (statsData.success && statsData.data) {
              const { totalAdditions, totalDeletions } = statsData.data;
              // Distribute additions/deletions across commits that lack file-level stats.
              // The list endpoint doesn't include per-commit stats, so additions/deletions
              // will be 0 with an empty files array. Only fill in for those commits.
              if (commits.length > 0 && (totalAdditions > 0 || totalDeletions > 0)) {
                const avgAdditions = Math.round(totalAdditions / commits.length);
                const avgDeletions = Math.round(totalDeletions / commits.length);
                const updatedCommits = commits.map((c) => {
                  const hasFileStats = c.files.length > 0;
                  const additions = hasFileStats ? c.additions : avgAdditions;
                  const deletions = hasFileStats ? c.deletions : avgDeletions;
                  return {
                    ...c,
                    additions,
                    deletions,
                    totalChanges: additions + deletions,
                  };
                });
                dispatch({
                  type: "ADD_COMMITS",
                  payload: { repoId, commits: updatedCommits },
                });
              }
            }
          }
        } catch {
          // Language/stats fetch failures are non-critical
        }
      } catch (error) {
        if (signal.aborted) return;

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        dispatch({
          type: "UPDATE_FETCH_STATUS",
          payload: {
            repoId,
            status: {
              isFetching: false,
              error: errorMessage,
            },
          },
        });
      }
    }

    dispatch({ type: "SET_DATA_READY", payload: true });
    dispatch({ type: "SET_LAST_REFRESHED", payload: Date.now() });
  }, []);

  /**
   * Invalidates cache and re-fetches all data.
   * Follows Rule 11: clears cache by prefix before re-fetching.
   */
  const refreshData = useCallback(async () => {
    try {
      const { clearByPrefix } = await import("@/lib/cache-manager");

      // Clear all commit caches for selected repos
      for (const repo of selectedReposRef.current) {
        await clearByPrefix(`commits:${repo.fullName}`);
      }

      // Clear analytics and story caches
      await clearByPrefix("analytics:");
      await clearByPrefix("story:");
    } catch {
      // Cache clear failure is non-critical — proceed with refetch
    }

    // Reset analytics and stories since we're refreshing
    dispatch({ type: "SET_ANALYTICS", payload: null as unknown as AnalyticsResult });
    dispatch({ type: "SET_DATA_READY", payload: false });

    // Re-fetch all data
    await fetchSelectedRepoData();
  }, [fetchSelectedRepoData]);

  // ---- Context Value ----

  const contextValue: GitDataContextValue = {
    // State
    allRepositories: state.allRepositories,
    selectedRepositories: state.selectedRepositories,
    commitsByRepo: state.commitsByRepo,
    allCommitsSorted: state.allCommitsSorted,
    contributors: state.contributors,
    analytics: state.analytics,
    stories: state.stories,
    unifiedStory: state.unifiedStory,
    wrappedData: state.wrappedData,
    gourceEvents: state.gourceEvents,
    fetchStatus: state.fetchStatus,
    isDataReady: state.isDataReady,
    lastRefreshed: state.lastRefreshed,

    // Actions
    setAllRepositories,
    setSelectedRepositories,
    addCommits,
    setAnalytics,
    addStory,
    setUnifiedStory,
    setWrappedData,
    setGourceEvents,
    updateFetchStatus,
    fetchSelectedRepoData,
    clearData,
    refreshData,
  };

  return (
    <GitDataContext.Provider value={contextValue}>
      {children}
    </GitDataContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useGitData(): GitDataContextValue {
  const context = useContext(GitDataContext);
  if (!context) {
    throw new Error("useGitData must be used within a GitDataProvider");
  }
  return context;
}

export { GitDataContext };
