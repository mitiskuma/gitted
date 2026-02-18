'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { type WrappedSlideType } from '@/lib/types';
import {
  Download,
  Twitter,
  Linkedin,
  Link2,
  Check,
  Share2,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';

// Share text templates per slide type — year is interpolated dynamically
const SHARE_TEXT_TEMPLATES: Record<WrappedSlideType | string, (year: number) => string> = {
  intro: (y) => `Just unwrapped my ${y} Git Wrapped! Check out my coding year in review.`,
  'top-repos': (y) => `Here are my top repositories of ${y}! My code tells a story.`,
  productivity: (y) => `My ${y} productivity stats are in and they are wild!`,
  'language-evolution': (y) => `Watch how my programming languages evolved throughout ${y}.`,
  streaks: (y) => `My coding streaks of ${y} were absolutely on fire!`,
  'monthly-breakdown': (y) => `A month-by-month look at my ${y} coding journey.`,
  'yearly-comparison': (y) => `Year-over-year growth - ${y} was a big one!`,
  superlatives: (y) => `Got my Git superlatives for ${y} - some surprises in there!`,
  'final-summary': (y) => `My complete ${y} Git Wrapped is here. What a year of code!`,
};

const getHashtags = (year: number) => `#GitWrapped #gitted #GitHub #CodingStats #Developer #${year}Wrapped`;

interface ShareWrappedProps {
  isOpen: boolean;
  onClose: () => void;
  slideType: WrappedSlideType | string;
  captureRef?: React.RefObject<HTMLElement | null>;
  userName?: string;
  customShareText?: string;
  year?: number;
}

export function ShareWrapped({
  isOpen,
  onClose,
  slideType,
  captureRef,
  userName,
  customShareText,
  year = new Date().getFullYear(),
}: ShareWrappedProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  // Detect native share support on mount (SSR-safe)
  useEffect(() => {
    setSupportsNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    );
  }, []);

  // Clear stale state when the dialog opens with a new slide
  const prevSlideTypeRef = useRef(slideType);
  useEffect(() => {
    if (isOpen && slideType !== prevSlideTypeRef.current) {
      setCapturedImage(null);
      setShareError(null);
      setCopied(false);
    }
    prevSlideTypeRef.current = slideType;
  }, [isOpen, slideType]);

  const hashtags = getHashtags(year);
  const shareText =
    customShareText ||
    SHARE_TEXT_TEMPLATES[slideType]?.(year) ||
    `Check out my ${year} Git Wrapped!`;

  const fullShareText = userName
    ? `${shareText} @${userName} ${hashtags}`
    : `${shareText} ${hashtags}`;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://gitted.dev/wrapped';

  const captureSlideImage = useCallback(async (): Promise<string | null> => {
    if (!captureRef?.current) {
      setShareError('No slide content available to capture.');
      return null;
    }

    setIsCapturing(true);
    setShareError(null);

    try {
      // Wait a tick for animations to settle
      await new Promise((resolve) => setTimeout(resolve, 300));

      const element = captureRef.current;
      const { captureElementAsDataUrl } = await import('@/lib/capture-utils');
      const dataUrl = await captureElementAsDataUrl(element);
      setCapturedImage(dataUrl);
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture slide image:', err);
      setShareError('Failed to capture image. Please try again.');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [captureRef]);

  const handleDownloadImage = useCallback(async () => {
    let imageData = capturedImage;
    if (!imageData) {
      imageData = await captureSlideImage();
    }

    if (!imageData) return;

    try {
      // Always create a fresh anchor element for download to avoid DOM issues
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `gitted-wrapped-${year}-${slideType}.png`;
      document.body.appendChild(link);
      link.click();
      // Use setTimeout to ensure the click registers before removal
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      setShareError('Download failed. Please try again.');
    }
  }, [capturedImage, captureSlideImage, slideType]);

  const handleShareTwitter = useCallback(() => {
    const tweetText = encodeURIComponent(fullShareText);
    const tweetUrl = encodeURIComponent(shareUrl);
    const url = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400');
  }, [fullShareText, shareUrl]);

  const handleShareLinkedIn = useCallback(() => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer,width=600,height=600');
  }, [shareUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${fullShareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `${fullShareText}\n\n${shareUrl}`;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [fullShareText, shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }

    try {
      const shareData: ShareData = {
        title: `My ${year} Git Wrapped`,
        text: fullShareText,
        url: shareUrl,
      };

      // If we have a captured image, try to share it as a file
      if (capturedImage) {
        try {
          const response = await fetch(capturedImage);
          const blob = await response.blob();
          const file = new File([blob], `gitted-wrapped-${year}-${slideType}.png`, {
            type: 'image/png',
          });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch {
          // Silently fall back to sharing without the image
        }
      }

      await navigator.share(shareData);
    } catch (err) {
      // User cancelled sharing or error
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [fullShareText, shareUrl, capturedImage, slideType, handleCopyLink]);

  const handleClose = useCallback(() => {
    setCapturedImage(null);
    setShareError(null);
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-white/10 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
            <Share2 className="h-5 w-5 text-purple-400" />
            Share Your Wrapped
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Show the world what you built in {year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Preview section */}
          {capturedImage && (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              <img
                src={capturedImage}
                alt="Captured slide preview"
                className="w-full rounded-xl"
              />
              <button
                onClick={() => setCapturedImage(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 backdrop-blur-sm transition-colors hover:bg-black/80"
                aria-label="Remove preview image"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          )}

          {/* Capture button */}
          {!capturedImage && captureRef && (
            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={captureSlideImage}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Capturing slide...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate Image Preview
                </>
              )}
            </Button>
          )}

          {/* Share text preview */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm leading-relaxed text-white/80">{fullShareText}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {hashtags.split(' ').map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="border-purple-500/30 bg-purple-500/20 text-xs text-purple-300"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Share buttons grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Twitter/X */}
            <Button
              onClick={handleShareTwitter}
              className="h-12 bg-[#1DA1F2]/20 text-[#1DA1F2] hover:bg-[#1DA1F2]/30 border border-[#1DA1F2]/30"
            >
              <Twitter className="mr-2 h-4 w-4" />
              Twitter / X
            </Button>

            {/* LinkedIn */}
            <Button
              onClick={handleShareLinkedIn}
              className="h-12 bg-[#0A66C2]/20 text-[#0A66C2] hover:bg-[#0A66C2]/30 border border-[#0A66C2]/30"
            >
              <Linkedin className="mr-2 h-4 w-4" />
              LinkedIn
            </Button>

            {/* Copy Link */}
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="h-12 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>

            {/* Download Image */}
            <Button
              onClick={handleDownloadImage}
              variant="outline"
              className="h-12 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              disabled={isCapturing}
            >
              {isCapturing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PNG
            </Button>
          </div>

          {/* Native share (mobile-friendly) — uses state-based check for SSR safety */}
          {supportsNativeShare && (
            <Button
              onClick={handleNativeShare}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-semibold"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share via Device
            </Button>
          )}

          {/* Error display */}
          {shareError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-sm text-red-400">{shareError}</p>
            </div>
          )}

          {/* Powered by footer */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-white/30">Powered by</span>
            <span className="text-xs font-bold text-white/50">
              gitted
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Inline share button to embed within slides */
interface ShareButtonProps {
  slideType: WrappedSlideType | string;
  captureRef?: React.RefObject<HTMLElement | null>;
  userName?: string;
  className?: string;
  variant?: 'icon' | 'full';
  year?: number;
}

export function ShareButton({
  slideType,
  captureRef,
  userName,
  className = '',
  variant = 'icon',
  year,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={`rounded-full bg-white/10 p-2.5 backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110 active:scale-95 ${className}`}
          aria-label="Share this slide"
        >
          <Share2 className="h-4 w-4 text-white" />
        </button>
      ) : (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 font-semibold ${className}`}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share Your Wrapped
        </Button>
      )}

      <ShareWrapped
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        slideType={slideType}
        captureRef={captureRef}
        userName={userName}
        year={year}
      />
    </>
  );
}
