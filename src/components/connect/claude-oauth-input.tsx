'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClaudeOAuthInputProps } from '@/lib/types';

const TOKEN_PATTERNS = {
  anthropicApi: /^sk-ant-api[a-zA-Z0-9_-]{20,}$/,
  anthropicOAuth: /^sk-ant-oat[a-zA-Z0-9_-]{20,}$/,
  anthropicSession: /^sk-[a-zA-Z0-9_-]{40,}$/,
  oauthToken: /^[a-zA-Z0-9_-]{20,}$/,
};

function validateTokenFormat(token: string): {
  isValid: boolean;
  type: 'api-key' | 'oauth' | 'session-key' | 'unknown';
  message: string;
} {
  const trimmed = token.trim();
  if (!trimmed) {
    return { isValid: false, type: 'unknown', message: '' };
  }
  if (trimmed.length < 20) {
    return { isValid: false, type: 'unknown', message: 'Token is too short' };
  }
  if (TOKEN_PATTERNS.anthropicOAuth.test(trimmed)) {
    return { isValid: true, type: 'oauth', message: 'Anthropic OAuth token detected' };
  }
  if (TOKEN_PATTERNS.anthropicApi.test(trimmed)) {
    return { isValid: true, type: 'api-key', message: 'Anthropic API key detected' };
  }
  if (TOKEN_PATTERNS.anthropicSession.test(trimmed)) {
    return { isValid: true, type: 'session-key', message: 'Session key detected' };
  }
  if (TOKEN_PATTERNS.oauthToken.test(trimmed)) {
    return { isValid: true, type: 'oauth', message: 'Token format accepted' };
  }
  return { isValid: false, type: 'unknown', message: 'Unrecognized token format' };
}

export function ClaudeOAuthInput({
  value,
  onChange,
  onVerify,
  isVerified,
  isVerifying,
  error,
}: ClaudeOAuthInputProps) {
  const [showToken, setShowToken] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<ReturnType<typeof validateTokenFormat>>({
    isValid: false,
    type: 'unknown',
    message: '',
  });
  const [verifyAnimation, setVerifyAnimation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const result = validateTokenFormat(value);
    setValidationState(result);
    if (value && !result.isValid && result.message) {
      setLocalError(result.message);
    } else {
      setLocalError(null);
    }
  }, [value]);

  useEffect(() => {
    if (isVerified) {
      setVerifyAnimation(true);
      const timer = setTimeout(() => setVerifyAnimation(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isVerified]);

  const handleVerify = useCallback(async () => {
    if (!validationState.isValid) {
      setLocalError('Please enter a valid Claude API token before verifying.');
      return;
    }
    setLocalError(null);
    try {
      const success = await onVerify();
      if (!success) {
        setLocalError('Token verification failed. Check your token and try again.');
      }
    } catch {
      setLocalError('Verification request failed. Please try again.');
    }
  }, [onVerify, validationState.isValid]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData('text').trim();
      if (pasted) {
        onChange(pasted);
      }
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && validationState.isValid && !isVerifying && !isVerified) {
        handleVerify();
      }
    },
    [validationState.isValid, isVerifying, isVerified, handleVerify]
  );

  const displayError = error || localError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
        {/* Subtle glow effect when verified */}
        <AnimatePresence>
          {isVerified && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                background:
                  'radial-gradient(ellipse at top, rgba(52, 211, 153, 0.08) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-lg">
              🔑
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Claude API Token</CardTitle>
                <AnimatePresence mode="wait">
                  {isVerified ? (
                    <motion.div
                      key="verified"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Badge
                        variant="default"
                        className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      >
                        <svg
                          className="mr-1 h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Verified
                      </Badge>
                    </motion.div>
                  ) : value && validationState.isValid ? (
                    <motion.div
                      key="format-ok"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 text-amber-400"
                      >
                        Unverified
                      </Badge>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <CardDescription className="mt-1 text-sm">
                Power your Git Story with Claude AI for intelligent narrative generation
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Token input */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                ref={inputRef}
                type={showToken ? 'text' : 'password'}
                placeholder="sk-ant-api03-... or sk-ant-oat01-..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                disabled={isVerified}
                className={`pr-24 font-mono text-sm transition-all duration-200 ${
                  isVerified
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : displayError
                    ? 'border-red-500/40 bg-red-500/5'
                    : value && validationState.isValid
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border/50'
                }`}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {/* Toggle visibility */}
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                {/* Clear button */}
                {value && !isVerified && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear token"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Validation feedback */}
            <AnimatePresence mode="wait">
              {displayError ? (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-xs text-red-400"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {displayError}
                </motion.p>
              ) : value && validationState.isValid && !isVerified ? (
                <motion.p
                  key="format-ok"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-xs text-amber-400"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {validationState.message} — click Verify to confirm
                </motion.p>
              ) : isVerified ? (
                <motion.p
                  key="verified"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-400"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  Claude API token verified and ready for story generation
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!isVerified ? (
              <Button
                onClick={handleVerify}
                disabled={!validationState.isValid || isVerifying}
                className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 disabled:opacity-40"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Verify Token
                  </span>
                )}
              </Button>
            ) : (
              <motion.div
                initial={verifyAnimation ? { scale: 0.8 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    onChange('');
                  }}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Remove Token
                </Button>
              </motion.div>
            )}
          </div>

          {/* Help section */}
          <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80">Where to get your Claude API token:</p>
                <ol className="list-inside list-decimal space-y-1 pl-0.5">
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 underline underline-offset-2 transition-colors hover:text-orange-300"
                    >
                      console.anthropic.com/settings/keys
                    </a>
                  </li>
                  <li>Click &ldquo;Create Key&rdquo; to generate a new API key</li>
                  <li>Copy the key (starts with <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">sk-ant-api</code>) or use an OAuth token (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">sk-ant-oat</code>)</li>
                  <li>Paste it above — we use it to generate your dev story with Claude</li>
                </ol>
                <p className="mt-2 rounded bg-purple-500/5 border border-purple-500/10 px-2 py-1.5 text-purple-400/80">
                  <span className="font-medium">Using Claude Code?</span> Run{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">claude setup-token</code>{' '}
                  in your terminal, then paste the generated token here.
                </p>
                <p className="mt-2 rounded bg-amber-500/5 border border-amber-500/10 px-2 py-1.5 text-amber-400/80">
                  <span className="font-medium">🔒 Privacy:</span> Your token is stored locally in your browser and only sent to Claude&apos;s API for story generation. We never store it on our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 pt-1">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
              isVerified
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : value && validationState.isValid
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                : 'bg-muted text-muted-foreground ring-1 ring-border/30'
            }`}>
              {isVerified ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                '1'
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {isVerified
                ? 'Claude API connected — ready for story generation'
                : 'Step 1 of 2 — Connect your Claude API token'}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
