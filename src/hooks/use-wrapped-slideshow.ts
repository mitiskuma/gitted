'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import {
  type UseWrappedSlideshowReturn,
  type WrappedSlide,
  WRAPPED_SLIDE_DEFINITIONS,
} from '@/lib/types';

const ANIMATION_DURATION = 600; // ms
const TOTAL_SLIDES = WRAPPED_SLIDE_DEFINITIONS.length;

export function useWrappedSlideshow(): UseWrappedSlideshowReturn {
  const { wrappedSlideIndex, setWrappedSlideIndex } = useAppStore();

  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [autoAdvance, setAutoAdvance] = useState(false);

  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);

  // Keep ref in sync to avoid stale closures
  isAnimatingRef.current = isAnimating;

  const currentSlideData: WrappedSlide | null =
    wrappedSlideIndex >= 0 && wrappedSlideIndex < TOTAL_SLIDES
      ? WRAPPED_SLIDE_DEFINITIONS[wrappedSlideIndex]
      : null;

  const startAnimation = useCallback((dir: 'forward' | 'backward', callback: () => void) => {
    if (isAnimatingRef.current) return;

    setIsAnimating(true);
    setDirection(dir);

    // Clear any existing animation timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      callback();
      setIsAnimating(false);
      animationTimeoutRef.current = null;
    }, ANIMATION_DURATION);
  }, []);

  const next = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (wrappedSlideIndex >= TOTAL_SLIDES - 1) return;

    startAnimation('forward', () => {
      setWrappedSlideIndex(wrappedSlideIndex + 1);
    });
  }, [wrappedSlideIndex, setWrappedSlideIndex, startAnimation]);

  const prev = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (wrappedSlideIndex <= 0) return;

    startAnimation('backward', () => {
      setWrappedSlideIndex(wrappedSlideIndex - 1);
    });
  }, [wrappedSlideIndex, setWrappedSlideIndex, startAnimation]);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimatingRef.current) return;
      if (index < 0 || index >= TOTAL_SLIDES) return;
      if (index === wrappedSlideIndex) return;

      const dir = index > wrappedSlideIndex ? 'forward' : 'backward';
      startAnimation(dir, () => {
        setWrappedSlideIndex(index);
      });
    },
    [wrappedSlideIndex, setWrappedSlideIndex, startAnimation]
  );

  const toggleAutoAdvance = useCallback(() => {
    setAutoAdvance((prev) => !prev);
  }, []);

  // Auto-advance logic
  useEffect(() => {
    if (!autoAdvance) {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      return;
    }

    const currentSlideDef = WRAPPED_SLIDE_DEFINITIONS[wrappedSlideIndex];
    if (!currentSlideDef) return;

    const advanceMs = currentSlideDef.autoAdvanceMs;
    if (advanceMs === null) {
      // Final slide — stop auto advance
      return;
    }

    if (wrappedSlideIndex >= TOTAL_SLIDES - 1) {
      // Last slide, don't auto-advance
      return;
    }

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      next();
    }, advanceMs);

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [autoAdvance, wrappedSlideIndex, next]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          goTo(0);
          break;
        case 'End':
          e.preventDefault();
          goTo(TOTAL_SLIDES - 1);
          break;
        case 'Escape':
          // Could be used to exit wrapped
          break;
        default:
          // Number keys 1-9 for direct slide navigation
          if (e.key >= '1' && e.key <= '9') {
            const slideIndex = parseInt(e.key, 10) - 1;
            if (slideIndex < TOTAL_SLIDES) {
              e.preventDefault();
              goTo(slideIndex);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [next, prev, goTo]);

  // Touch/swipe gesture support
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = touchEndTime - touchStartTime;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Must be a horizontal swipe: fast enough, far enough, and more horizontal than vertical
      const isSwipe = deltaTime < 500 && absDeltaX > 50 && absDeltaX > absDeltaY * 1.5;

      if (isSwipe) {
        if (deltaX < 0) {
          // Swipe left → next
          next();
        } else {
          // Swipe right → prev
          prev();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [next, prev]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentSlide: wrappedSlideIndex,
    totalSlides: TOTAL_SLIDES,
    next,
    prev,
    goTo,
    isAnimating,
    slideData: currentSlideData,
    direction,
    autoAdvance,
    toggleAutoAdvance,
  };
}
