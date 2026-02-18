'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UseGitHubAuthReturn,
  GitHubUser,
  Repository,
} from '@/lib/types';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || 'Ov23li_gitted_app';
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_SCOPES = 'repo read:user read:org';
const STORAGE_KEY_GITHUB_TOKEN = 'gitted_github_token';
const STORAGE_KEY_GITHUB_USER = 'gitted_github_user';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN);
  } catch {
    return null;
  }
}

function getStoredUser(): GitHubUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GITHUB_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, token);
  } catch {
    // Silently fail
  }
}

function storeUser(user: GitHubUser): void {
  try {
    localStorage.setItem(STORAGE_KEY_GITHUB_USER, JSON.stringify(user));
  } catch {
    // Silently fail
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_GITHUB_TOKEN);
    localStorage.removeItem(STORAGE_KEY_GITHUB_USER);
  } catch {
    // Silently fail
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function useGitHubAuth(): UseGitHubAuthReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const fetchingUserRef = useRef(false);

  const fetchUser = useCallback(async (token: string): Promise<GitHubUser | null> => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid or expired GitHub token. Please reconnect.');
        }
        if (response.status === 403) {
          const rateLimit = response.headers.get('X-RateLimit-Reset');
          if (rateLimit) {
            const resetTime = new Date(parseInt(rateLimit) * 1000);
            throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}.`);
          }
          throw new Error('GitHub API access forbidden. Check your token permissions.');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      const ghUser: GitHubUser = {
        id: data.id,
        login: data.login,
        name: data.name || data.login,
        avatarUrl: data.avatar_url,
        profileUrl: data.html_url,
        bio: data.bio,
        publicRepos: data.public_repos,
        totalRepos: data.total_private_repos
          ? data.public_repos + data.total_private_repos
          : data.public_repos,
        createdAt: data.created_at,
        email: data.email,
        company: data.company,
        location: data.location,
        followers: data.followers,
        following: data.following,
      };

      return ghUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch GitHub user';
      throw new Error(message);
    }
  }, []);

  const fetchRepos = useCallback(async (token: string): Promise<Repository[]> => {
    try {
      const allRepos: Repository[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && page <= 10) {
        const response = await fetch(
          `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Token expired during repo fetch. Please reconnect.');
          }
          throw new Error(`Failed to fetch repositories: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
          break;
        }

        const mappedRepos: Repository[] = data.map((repo: Record<string, unknown>): Repository => ({
          id: repo.full_name as string,
          githubId: repo.id as number,
          name: repo.name as string,
          fullName: repo.full_name as string,
          description: (repo.description as string) || null,
          owner: {
            login: (repo.owner as Record<string, unknown>).login as string,
            avatarUrl: (repo.owner as Record<string, unknown>).avatar_url as string,
            isOrg: (repo.owner as Record<string, unknown>).type === 'Organization',
            type: (repo.owner as Record<string, unknown>).type as 'User' | 'Organization',
          },
          isPrivate: repo.private as boolean,
          isFork: repo.fork as boolean,
          isArchived: repo.archived as boolean,
          language: (repo.language as string) || null,
          languages: repo.language ? { [repo.language as string]: 1 } : {},
          starCount: repo.stargazers_count as number,
          forkCount: repo.forks_count as number,
          watcherCount: repo.watchers_count as number,
          openIssueCount: repo.open_issues_count as number,
          defaultBranch: repo.default_branch as string,
          createdAt: repo.created_at as string,
          updatedAt: repo.updated_at as string,
          pushedAt: repo.pushed_at as string,
          htmlUrl: repo.html_url as string,
          cloneUrl: repo.clone_url as string,
          commitCount: null,
          size: repo.size as number,
          topics: (repo.topics as string[]) || [],
          license: repo.license
            ? {
                key: (repo.license as Record<string, unknown>).key as string,
                name: (repo.license as Record<string, unknown>).name as string,
                spdxId: ((repo.license as Record<string, unknown>).spdx_id as string) || null,
              }
            : null,
        }));

        allRepos.push(...mappedRepos);

        const linkHeader = response.headers.get('Link');
        hasMore = linkHeader ? linkHeader.includes('rel="next"') : data.length === perPage;
        page++;
      }

      return allRepos;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repositories';
      throw new Error(message);
    }
  }, []);

  const handleOAuthCallback = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const authError = urlParams.get('error');
    const errorMessage = urlParams.get('error_message');

    if (authError) {
      setError(`GitHub authentication failed: ${urlParams.get('error_description') || authError}`);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (authStatus === 'error') {
      const decoded = errorMessage ? decodeURIComponent(errorMessage) : 'Authentication failed';
      setError(decoded);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const authSuccess = authStatus;

    if (authSuccess === 'success') {
      // Token should be in httpOnly cookie set by /api/github/callback
      const cookieToken = getCookie('github_token');
      // Also check localStorage as fallback
      const storedToken = getStoredToken();
      const token = cookieToken || storedToken;

      if (token) {
        setIsLoading(true);
        setError(null);

        try {
          storeToken(token);

          const ghUser = await fetchUser(token);
          if (ghUser) {
            storeUser(ghUser);
            setUser(ghUser);
            setIsConnected(true);

            const fetchedRepos = await fetchRepos(token);
            setRepos(fetchedRepos);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to complete authentication';
          setError(message);
          clearStorage();
          setIsConnected(false);
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      }

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchUser, fetchRepos]);

  // Initialize from stored data on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      const cookieToken = getCookie('github_token');
      const token = storedToken || cookieToken;

      // Check for OAuth callback first
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth') || urlParams.get('error') || urlParams.get('code')) {
        await handleOAuthCallback();
        return;
      }

      if (token && storedUser) {
        setUser(storedUser);
        setIsConnected(true);

        // Re-fetch repos in background to get latest
        if (!fetchingUserRef.current) {
          fetchingUserRef.current = true;
          setIsLoading(true);

          try {
            // Validate the token is still valid
            const freshUser = await fetchUser(token);
            if (freshUser) {
              storeUser(freshUser);
              setUser(freshUser);
              const fetchedRepos = await fetchRepos(token);
              setRepos(fetchedRepos);
            }
          } catch {
            // Token might be expired
            clearStorage();
            setIsConnected(false);
            setUser(null);
            setRepos([]);
            setError('Your GitHub session has expired. Please reconnect.');
          } finally {
            setIsLoading(false);
            fetchingUserRef.current = false;
          }
        }
      } else if (token && !storedUser) {
        // Have token but no user — fetch user
        if (!fetchingUserRef.current) {
          fetchingUserRef.current = true;
          setIsLoading(true);

          try {
            const ghUser = await fetchUser(token);
            if (ghUser) {
              storeToken(token);
              storeUser(ghUser);
              setUser(ghUser);
              setIsConnected(true);
              const fetchedRepos = await fetchRepos(token);
              setRepos(fetchedRepos);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to validate GitHub token';
            setError(message);
            clearStorage();
          } finally {
            setIsLoading(false);
            fetchingUserRef.current = false;
          }
        }
      }
    };

    init();
  }, [handleOAuthCallback, fetchUser, fetchRepos]);

  const initiateOAuth = useCallback(() => {
    setError(null);
    setIsLoading(true);

    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Store state for CSRF protection
    try {
      sessionStorage.setItem('github_oauth_state', state);
    } catch {
      // Continue without state storage
    }

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${window.location.origin}/api/github/callback`,
      scope: GITHUB_SCOPES,
      state,
      allow_signup: 'false',
    });

    window.location.href = `${GITHUB_OAUTH_URL}?${params.toString()}`;
  }, []);

  const disconnect = useCallback(() => {
    clearStorage();
    setIsConnected(false);
    setUser(null);
    setRepos([]);
    setError(null);
    setIsLoading(false);

    // Clear the cookies
    if (typeof document !== 'undefined') {
      document.cookie = 'github_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'github_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }, []);

  return {
    initiateOAuth,
    isConnected,
    user,
    repos,
    disconnect,
    isLoading,
    error,
  };
}
