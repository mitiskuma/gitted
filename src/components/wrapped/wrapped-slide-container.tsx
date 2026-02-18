'use client';

import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type WrappedSlideContainerProps,
  WRAPPED_SLIDE_DEFINITIONS,
} from '@/lib/types';

function getAnimationVariants(slideIndex: number, direction: 'forward' | 'backward') {
  const slideDef = WRAPPED_SLIDE_DEFINITIONS[slideIndex];
  const animation = slideDef?.animation || 'fade-in';

  switch (animation) {
    case 'slide-up':
      return {
        initial: {
          opacity: 0,
          y: direction === 'forward' ? 80 : -80,
          scale: 0.95,
        },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
        },
        exit: {
          opacity: 0,
          y: direction === 'forward' ? -80 : 80,
          scale: 0.95,
        },
      };
    case 'slide-left':
      return {
        initial: {
          opacity: 0,
          x: direction === 'forward' ? 120 : -120,
          scale: 0.95,
        },
        animate: {
          opacity: 1,
          x: 0,
          scale: 1,
        },
        exit: {
          opacity: 0,
          x: direction === 'forward' ? -120 : 120,
          scale: 0.95,
        },
      };
    case 'scale-pop':
      return {
        initial: {
          opacity: 0,
          scale: direction === 'forward' ? 0.8 : 1.15,
          rotate: direction === 'forward' ? -2 : 2,
        },
        animate: {
          opacity: 1,
          scale: 1,
          rotate: 0,
        },
        exit: {
          opacity: 0,
          scale: direction === 'forward' ? 1.15 : 0.8,
          rotate: direction === 'forward' ? 2 : -2,
        },
      };
    case 'fade-in':
    default:
      return {
        initial: {
          opacity: 0,
          scale: 0.98,
        },
        animate: {
          opacity: 1,
          scale: 1,
        },
        exit: {
          opacity: 0,
          scale: 0.98,
        },
      };
  }
}

export function WrappedSlideContainer({
  currentSlide,
  totalSlides,
  onSlideChange,
  direction,
  children,
}: WrappedSlideContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const variants = getAnimationVariants(currentSlide, direction);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      role="region"
      aria-roledescription="slideshow"
      aria-label={`Git Wrapped — Your year in code`}
    >
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`slide-${currentSlide}`}
            className="absolute inset-0 flex items-center justify-center"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
