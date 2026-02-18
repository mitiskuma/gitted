'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineScrubberProps } from '@/lib/types';

interface MilestoneMarker {
  position: number;
  label: string;
}

export function TimelineScrubber({
  progress,
  onSeek,
  startDate,
  endDate,
  commitDensity,
  milestones = [],
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneMarker | null>(null);

  const maxDensity = Math.max(1, ...commitDensity);

  // Convert progress (0-1) to a date string between start and end
  const progressToDate = useCallback(
    (p: number): string => {
      if (!startDate || !endDate) return '';
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      const current = start + (end - start) * p;
      const d = new Date(current);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    },
    [startDate, endDate],
  );

  const getProgressFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      const p = getProgressFromEvent(e.clientX);
      onSeek(p);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getProgressFromEvent, onSeek],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = getProgressFromEvent(e.clientX);

      if (isDragging) {
        onSeek(p);
      }

      setHoverProgress(p);
      setHoverDate(progressToDate(p));

      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        setTooltipX(e.clientX - rect.left);
      }

      // Check for milestone proximity
      const closestMilestone = milestones.find(
        (m) => Math.abs(m.position - p) < 0.02,
      );
      setActiveMilestone(closestMilestone || null);
    },
    [isDragging, getProgressFromEvent, onSeek, progressToDate, milestones],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    },
    [isDragging],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isDragging) {
      setHoverProgress(null);
      setHoverDate(null);
      setActiveMilestone(null);
    }
  }, [isDragging]);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onSeek(Math.min(1, progress + step));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onSeek(Math.max(0, progress - step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onSeek(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onSeek(1);
      }
    },
    [onSeek, progress],
  );

  // Format dates for display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const currentDateDisplay = progressToDate(progress);

  return (
    <div className="w-full select-none px-2 sm:px-4">
      {/* Date range labels */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wide text-white/40 uppercase sm:text-xs">
          {formatDate(startDate)}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide transition-all duration-200 sm:text-xs',
            isDragging
              ? 'bg-blue-500/30 text-blue-300 scale-105'
              : 'bg-white/5 text-white/60',
          )}
        >
          {currentDateDisplay}
        </span>
        <span className="text-[10px] font-medium tracking-wide text-white/40 uppercase sm:text-xs">
          {formatDate(endDate)}
        </span>
      </div>

      {/* Main scrubber track */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={currentDateDisplay}
        tabIndex={0}
        className={cn(
          'relative h-12 cursor-pointer rounded-lg sm:h-14',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          isDragging ? 'cursor-grabbing' : 'cursor-pointer',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      >
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-white/[0.03] backdrop-blur-sm">
          {/* Commit density histogram */}
          <div className="absolute inset-x-0 bottom-0 flex h-full items-end px-[1px]">
            {commitDensity.map((count, i) => {
              const height = maxDensity > 0 ? (count / maxDensity) * 100 : 0;
              const bucketProgress = i / commitDensity.length;
              const isPast = bucketProgress <= progress;
              const isHovered =
                hoverProgress !== null &&
                Math.abs(bucketProgress - hoverProgress) < 1 / commitDensity.length;

              return (
                <div
                  key={i}
                  className="flex-1 flex items-end"
                  style={{ height: '100%' }}
                >
                  <div
                    className={cn(
                      'w-full rounded-t-[1px] transition-colors duration-75',
                      isPast
                        ? 'bg-blue-400/50'
                        : 'bg-white/[0.08]',
                      isHovered && !isPast && 'bg-white/20',
                      isHovered && isPast && 'bg-blue-300/60',
                    )}
                    style={{
                      height: `${Math.max(height > 0 ? 4 : 0, height)}%`,
                      minHeight: count > 0 ? '2px' : '0px',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Progress fill overlay */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-gradient-to-r from-blue-500/10 to-blue-400/5"
            style={{ width: `${progress * 100}%` }}
          />

          {/* Thin progress bar line at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.04]">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isDragging
                  ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                  : 'bg-blue-500/70',
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Milestone markers */}
        {milestones.map((milestone, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 z-10"
            style={{ left: `${milestone.position * 100}%` }}
          >
            <div
              className={cn(
                'absolute top-0 h-full w-[2px] -translate-x-1/2 transition-all duration-150',
                activeMilestone?.position === milestone.position
                  ? 'bg-amber-400/80'
                  : 'bg-amber-500/30',
              )}
            />
            <div
              className={cn(
                'absolute top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/4 rounded-full border border-amber-500/50 transition-all duration-150',
                activeMilestone?.position === milestone.position
                  ? 'scale-125 border-amber-400 bg-amber-400'
                  : 'bg-amber-500/40',
              )}
            />

            {/* Milestone tooltip */}
            {activeMilestone?.position === milestone.position && (
              <div className="absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-amber-900/90 px-2 py-1 text-[10px] font-medium text-amber-200 shadow-lg backdrop-blur-sm">
                {milestone.label}
                <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-amber-900/90" />
              </div>
            )}
          </div>
        ))}

        {/* Playhead handle */}
        <div
          className="absolute top-0 bottom-0 z-20"
          style={{ left: `${progress * 100}%` }}
        >
          {/* Vertical line */}
          <div
            className={cn(
              'absolute top-0 h-full w-[2px] -translate-x-1/2 transition-all duration-75',
              isDragging
                ? 'bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]'
                : 'bg-blue-400/80',
            )}
          />

          {/* Handle knob */}
          <div
            className={cn(
              'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-150 sm:h-5 sm:w-5',
              isDragging
                ? 'scale-125 border-blue-300 bg-blue-400 shadow-[0_0_16px_rgba(96,165,250,0.7)]'
                : 'border-blue-400/80 bg-blue-500 shadow-lg hover:scale-110 hover:border-blue-300',
            )}
          >
            {/* Inner dot */}
            <div className="absolute inset-[3px] rounded-full bg-white/60" />
          </div>
        </div>

        {/* Hover indicator */}
        {hoverProgress !== null && !isDragging && (
          <>
            {/* Hover line */}
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-white/20"
              style={{ left: `${hoverProgress * 100}%` }}
            />

            {/* Hover tooltip */}
            {hoverDate && (
              <div
                className="pointer-events-none absolute -top-7 z-30"
                style={{
                  left: `${Math.max(30, Math.min(tooltipX, (trackRef.current?.clientWidth ?? 200) - 60))}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white/80 shadow-md backdrop-blur-sm">
                  {hoverDate}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Commit density legend */}
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex items-end gap-[1px]">
            {[0.2, 0.4, 0.7, 1.0].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-t-[1px] bg-blue-400/50"
                style={{ height: `${h * 10}px` }}
              />
            ))}
          </div>
          <span className="text-[9px] text-white/30">commit density</span>
        </div>
        <div className="flex items-center gap-2">
          {milestones.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
              <span className="text-[9px] text-white/30">milestones</span>
            </div>
          )}
          <span className="text-[9px] tabular-nums text-white/25">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default TimelineScrubber;
