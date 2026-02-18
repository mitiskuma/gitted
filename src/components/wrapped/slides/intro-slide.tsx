'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WrappedSlideProps } from '@/lib/types';

function AnimatedCounter({
  target,
  duration = 2000,
  delay = 800,
  isActive,
}: {
  target: number;
  duration?: number;
  delay?: number;
  isActive: boolean;
}) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setCount(0);
      return;
    }

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setCount(target);
        }
      };

      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay, isActive]);

  return <>{count.toLocaleString()}</>;
}

function PulsingGradientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />

      {/* Pulsing orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #7b2ff7, transparent)' }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full opacity-15 blur-[100px]"
        style={{ background: 'radial-gradient(circle, #3178c6, transparent)' }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[80px]"
        style={{ background: 'radial-gradient(circle, #c084fc, transparent)' }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.08, 0.18, 0.08],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function IntroSlide({ data, isActive, animationState, onAnimationComplete }: WrappedSlideProps) {
  const [showContent, setShowContent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && animationState === 'active') {
      const timeout = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timeout);
    } else if (animationState === 'hidden' || animationState === 'exiting') {
      setShowContent(false);
    }
  }, [isActive, animationState]);

  useEffect(() => {
    if (animationState === 'entering') {
      const timeout = setTimeout(() => {
        onAnimationComplete?.();
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [animationState, onAnimationComplete]);

  const userName = data.user.name || data.user.login;
  const totalCommits = data.totals.totalCommits;
  const wrappedYear = data.wrappedYear;
  const avatarUrl = data.user.avatarUrl;

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <PulsingGradientBackground />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <AnimatePresence>
          {showContent && (
            <>
              {/* Year badge */}
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mb-6"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium tracking-wider text-white/70 backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  {wrappedYear} IN REVIEW
                </span>
              </motion.div>

              {/* Avatar with glow ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative mb-8"
              >
                {/* Animated ring */}
                <motion.div
                  className="absolute -inset-3 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, #7b2ff7, #3178c6, #c084fc, #7b2ff7)',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute -inset-2 rounded-full bg-[#1a1a2e]" />
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/20 sm:h-28 sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                </div>
                {/* Avatar glow */}
                <div className="absolute -inset-6 -z-10 rounded-full bg-[#7b2ff7]/20 blur-xl" />
              </motion.div>

              {/* Main headline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mb-3"
              >
                <h1 className="text-lg font-medium tracking-wide text-white/60 sm:text-xl">
                  {userName}&apos;s
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mb-2"
              >
                <h2 className="text-5xl font-black tracking-tight sm:text-7xl md:text-8xl">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #c084fc 50%, #7b2ff7 100%)',
                    }}
                  >
                    Git Wrapped
                  </span>
                </h2>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="mb-12"
              >
                <p className="text-2xl font-bold tracking-wider text-white/40 sm:text-3xl">
                  {wrappedYear}
                </p>
              </motion.div>

              {/* Total commits counter */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                <div className="relative rounded-2xl border border-white/10 bg-white/5 px-10 py-6 backdrop-blur-md sm:px-14 sm:py-8">
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 -z-0 rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(105deg, transparent 20%, rgba(123,47,247,0.1) 40%, rgba(192,132,252,0.15) 50%, rgba(123,47,247,0.1) 60%, transparent 80%)',
                    }}
                    animate={{
                      x: ['-100%', '200%'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatDelay: 2,
                      ease: 'linear',
                    }}
                  />

                  <p className="relative mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40 sm:text-sm">
                    Total Commits
                  </p>
                  <p className="relative text-5xl font-black tabular-nums tracking-tight text-white sm:text-6xl md:text-7xl">
                    <AnimatedCounter target={totalCommits} duration={2500} delay={1500} isActive={showContent} />
                  </p>
                </div>
              </motion.div>

              {/* Bottom prompt */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 3 }}
                className="mt-12 flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/30"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </motion.div>
                <p className="text-xs font-medium tracking-widest text-white/20 uppercase">
                  Tap to continue
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
