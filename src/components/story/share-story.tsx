'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { ShareDialogProps } from '@/lib/types';

interface ShareStoryProps extends Omit<ShareDialogProps, 'targets'> {
  /** Number of repos in the story */
  repoCount?: number;
  /** Total commits analyzed */
  commitCount?: number;
  /** Additional targets beyond defaults */
  targets?: ('twitter' | 'linkedin' | 'copy-link' | 'download-image')[];
}

export function ShareStory({
  isOpen,
  onClose,
  title,
  shareText,
  shareUrl,
  captureRef,
  repoCount = 0,
  commitCount = 0,
  targets = ['twitter', 'linkedin', 'copy-link', 'download-image'],
}: ShareStoryProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // SSR-safe detection of native share support (avoids hydration mismatch)
  useEffect(() => {
    setSupportsNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    );
  }, []);

  // Clear stale state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCaptureError(null);
      setIsCopied(false);
    }
  }, [isOpen]);

  const defaultShareText =
    shareText ||
    `I just generated my AI-powered developer story with gitted! ${commitCount > 0 ? `${commitCount.toLocaleString()} commits` : ''} across ${repoCount > 0 ? `${repoCount} repositories` : 'my repos'} — turned into a compelling narrative. Check it out!`;

  const defaultShareUrl = shareUrl || (typeof window !== 'undefined' ? window.location.href : 'https://gitted.dev/story');

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(defaultShareText)}&url=${encodeURIComponent(defaultShareUrl)}`;

  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(defaultShareUrl)}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(defaultShareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      if (linkInputRef.current) {
        linkInputRef.current.select();
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    }
  }, [defaultShareUrl]);

  const handleDownloadImage = useCallback(async () => {
    if (!captureRef?.current) {
      setCaptureError('Nothing to capture. Make sure the story is fully loaded.');
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);

    try {
      // Wait for animations to settle
      await new Promise((resolve) => setTimeout(resolve, 500));

      const element = captureRef.current;
      const { captureElementAsBlob } = await import('@/lib/capture-utils');
      const blob = await captureElementAsBlob(element, { backgroundColor: '#0a0a0f' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `gitted-story-${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      setIsCapturing(false);
    } catch (err) {
      console.error('Image capture failed:', err);
      setCaptureError('Failed to capture image. Please try again.');
      setIsCapturing(false);
    }
  }, [captureRef]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }

    setIsSharing(true);
    try {
      // Try to include the image if capture ref is available
      let files: File[] = [];
      if (captureRef?.current) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const element = captureRef.current;
          const { captureElementAsBlob } = await import('@/lib/capture-utils');
          const blob: Blob | null = await captureElementAsBlob(element, { backgroundColor: '#0a0a0f' });
          if (blob) {
            files = [new File([blob], 'gitted-story.png', { type: 'image/png' })];
          }
        } catch {
          // Proceed without image
        }
      }

      const shareData: ShareData = {
        title: title || 'My Developer Story — gitted',
        text: defaultShareText,
        url: defaultShareUrl,
      };

      // Only include files if the browser supports it
      if (files.length > 0) {
        try {
          if (navigator.canShare && navigator.canShare({ ...shareData, files })) {
            shareData.files = files;
          }
        } catch {
          // canShare not supported, skip files
        }
      }

      await navigator.share(shareData);
    } catch (err) {
      // User cancelled or share failed - not an error
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  }, [captureRef, defaultShareText, defaultShareUrl, title, handleCopyLink]);

  const handleClose = useCallback(() => {
    setCaptureError(null);
    setIsCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-lg">
              📖
            </span>
            Share Your Story
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Share your AI-generated developer journey with the world.
          </DialogDescription>
        </DialogHeader>

        {/* Story preview card */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-violet-950/30 p-5">
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-fuchsia-600/10 blur-2xl" />

          <div className="relative">
            <h3 className="mb-1 text-sm font-semibold text-white">
              {title || 'Your Developer Journey'}
            </h3>
            <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">
              {defaultShareText.slice(0, 120)}...
            </p>
            <div className="flex flex-wrap gap-2">
              {repoCount > 0 && (
                <Badge
                  variant="secondary"
                  className="border-violet-500/20 bg-violet-500/10 text-violet-300"
                >
                  {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
                </Badge>
              )}
              {commitCount > 0 && (
                <Badge
                  variant="secondary"
                  className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300"
                >
                  {commitCount.toLocaleString()} commits
                </Badge>
              )}
              <Badge
                variant="secondary"
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              >
                AI-generated
              </Badge>
            </div>
          </div>
        </div>

        {/* Share options */}
        <div className="space-y-3">
          {/* Native share (mobile) — uses state-based check for SSR safety */}
          {supportsNativeShare && (
            <>
              <Button
                onClick={handleNativeShare}
                disabled={isSharing}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                size="lg"
              >
                {isSharing ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Sharing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShareIcon />
                    Share via Device
                  </span>
                )}
              </Button>
              <Separator className="bg-zinc-800" />
            </>
          )}

          {/* Social share buttons */}
          <div className="grid grid-cols-2 gap-3">
            {targets.includes('twitter') && (
              <Button
                variant="outline"
                className="h-12 border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:border-sky-500/40 hover:bg-sky-950/30 hover:text-sky-300"
                onClick={() => window.open(twitterShareUrl, '_blank', 'noopener,noreferrer,width=550,height=420')}
              >
                <span className="flex items-center gap-2">
                  <XTwitterIcon />
                  <span className="text-sm">Twitter / X</span>
                </span>
              </Button>
            )}

            {targets.includes('linkedin') && (
              <Button
                variant="outline"
                className="h-12 border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:border-blue-500/40 hover:bg-blue-950/30 hover:text-blue-300"
                onClick={() => window.open(linkedinShareUrl, '_blank', 'noopener,noreferrer,width=550,height=420')}
              >
                <span className="flex items-center gap-2">
                  <LinkedInIcon />
                  <span className="text-sm">LinkedIn</span>
                </span>
              </Button>
            )}
          </div>

          {/* Download as image */}
          {targets.includes('download-image') && (
            <Button
              variant="outline"
              className="h-12 w-full border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-950/30 hover:text-emerald-300"
              onClick={handleDownloadImage}
              disabled={isCapturing || !captureRef?.current}
            >
              {isCapturing ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Capturing image...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <DownloadIcon />
                  <span className="text-sm">Download as Image</span>
                </span>
              )}
            </Button>
          )}

          {captureError && (
            <p className="text-center text-xs text-red-400">{captureError}</p>
          )}

          {/* Copy link */}
          {targets.includes('copy-link') && (
            <div className="space-y-2">
              <Separator className="bg-zinc-800" />
              <label className="text-xs font-medium text-zinc-500">
                Or copy the link
              </label>
              <div className="flex gap-2">
                <Input
                  ref={linkInputRef}
                  readOnly
                  value={defaultShareUrl}
                  className="h-10 border-zinc-700 bg-zinc-900 text-xs text-zinc-300 focus:border-violet-500/50 focus:ring-violet-500/20"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-10 min-w-[80px] border-zinc-700 transition-all duration-200 ${
                    isCopied
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                      : 'bg-zinc-900 text-zinc-300 hover:border-violet-500/40 hover:bg-violet-950/30 hover:text-violet-300'
                  }`}
                  onClick={handleCopyLink}
                >
                  {isCopied ? (
                    <span className="flex items-center gap-1.5">
                      <CheckIcon />
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <CopyIcon />
                      Copy
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[11px] text-zinc-600">
            Powered by gitted — AI-generated developer narratives
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Icon components
function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function XTwitterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
