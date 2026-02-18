'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlaybackControlsProps } from '@/lib/types';
import { PlaybackState, PlaybackSpeed } from '@/lib/types';

const SPEED_OPTIONS: { label: string; value: PlaybackSpeed }[] = [
  { label: '0.5×', value: PlaybackSpeed.HALF },
  { label: '1×', value: PlaybackSpeed.NORMAL },
  { label: '2×', value: PlaybackSpeed.DOUBLE },
  { label: '5×', value: PlaybackSpeed.FAST },
  { label: '10×', value: PlaybackSpeed.ULTRA },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getSpeedLabel(speed: PlaybackSpeed): string {
  const option = SPEED_OPTIONS.find((o) => o.value === speed);
  return option?.label ?? `${speed}×`;
}

export function PlaybackControls({
  playbackState,
  speed,
  currentDate,
  onPlay,
  onPause,
  onSpeedChange,
  onFullscreenToggle,
  isFullscreen,
}: PlaybackControlsProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isPlaying = playbackState === PlaybackState.PLAYING;
  const isStopped = playbackState === PlaybackState.STOPPED;

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    },
    [handlePlayPause],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0.75 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
      >
        {/* Gradient fade backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Controls container */}
        <div className="relative flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {/* Left section: Play/Pause + Speed */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play / Pause Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
                  aria-label={isPlaying ? 'Pause visualization' : 'Play visualization'}
                >
                  {isPlaying ? (
                    <PauseIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : (
                    <PlayIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="border-white/10 bg-black/90 text-white">
                <p>{isPlaying ? 'Pause' : 'Play'} <kbd className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[10px]">Space</kbd></p>
              </TooltipContent>
            </Tooltip>

            {/* Speed Selector */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full bg-white/10 px-3 font-mono text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:h-9 sm:px-4 sm:text-sm"
                    >
                      <GaugeIcon className="h-3.5 w-3.5 opacity-70" />
                      <span>{getSpeedLabel(speed)}</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="border-white/10 bg-black/90 text-white">
                  <p>Playback speed</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                className="min-w-[100px] border-white/10 bg-black/95 backdrop-blur-xl"
              >
                {SPEED_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => onSpeedChange(option.value)}
                    className={`cursor-pointer font-mono text-sm transition-colors ${
                      speed === option.value
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span>{option.label}</span>
                      {speed === option.value && (
                        <CheckIcon className="ml-2 h-3.5 w-3.5 text-blue-400" />
                      )}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Playback state badge (mobile-hidden) */}
            <Badge
              variant="outline"
              className={`hidden border-0 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider sm:inline-flex ${
                isPlaying
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : isStopped
                    ? 'bg-gray-500/15 text-gray-400'
                    : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {isPlaying ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Playing
                </span>
              ) : isStopped ? (
                'Stopped'
              ) : (
                'Paused'
              )}
            </Badge>
          </div>

          {/* Center section: Current Date */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 backdrop-blur-sm sm:px-5 sm:py-2">
              <CalendarIcon className="h-3.5 w-3.5 text-white/50 sm:h-4 sm:w-4" />
              <span className="font-mono text-xs font-medium tracking-wide text-white/90 sm:text-sm">
                {formatDate(currentDate)}
              </span>
            </div>
          </div>

          {/* Right section: Fullscreen */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFullscreenToggle}
                  className="h-8 w-8 rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white sm:h-9 sm:w-9"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <MinimizeIcon className="h-4 w-4" />
                  ) : (
                    <MaximizeIcon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="border-white/10 bg-black/90 text-white">
                <p>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} <kbd className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[10px]">F</kbd></p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function MaximizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default PlaybackControls;
