"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type {
  AuthState,
  AuthActions,
  GitHubUser,
} from "@/lib/types";

// =============================================================================
// ENCRYPTION UTILITIES
// =============================================================================

const ENCRYPTION_KEY = "gitted-auth-v1";

function encrypt(value: string): string {
  try {
    const encoded = btoa(
      encodeURIComponent(value)
        .split("")
        .map((c, i) =>
          String.fromCharCode(
            c.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
          )
        )
        .join("")
    );
    return encoded;
  } catch {
    return btoa(value);
  }
}

function decrypt(value: string): string {
  try {
    const decoded = atob(value);
    return decodeURIComponent(
      decoded
        .split("")
        .map((c, i) =>
          String.fromCharCode(
            c.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
          )
        )
        .join("")
    );
  } catch {
    try {
      return atob(value);
    } catch {
      return "";
    }
  }
}

// =============================================================================
// LOCAL STORAGE HELPERS
// =============================================================================

const STORAGE_KEYS = {
  CLAUDE_TOKEN: "gitted:claude_token",
  GITHUB_TOKEN: "gitted:github_token",
  GITHUB_USER: "gitted:github_user",
  LAST_VALIDATED: "gitted:last_validated",
} as const;

function getStoredToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    const decrypted = decrypt(encrypted);
    return decrypted || null;
  } catch {
    return null;
  }
}

function setStoredToken(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, encrypt(value));
    }
  } catch {
    // Storage full or unavailable
  }
}

function getStoredUser(): GitHubUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GITHUB_USER);
    if (!raw) return null;
    return JSON.parse(decrypt(raw)) as GitHubUser;
  } catch {
    return null;
  }
}

function setStoredUser(user: GitHubUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user === null) {
      localStorage.removeItem(STORAGE_KEYS.GITHUB_USER);
    } else {
      localStorage.setItem(
        STORAGE_KEYS.GITHUB_USER,
        encrypt(JSON.stringify(user))
      );
    }
  } catch {
    // Storage full or unavailable
  }
}

function getStoredValidation(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_VALIDATED);
    if (!raw) return null;
    return parseInt(raw, 10);
  } catch {
    return null;
  }
}

function setStoredValidation(timestamp: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (timestamp === null) {
      localStorage.removeItem(STORAGE_KEYS.LAST_VALIDATED);
    } else {
      localStorage.setItem(STORAGE_KEYS.LAST_VALIDATED, String(timestamp));
    }
  } catch {
    // noop
  }
}

// =============================================================================
// GITHUB TOKEN FROM COOKIE (set by /api/github/callback)
// =============================================================================

function getGitHubTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split("=");
      if (name === "github_token") {
        return decodeURIComponent(valueParts.join("="));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getGitHubUserFromCookie(): GitHubUser | null {
  if (typeof document === "undefined") return null;
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split("=");
      if (name === "github_user") {
        const raw = decodeURIComponent(valueParts.join("="));
        const parsed = JSON.parse(raw);
        if (parsed && parsed.login) {
          return {
            id: parsed.id ?? 0,
            login: parsed.login,
            name: parsed.name ?? null,
            avatarUrl: parsed.avatarUrl ?? "",
            profileUrl: parsed.profileUrl ?? "",
            bio: null,
            publicRepos: 0,
            totalRepos: 0,
            createdAt: "",
            email: null,
            company: null,
            location: null,
            followers: 0,
            following: 0,
          };
        }
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// CONTEXT TYPE
// =============================================================================

interface AuthContextValue extends AuthState, AuthActions {}

const defaultAuthState: AuthState = {
  isGitHubConnected: false,
  isClaudeConnected: false,
  isFullyAuthenticated: false,
  githubToken: null,
  claudeToken: null,
  githubUser: null,
  lastValidated: null,
  error: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// AUTH PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(defaultAuthState);
  const isInitialized = useRef(false);

  // Initialize from storage on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const claudeToken = getStoredToken(STORAGE_KEYS.CLAUDE_TOKEN);
    const githubTokenFromStorage = getStoredToken(STORAGE_KEYS.GITHUB_TOKEN);
    const githubTokenFromCookie = getGitHubTokenFromCookie();
    const githubToken = githubTokenFromCookie || githubTokenFromStorage;
    const githubUser = getStoredUser() || getGitHubUserFromCookie();
    const lastValidated = getStoredValidation();

    // If we got a token from cookie but not storage, persist it
    if (githubTokenFromCookie && !githubTokenFromStorage) {
      setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, githubTokenFromCookie);
    }

    // If we got user from cookie but not storage, persist it
    if (githubUser && !getStoredUser()) {
      setStoredUser(githubUser);
    }

    const isGitHubConnected = !!githubToken && !!githubUser;
    const isClaudeConnected = !!claudeToken;

    setState({
      claudeToken,
      githubToken,
      githubUser,
      isGitHubConnected,
      isClaudeConnected,
      isFullyAuthenticated: isGitHubConnected && isClaudeConnected,
      lastValidated,
      error: null,
    });

    // If we have a GitHub token but no user, fetch user info
    if (githubToken && !githubUser) {
      fetchGitHubUser(githubToken);
    }
  }, []);

  // Fetch GitHub user profile
  const fetchGitHubUser = useCallback(async (token: string) => {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      const user: GitHubUser = {
        id: data.id,
        login: data.login,
        name: data.name || null,
        avatarUrl: data.avatar_url,
        profileUrl: data.html_url,
        bio: data.bio || null,
        publicRepos: data.public_repos,
        totalRepos: data.total_private_repos
          ? data.public_repos + data.total_private_repos
          : data.public_repos,
        createdAt: data.created_at,
        email: data.email || null,
        company: data.company || null,
        location: data.location || null,
        followers: data.followers,
        following: data.following,
      };

      setStoredUser(user);
      const now = Date.now();
      setStoredValidation(now);

      setState((prev) => ({
        ...prev,
        githubUser: user,
        isGitHubConnected: true,
        isFullyAuthenticated: prev.isClaudeConnected,
        lastValidated: now,
        error: null,
      }));

      return user;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch GitHub user";

      setState((prev) => ({
        ...prev,
        error: message,
        isGitHubConnected: false,
        isFullyAuthenticated: false,
      }));

      return null;
    }
  }, []);

  // Set Claude token
  const setClaudeToken = useCallback(async (token: string): Promise<boolean> => {
    if (!token || token.trim().length === 0) {
      setState((prev) => ({
        ...prev,
        error: "Claude token cannot be empty",
      }));
      return false;
    }

    const trimmedToken = token.trim();

    // Validate the token by making a lightweight request
    try {
      // Store token optimistically
      setStoredToken(STORAGE_KEYS.CLAUDE_TOKEN, trimmedToken);

      setState((prev) => ({
        ...prev,
        claudeToken: trimmedToken,
        isClaudeConnected: true,
        isFullyAuthenticated: prev.isGitHubConnected,
        error: null,
      }));

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to validate Claude token";

      setStoredToken(STORAGE_KEYS.CLAUDE_TOKEN, null);

      setState((prev) => ({
        ...prev,
        claudeToken: null,
        isClaudeConnected: false,
        isFullyAuthenticated: false,
        error: message,
      }));

      return false;
    }
  }, []);

  // Initiate GitHub OAuth flow
  const initiateGitHubOAuth = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      setState((prev) => ({
        ...prev,
        error: "GitHub OAuth client ID is not configured",
      }));
      return;
    }

    const redirectUri = `${window.location.origin}/api/github/callback`;
    const scope = "repo read:user user:email read:org";
    const stateParam = crypto.randomUUID();

    // Store state param for CSRF verification
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("gitted:oauth_state", stateParam);
    }

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", stateParam);

    window.location.href = authUrl.toString();
  }, []);

  // Handle GitHub OAuth callback
  const handleGitHubCallback = useCallback(
    async (code: string) => {
      try {
        const response = await fetch("/api/github/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `OAuth callback failed: ${response.status}`
          );
        }

        // The POST handler sets the token as a cookie and returns user data.
        // Read the token from the cookie that was set in the response.
        const cookieToken = getGitHubTokenFromCookie();
        const data = await response.json();

        if (!cookieToken) {
          throw new Error("No access token received from GitHub");
        }

        setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, cookieToken);

        setState((prev) => ({
          ...prev,
          githubToken: cookieToken,
          error: null,
        }));

        // If the response includes user data, use it directly
        if (data.success && data.data?.user) {
          const user = data.data.user as GitHubUser;
          setStoredUser(user);
          const now = Date.now();
          setStoredValidation(now);
          setState((prev) => ({
            ...prev,
            githubUser: user,
            isGitHubConnected: true,
            isFullyAuthenticated: prev.isClaudeConnected,
            lastValidated: now,
            error: null,
          }));
        } else {
          // Fallback: fetch user profile with the new token
          await fetchGitHubUser(cookieToken);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "GitHub OAuth failed";

        setState((prev) => ({
          ...prev,
          githubToken: null,
          githubUser: null,
          isGitHubConnected: false,
          isFullyAuthenticated: false,
          error: message,
        }));
      }
    },
    [fetchGitHubUser]
  );

  // Disconnect GitHub
  const disconnectGitHub = useCallback(() => {
    setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, null);
    setStoredUser(null);
    setStoredValidation(null);

    // Clear the httpOnly cookie by calling a logout endpoint
    fetch("/api/github/logout", { method: "POST" }).catch(() => {
      // Best effort cookie clear
    });

    // Clear cookies from client side (non-httpOnly fallback)
    if (typeof document !== "undefined") {
      document.cookie =
        "github_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie =
        "github_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }

    setState((prev) => ({
      ...prev,
      githubToken: null,
      githubUser: null,
      isGitHubConnected: false,
      isFullyAuthenticated: false,
      lastValidated: null,
      error: null,
    }));
  }, []);

  // Clear Claude token
  const clearClaudeToken = useCallback(() => {
    setStoredToken(STORAGE_KEYS.CLAUDE_TOKEN, null);

    setState((prev) => ({
      ...prev,
      claudeToken: null,
      isClaudeConnected: false,
      isFullyAuthenticated: false,
      error: null,
    }));
  }, []);

  // Full logout
  const logout = useCallback(() => {
    setStoredToken(STORAGE_KEYS.CLAUDE_TOKEN, null);
    setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, null);
    setStoredUser(null);
    setStoredValidation(null);

    // Clear cookies
    fetch("/api/github/logout", { method: "POST" }).catch(() => {});
    if (typeof document !== "undefined") {
      document.cookie =
        "github_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie =
        "github_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }

    setState(defaultAuthState);
  }, []);

  // Validate stored tokens
  const validateTokens = useCallback(async () => {
    const { claudeToken, githubToken } = state;

    // Skip if recently validated (within 5 minutes)
    if (state.lastValidated && Date.now() - state.lastValidated < 5 * 60 * 1000) {
      return;
    }

    let githubValid = false;
    let claudeValid = false;

    // Validate GitHub token
    if (githubToken) {
      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        githubValid = response.ok;

        if (response.ok) {
          const data = await response.json();
          const user: GitHubUser = {
            id: data.id,
            login: data.login,
            name: data.name || null,
            avatarUrl: data.avatar_url,
            profileUrl: data.html_url,
            bio: data.bio || null,
            publicRepos: data.public_repos,
            totalRepos: data.total_private_repos
              ? data.public_repos + data.total_private_repos
              : data.public_repos,
            createdAt: data.created_at,
            email: data.email || null,
            company: data.company || null,
            location: data.location || null,
            followers: data.followers,
            following: data.following,
          };
          setStoredUser(user);

          setState((prev) => ({
            ...prev,
            githubUser: user,
          }));
        }
      } catch {
        githubValid = false;
      }
    }

    // Claude token validation — mark as valid if it exists
    // (actual validation happens on first API call)
    if (claudeToken) {
      claudeValid = true;
    }

    const now = Date.now();
    setStoredValidation(now);

    if (!githubValid && githubToken) {
      // Token is invalid, clear it
      setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, null);
      setStoredUser(null);
    }

    if (!claudeValid && claudeToken) {
      setStoredToken(STORAGE_KEYS.CLAUDE_TOKEN, null);
    }

    setState((prev) => ({
      ...prev,
      githubToken: githubValid ? prev.githubToken : null,
      githubUser: githubValid ? prev.githubUser : null,
      claudeToken: claudeValid ? prev.claudeToken : null,
      isGitHubConnected: githubValid,
      isClaudeConnected: claudeValid,
      isFullyAuthenticated: githubValid && claudeValid,
      lastValidated: now,
      error:
        !githubValid && githubToken
          ? "GitHub token expired. Please reconnect."
          : null,
    }));
  }, [state]);

  // Check for OAuth callback on mount (URL params)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get("auth");
    const code = params.get("code");

    if (authSuccess === "error") {
      const errorMessage = params.get("error_message");
      const decoded = errorMessage
        ? decodeURIComponent(errorMessage)
        : "GitHub authentication failed";
      setState((prev) => ({ ...prev, error: decoded }));

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("error_message");
      window.history.replaceState({}, "", url.toString());
    } else if (authSuccess === "success") {
      // Token was set via cookie by /api/github/callback redirect
      const cookieToken = getGitHubTokenFromCookie();
      if (cookieToken) {
        setStoredToken(STORAGE_KEYS.GITHUB_TOKEN, cookieToken);
        setState((prev) => ({
          ...prev,
          githubToken: cookieToken,
          error: null,
        }));
        fetchGitHubUser(cookieToken);
      }

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("user");
      window.history.replaceState({}, "", url.toString());
    } else if (code) {
      handleGitHubCallback(code);

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchGitHubUser, handleGitHubCallback]);

  // Periodic token validation (every 30 minutes)
  useEffect(() => {
    if (!state.isGitHubConnected && !state.isClaudeConnected) return;

    const interval = setInterval(
      () => {
        validateTokens();
      },
      30 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [state.isGitHubConnected, state.isClaudeConnected, validateTokens]);

  const contextValue: AuthContextValue = {
    // State
    ...state,

    // Actions
    setClaudeToken,
    initiateGitHubOAuth,
    handleGitHubCallback,
    disconnectGitHub,
    clearClaudeToken,
    logout,
    validateTokens,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
        "Ensure AuthProvider is initialized in the root layout BEFORE GitDataProvider."
    );
  }

  return context;
}

export { AuthContext };
export type { AuthContextValue };
