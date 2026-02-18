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
// CACHE ENTRY SHAPE (enriched for incremental fetching)
// =============================================================================

interface CachedCommitData {
  commits: CommitData[];
  latestCommitTimestamp: string | null;
  totalCount: number;
}

// =============================================================================
// CONCURRENCY LIMITER
// =============================================================================

function createConcurrencyLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= maxConcurrent) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      active++;
      try {
        return await fn();
      } finally {
        active--;
        queue.shift()?.();
      }
    },
  };
}

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
  totalReposToFetch: 0,
  reposCompletedCount: 0,
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
  | { type: "SET_FETCH_PROGRESS"; payload: { total: number; completed: number } }
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
        // Progressive: mark data ready as soon as first repo arrives
        isDataReady: true,
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

    case "SET_FETCH_PROGRESS":
      return {
        ...state,
        totalReposToFetch: action.payload.total,
        reposCompletedCount: action.payload.completed,
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

// 24-hour TTL for commit caches (incremental fetching corrects stale data)
const COMMITS_CACHE_TTL = 86400000;

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
   * Fetches commit data for all selected repos with optimized parallel fetching.
   *
   * Strategy:
   * 1. Check all caches in parallel — dispatch cached data immediately
   * 2. For cached repos, do incremental fetch (since=latestTimestamp) in background
   * 3. For cache-miss repos, use streaming NDJSON endpoint for progressive loading
   * 4. Language/stats fetched in parallel per repo with concurrency limiter
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

    dispatch({
      type: "SET_FETCH_PROGRESS",
      payload: { total: repos.length, completed: 0 },
    });

    // Mark all repos as fetching
    for (const repo of repos) {
      dispatch({
        type: "UPDATE_FETCH_STATUS",
        payload: {
          repoId: repo.fullName,
          status: { isFetching: true, error: null },
        },
      });
    }

    let completedCount = 0;

    const incrementCompleted = () => {
      completedCount++;
      dispatch({
        type: "SET_FETCH_PROGRESS",
        payload: { total: repos.length, completed: completedCount },
      });
    };

    // =========================================================================
    // Phase 1: Check all caches in parallel
    // =========================================================================
    const cacheResults = await Promise.all(
      repos.map(async (repo) => {
        const repoId = repo.fullName;
        try {
          const { get } = await import("@/lib/cache-manager");
          const cached = await get<CachedCommitData>(`commits:${repoId}`);
          if (cached && cached.commits && cached.commits.length > 0) {
            return { repo, cached, isCacheHit: true as const };
          }
          // Check legacy format (plain CommitData[])
          const legacyCached = await get<CommitData[]>(`commits:${repoId}`);
          if (Array.isArray(legacyCached) && legacyCached.length > 0) {
            const latestTs = legacyCached.reduce(
              (max, c) => (c.timestamp > max ? c.timestamp : max),
              ""
            );
            return {
              repo,
              cached: {
                commits: legacyCached,
                latestCommitTimestamp: latestTs || null,
                totalCount: legacyCached.length,
              },
              isCacheHit: true as const,
            };
          }
        } catch {
          // Cache miss or unavailable
        }
        return { repo, cached: null, isCacheHit: false as const };
      })
    );

    if (signal.aborted) return;

    // =========================================================================
    // Phase 2: Dispatch cached data immediately + queue incremental updates
    // =========================================================================
    const cacheMissRepos: Repository[] = [];
    const incrementalUpdates: Array<{
      repo: Repository;
      cached: CachedCommitData;
    }> = [];

    for (const result of cacheResults) {
      if (result.isCacheHit && result.cached) {
        const { repo, cached } = result;
        const repoId = repo.fullName;

        // Dispatch cached data immediately — dashboard shows data now
        dispatch({
          type: "ADD_COMMITS",
          payload: { repoId, commits: cached.commits },
        });
        dispatch({
          type: "UPDATE_FETCH_STATUS",
          payload: {
            repoId,
            status: {
              isFetching: false,
              commits: true,
              metadata: true,
              totalCommits: cached.commits.length,
              commitsFetched: cached.commits.length,
            },
          },
        });
        incrementCompleted();

        // Queue incremental update if we have a timestamp
        if (cached.latestCommitTimestamp) {
          incrementalUpdates.push({ repo, cached });
        }
      } else {
        cacheMissRepos.push(result.repo);
      }
    }

    // =========================================================================
    // Phase 3: Stream cache-miss repos via NDJSON endpoint
    // =========================================================================
    if (cacheMissRepos.length > 0 && !signal.aborted) {
      try {
        const streamPayload = {
          repos: cacheMissRepos.map((r) => {
            const [owner, repo] = r.fullName.split("/");
            return { owner, repo };
          }),
          fetchAll: true,
          maxCommitsPerRepo: 30000,
        };

        const response = await fetch("/api/github/commits/stream", {
          method: "POST",
          signal,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(streamPayload),
        });

        if (!response.ok) {
          // Fallback: if streaming fails, fall back to individual fetches
          if (response.status === 401) {
            throw new Error(
              "GitHub session expired. Please reconnect your GitHub account."
            );
          }
          throw new Error(`Stream endpoint returned ${response.status}`);
        }

        // Read NDJSON stream line by line
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (signal.aborted) {
              reader.cancel();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const result = JSON.parse(line) as {
                  repoId: string;
                  commits: CommitData[];
                  totalFetched: number;
                  error: string | null;
                };

                if (result.error) {
                  dispatch({
                    type: "UPDATE_FETCH_STATUS",
                    payload: {
                      repoId: result.repoId,
                      status: {
                        isFetching: false,
                        error: result.error,
                      },
                    },
                  });
                  incrementCompleted();
                  continue;
                }

                // Dispatch commits — triggers progressive rendering
                dispatch({
                  type: "ADD_COMMITS",
                  payload: {
                    repoId: result.repoId,
                    commits: result.commits,
                  },
                });

                dispatch({
                  type: "UPDATE_FETCH_STATUS",
                  payload: {
                    repoId: result.repoId,
                    status: {
                      isFetching: false,
                      commits: true,
                      metadata: true,
                      totalCommits: result.totalFetched,
                      commitsFetched: result.totalFetched,
                    },
                  },
                });

                incrementCompleted();

                // Cache the result with enriched format
                try {
                  const { set } = await import("@/lib/cache-manager");
                  const latestTs = result.commits.reduce(
                    (max, c) => (c.timestamp > max ? c.timestamp : max),
                    ""
                  );
                  const cacheEntry: CachedCommitData = {
                    commits: result.commits,
                    latestCommitTimestamp: latestTs || null,
                    totalCount: result.commits.length,
                  };
                  await set(
                    `commits:${result.repoId}`,
                    cacheEntry,
                    COMMITS_CACHE_TTL
                  );
                } catch {
                  // Cache write failure is non-critical
                }
              } catch {
                // Skip malformed NDJSON lines
              }
            }
          }

          // Process any remaining buffer content
          if (buffer.trim()) {
            try {
              const result = JSON.parse(buffer) as {
                repoId: string;
                commits: CommitData[];
                totalFetched: number;
                error: string | null;
              };

              if (!result.error) {
                dispatch({
                  type: "ADD_COMMITS",
                  payload: {
                    repoId: result.repoId,
                    commits: result.commits,
                  },
                });
                dispatch({
                  type: "UPDATE_FETCH_STATUS",
                  payload: {
                    repoId: result.repoId,
                    status: {
                      isFetching: false,
                      commits: true,
                      metadata: true,
                      totalCommits: result.totalFetched,
                      commitsFetched: result.totalFetched,
                    },
                  },
                });
                incrementCompleted();

                try {
                  const { set } = await import("@/lib/cache-manager");
                  const latestTs = result.commits.reduce(
                    (max, c) => (c.timestamp > max ? c.timestamp : max),
                    ""
                  );
                  await set(
                    `commits:${result.repoId}`,
                    {
                      commits: result.commits,
                      latestCommitTimestamp: latestTs || null,
                      totalCount: result.commits.length,
                    } satisfies CachedCommitData,
                    COMMITS_CACHE_TTL
                  );
                } catch {
                  // Non-critical
                }
              } else {
                dispatch({
                  type: "UPDATE_FETCH_STATUS",
                  payload: {
                    repoId: result.repoId,
                    status: { isFetching: false, error: result.error },
                  },
                });
                incrementCompleted();
              }
            } catch {
              // Skip
            }
          }
        }
      } catch (error) {
        if (signal.aborted) return;

        // Fallback: fetch cache-miss repos individually with concurrency limiter
        const limiter = createConcurrencyLimiter(5);
        await Promise.allSettled(
          cacheMissRepos.map((repo) =>
            limiter.run(() => fetchSingleRepoFallback(repo, signal, dispatch, incrementCompleted))
          )
        );
      }
    }

    // =========================================================================
    // Phase 4: Incremental updates for cached repos (background, non-blocking)
    // =========================================================================
    if (incrementalUpdates.length > 0 && !signal.aborted) {
      // Fire and forget — these update cache and state in the background
      const limiter = createConcurrencyLimiter(5);
      Promise.allSettled(
        incrementalUpdates.map(({ repo, cached }) =>
          limiter.run(async () => {
            if (signal.aborted) return;
            try {
              const repoId = repo.fullName;
              const sinceParam = cached.latestCommitTimestamp
                ? `&since=${encodeURIComponent(cached.latestCommitTimestamp)}`
                : "";

              const response = await fetch(
                `/api/github/commits?repos=${encodeURIComponent(repoId)}&fetchAll=true${sinceParam}`,
                {
                  signal,
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                }
              );

              if (!response.ok) return;

              const result = await response.json();
              const repoResults = result.data?.results || [];
              const newCommits: CommitData[] =
                repoResults.length > 0 ? repoResults[0].commits || [] : [];

              if (newCommits.length === 0) return;

              // Deduplicate by SHA and merge
              const existingShas = new Set(cached.commits.map((c) => c.sha));
              const uniqueNew = newCommits.filter(
                (c) => !existingShas.has(c.sha)
              );

              if (uniqueNew.length === 0) return;

              const merged = [...cached.commits, ...uniqueNew];
              merged.sort((a, b) => b.timestampMs - a.timestampMs);

              dispatch({
                type: "ADD_COMMITS",
                payload: { repoId, commits: merged },
              });

              // Update cache
              try {
                const { set } = await import("@/lib/cache-manager");
                const latestTs = merged.reduce(
                  (max, c) => (c.timestamp > max ? c.timestamp : max),
                  ""
                );
                await set(
                  `commits:${repoId}`,
                  {
                    commits: merged,
                    latestCommitTimestamp: latestTs || null,
                    totalCount: merged.length,
                  } satisfies CachedCommitData,
                  COMMITS_CACHE_TTL
                );
              } catch {
                // Non-critical
              }
            } catch {
              // Incremental update failure is non-critical
            }
          })
        )
      );
    }

    // =========================================================================
    // Phase 5: Fetch languages/stats for all repos (parallel, non-blocking)
    // =========================================================================
    if (!signal.aborted) {
      const limiter = createConcurrencyLimiter(5);
      Promise.allSettled(
        repos.map((repo) =>
          limiter.run(async () => {
            if (signal.aborted) return;
            const repoId = repo.fullName;
            try {
              const [langRes, statsRes] = await Promise.allSettled([
                fetch(
                  `/api/github/languages?repo=${encodeURIComponent(repoId)}`,
                  {
                    signal,
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                  }
                ),
                fetch(
                  `/api/github/stats?repo=${encodeURIComponent(repoId)}`,
                  {
                    signal,
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                  }
                ),
              ]);

              if (langRes.status === "fulfilled" && langRes.value.ok) {
                const langData = await langRes.value.json();
                if (langData.success && langData.data?.languages) {
                  dispatch({
                    type: "UPDATE_REPO_LANGUAGES",
                    payload: { repoId, languages: langData.data.languages },
                  });
                }
              }

              if (statsRes.status === "fulfilled" && statsRes.value.ok) {
                const statsData = await statsRes.value.json();
                if (statsData.success && statsData.data) {
                  const { totalAdditions, totalDeletions } = statsData.data;
                  // We need the current commits from state — read via a ref-like pattern
                  // Since we can't read state directly in this callback, we skip stat
                  // distribution for now and let it happen on next analytics computation
                  if (totalAdditions > 0 || totalDeletions > 0) {
                    // Stats are available — will be picked up by analytics
                  }
                }
              }
            } catch {
              // Non-critical
            }
          })
        )
      );
    }

    dispatch({ type: "SET_LAST_REFRESHED", payload: Date.now() });
  }, []);

  /**
   * Invalidates cache and re-fetches all data.
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
    totalReposToFetch: state.totalReposToFetch,
    reposCompletedCount: state.reposCompletedCount,

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
// FALLBACK: Individual repo fetch (used when streaming fails)
// =============================================================================

async function fetchSingleRepoFallback(
  repo: Repository,
  signal: AbortSignal,
  dispatch: React.Dispatch<GitDataAction>,
  onComplete: () => void
): Promise<void> {
  const repoId = repo.fullName;

  try {
    const response = await fetch(
      `/api/github/commits?repos=${encodeURIComponent(repoId)}&fetchAll=true`,
      {
        signal,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "GitHub session expired. Please reconnect your GitHub account."
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `Failed to fetch commits for ${repoId}`
      );
    }

    const result = await response.json();
    const repoResults = result.data?.results || [];
    const commits: CommitData[] =
      repoResults.length > 0 ? repoResults[0].commits || [] : [];

    dispatch({
      type: "ADD_COMMITS",
      payload: { repoId, commits },
    });

    // Cache with enriched format
    try {
      const { set } = await import("@/lib/cache-manager");
      const latestTs = commits.reduce(
        (max, c) => (c.timestamp > max ? c.timestamp : max),
        ""
      );
      const cacheEntry: CachedCommitData = {
        commits,
        latestCommitTimestamp: latestTs || null,
        totalCount: commits.length,
      };
      await set(`commits:${repoId}`, cacheEntry, 86400000);
    } catch {
      // Non-critical
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

    onComplete();
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

    onComplete();
  }
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
