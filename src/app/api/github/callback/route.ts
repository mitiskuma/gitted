import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { exchangeCodeForToken, validateToken } from '@/lib/github-api';
import type { ApiResponse, GitHubUser } from '@/lib/types';

// =============================================================================
// INPUT VALIDATION
// =============================================================================

const callbackQuerySchema = z.object({
  code: z
    .string()
    .min(1, 'Authorization code is required')
    .max(256, 'Authorization code is too long'),
  state: z.string().optional(),
});

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

function getGitHubOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID environment variable is not set');
  }

  if (!clientSecret) {
    throw new Error('GITHUB_CLIENT_SECRET environment variable is not set');
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/github/callback`,
  };
}

// =============================================================================
// COOKIE CONFIGURATION
// =============================================================================

const GITHUB_TOKEN_COOKIE = 'github_token';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function buildSecureCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GitHub OAuth callback handler.
 *
 * Flow (Rule 13):
 * 1. GitHub redirects here with ?code=xxx after user authorizes
 * 2. We exchange the code for an access token using client_secret
 * 3. We validate the token by fetching the user profile
 * 4. We store the token in an httpOnly secure cookie
 * 5. We redirect to /connect?auth=success (or ?auth=error on failure)
 *
 * The cookie is then read by useGitHubAuth hook on the /connect page,
 * which detects the token and sets isConnected=true in AuthProvider.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const connectUrl = new URL('/connect', appUrl);

  try {
    // =========================================================================
    // 1. Parse and validate query parameters
    // =========================================================================

    const { searchParams } = request.nextUrl;

    // Check for OAuth error response from GitHub
    const oauthError = searchParams.get('error');
    if (oauthError) {
      const errorDescription =
        searchParams.get('error_description') || 'GitHub OAuth authorization failed';

      console.error(
        `[GitHub OAuth] Authorization error: ${oauthError} - ${errorDescription}`
      );

      connectUrl.searchParams.set('auth', 'error');
      connectUrl.searchParams.set(
        'error_message',
        encodeURIComponent(errorDescription)
      );

      return NextResponse.redirect(connectUrl.toString());
    }

    // Validate the code parameter
    const rawParams = {
      code: searchParams.get('code') || '',
      state: searchParams.get('state') || undefined,
    };

    const parseResult = callbackQuerySchema.safeParse(rawParams);

    if (!parseResult.success) {
      const validationErrors = parseResult.error.errors
        .map((e) => e.message)
        .join(', ');

      console.error(
        `[GitHub OAuth] Invalid callback parameters: ${validationErrors}`
      );

      connectUrl.searchParams.set('auth', 'error');
      connectUrl.searchParams.set(
        'error_message',
        encodeURIComponent(`Invalid callback parameters: ${validationErrors}`)
      );

      return NextResponse.redirect(connectUrl.toString());
    }

    const { code, state } = parseResult.data;

    // =========================================================================
    // 2. Validate CSRF state if present
    // =========================================================================

    // If state was provided, verify it matches the one stored in the cookie
    if (state) {
      const storedState = request.cookies.get('github_oauth_state')?.value;
      if (storedState && storedState !== state) {
        console.error('[GitHub OAuth] State mismatch — possible CSRF attack');

        connectUrl.searchParams.set('auth', 'error');
        connectUrl.searchParams.set(
          'error_message',
          encodeURIComponent(
            'OAuth state mismatch. Please try connecting again.'
          )
        );

        return NextResponse.redirect(connectUrl.toString());
      }
    }

    // =========================================================================
    // 3. Exchange authorization code for access token
    // =========================================================================

    let oauthConfig: ReturnType<typeof getGitHubOAuthConfig>;
    try {
      oauthConfig = getGitHubOAuthConfig();
    } catch (configError) {
      console.error(
        '[GitHub OAuth] Configuration error:',
        configError instanceof Error ? configError.message : configError
      );

      connectUrl.searchParams.set('auth', 'error');
      connectUrl.searchParams.set(
        'error_message',
        encodeURIComponent('Server configuration error. Please contact support.')
      );

      return NextResponse.redirect(connectUrl.toString());
    }

    let accessToken: string;
    let tokenType: string;
    let scope: string;

    try {
      const tokenResult = await exchangeCodeForToken(
        code,
        oauthConfig.clientId,
        oauthConfig.clientSecret
      );

      accessToken = tokenResult.accessToken;
      tokenType = tokenResult.tokenType;
      scope = tokenResult.scope;
    } catch (exchangeError) {
      const message =
        exchangeError instanceof Error
          ? exchangeError.message
          : 'Failed to exchange authorization code for token';

      console.error(`[GitHub OAuth] Token exchange failed: ${message}`);

      connectUrl.searchParams.set('auth', 'error');
      connectUrl.searchParams.set(
        'error_message',
        encodeURIComponent(
          'Failed to authenticate with GitHub. The authorization code may have expired. Please try again.'
        )
      );

      return NextResponse.redirect(connectUrl.toString());
    }

    // =========================================================================
    // 4. Validate the token by fetching the user profile
    // =========================================================================

    let user: GitHubUser | null = null;

    try {
      const validation = await validateToken(accessToken);

      if (!validation.valid || !validation.user) {
        console.error('[GitHub OAuth] Token validation failed — token is invalid');

        connectUrl.searchParams.set('auth', 'error');
        connectUrl.searchParams.set(
          'error_message',
          encodeURIComponent(
            'The GitHub token could not be validated. Please try again.'
          )
        );

        return NextResponse.redirect(connectUrl.toString());
      }

      // Check for required scopes
      const requiredScopes = ['repo'];
      const grantedScopes = validation.scopes;
      const hasRequiredScopes = requiredScopes.every((required) =>
        grantedScopes.some(
          (granted) => granted === required || granted.startsWith(`${required}:`)
        )
      );

      if (!hasRequiredScopes && grantedScopes.length > 0) {
        console.warn(
          `[GitHub OAuth] Missing required scopes. Granted: ${grantedScopes.join(', ')}. Required: ${requiredScopes.join(', ')}`
        );
        // Don't block — some scopes may be implied or the user may have public repos only
      }

      user = {
        id: validation.user.id,
        login: validation.user.login,
        name: validation.user.name,
        avatarUrl: validation.user.avatarUrl,
        profileUrl: validation.user.profileUrl,
        bio: validation.user.bio,
        publicRepos: validation.user.publicRepos,
        totalRepos: validation.user.totalRepos,
        createdAt: validation.user.createdAt,
        email: validation.user.email,
        company: validation.user.company,
        location: validation.user.location,
        followers: validation.user.followers,
        following: validation.user.following,
      };

      console.log(
        `[GitHub OAuth] Successfully authenticated user: ${user.login} (${user.id})`
      );
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : 'Token validation failed';

      console.error(`[GitHub OAuth] Token validation error: ${message}`);

      // Still proceed — the token exchange succeeded, so it should be valid
      console.warn(
        '[GitHub OAuth] Proceeding despite validation error — token exchange was successful'
      );
    }

    // =========================================================================
    // 5. Build the redirect response with secure httpOnly cookie
    // =========================================================================

    connectUrl.searchParams.set('auth', 'success');

    // Include basic user info as query params so the client can display
    // the connected state before reading from AuthProvider
    if (user) {
      connectUrl.searchParams.set('user', user.login);
    }

    const response = NextResponse.redirect(connectUrl.toString());

    // Set the GitHub token as an httpOnly secure cookie
    const cookieOptions = buildSecureCookieOptions();

    // Note: httpOnly is false because the client-side SPA needs direct access
    // to the token for GitHub API calls (Authorization: Bearer header).
    response.cookies.set(GITHUB_TOKEN_COOKIE, accessToken, {
      httpOnly: false,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    // Clear the OAuth state cookie if it exists
    response.cookies.delete('github_oauth_state');

    // Set additional cookie with user info for client-side access
    // This allows AuthProvider to read basic user info without an API call
    if (user) {
      const userInfoPayload = JSON.stringify({
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
      });

      response.cookies.set('github_user', userInfoPayload, {
        httpOnly: false, // Client-readable for AuthProvider
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge,
      });
    }

    return response;
  } catch (error) {
    // =========================================================================
    // Catch-all error handler
    // =========================================================================

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    console.error(`[GitHub OAuth] Unhandled error in callback: ${message}`, error);

    connectUrl.searchParams.set('auth', 'error');
    connectUrl.searchParams.set(
      'error_message',
      encodeURIComponent(
        'An unexpected error occurred during authentication. Please try again.'
      )
    );

    return NextResponse.redirect(connectUrl.toString());
  }
}

// =============================================================================
// POST handler for programmatic token exchange (used by server-side code)
// =============================================================================

/**
 * POST /api/github/callback
 *
 * Programmatic token exchange endpoint. Accepts JSON body with authorization code,
 * exchanges it for a token, and returns the token + user info as JSON.
 *
 * This is used by server-side code that needs to exchange codes without
 * going through the redirect flow.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ user: GitHubUser; scopes: string[] }>>> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      );
    }

    const bodySchema = z.object({
      code: z.string().min(1, 'Authorization code is required'),
    });

    const parseResult = bodySchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => e.message).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errors,
          },
        },
        { status: 400 }
      );
    }

    const { code } = parseResult.data;

    // Get OAuth config
    let oauthConfig: ReturnType<typeof getGitHubOAuthConfig>;
    try {
      oauthConfig = getGitHubOAuthConfig();
    } catch (configError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_CONFIG_ERROR',
            message: 'GitHub OAuth is not configured on the server',
          },
        },
        { status: 500 }
      );
    }

    // Exchange code for token
    let accessToken: string;
    try {
      const tokenResult = await exchangeCodeForToken(
        code,
        oauthConfig.clientId,
        oauthConfig.clientSecret
      );
      accessToken = tokenResult.accessToken;
    } catch (exchangeError) {
      const message =
        exchangeError instanceof Error
          ? exchangeError.message
          : 'Token exchange failed';

      const status =
        exchangeError instanceof Error && 'status' in exchangeError
          ? (exchangeError as { status: number }).status
          : 401;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXCHANGE_FAILED',
            message,
          },
        },
        { status }
      );
    }

    // Validate token and get user info
    const validation = await validateToken(accessToken);

    if (!validation.valid || !validation.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'The exchanged token could not be validated',
          },
        },
        { status: 401 }
      );
    }

    const user: GitHubUser = {
      id: validation.user.id,
      login: validation.user.login,
      name: validation.user.name,
      avatarUrl: validation.user.avatarUrl,
      profileUrl: validation.user.profileUrl,
      bio: validation.user.bio,
      publicRepos: validation.user.publicRepos,
      totalRepos: validation.user.totalRepos,
      createdAt: validation.user.createdAt,
      email: validation.user.email,
      company: validation.user.company,
      location: validation.user.location,
      followers: validation.user.followers,
      following: validation.user.following,
    };

    // Build response with httpOnly cookie
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user,
          scopes: validation.scopes,
        },
        rateLimit: validation.rateLimit,
      },
      { status: 200 }
    );

    // Set the token cookie (non-httpOnly for client-side SPA access)
    const cookieOptions = buildSecureCookieOptions();
    response.cookies.set(GITHUB_TOKEN_COOKIE, accessToken, {
      httpOnly: false,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    // Set user info cookie for client-side access
    response.cookies.set(
      'github_user',
      JSON.stringify({
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
      }),
      {
        httpOnly: false,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge,
      }
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    console.error('[GitHub OAuth POST] Unhandled error:', message, error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during authentication',
          details:
            process.env.NODE_ENV === 'development' ? message : undefined,
        },
      },
      { status: 500 }
    );
  }
}
