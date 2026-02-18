'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WrappedSlideProps, StreakData } from '@/lib/types';

// Animated counter component
function AnimatedCounter({
  target,
  duration = 2000,
  delay = 0,
  suffix = '',
  prefix = '',
  className = '',
}: {
  target: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      hasStartedRef.current = true;
      startTimeRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, delay]);

  return (
    <span className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// Floating flame emoji component
function FloatingFlame({
  delay,
  x,
  size,
}: {
  delay: number;
  x: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, bottom: '-10%', fontSize: `${size}rem` }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 1, 1, 0.8, 0],
        y: [0, -100, -250, -400, -600],
        scale: [0.5, 1.2, 1, 0.8, 0.3],
        x: [0, Math.random() * 30 - 15, Math.random() * 60 - 30],
        rotate: [0, 10, -10, 15, -5],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 3,
        ease: 'easeOut',
      }}
    >
      🔥
    </motion.div>
  );
}

// Pulsing flame ring behind the streak number
function FlameRing({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          'radial-gradient(circle, rgba(233,69,96,0.3) 0%, rgba(233,69,96,0.1) 40%, transparent 70%)',
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: [0.8, 1.3, 0.8],
        opacity: [0.3, 0.7, 0.3],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function StreaksSlide({ data, isActive, animationState }: WrappedSlideProps) {
  const streaks: StreakData = data.streaks;

  const weekendPercentage = data.superlatives
    ? Math.round(
        data.superlatives.weekendType === 'weekend-warrior'
          ? 40 + Math.random() * 20
          : 10 + Math.random() * 20
      )
    : Math.round(15 + Math.random() * 25);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  const flamePositions = [5, 15, 25, 40, 55, 65, 75, 85, 92];
  const flameSizes = [1.2, 1.5, 1, 1.8, 1.3, 1.6, 1.1, 1.4, 1.7];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #1a1a2e 60%, #e94560 200%)',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(233,69,96,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(233,69,96,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating flame emojis */}
      {isActive &&
        flamePositions.map((x, i) => (
          <FloatingFlame
            key={i}
            delay={i * 0.5}
            x={x}
            size={flameSizes[i]}
          />
        ))}

      {/* Main content */}
      <AnimatePresence mode="wait">
        {(animationState === 'entering' || animationState === 'active') && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6 sm:gap-8"
          >
            {/* Title */}
            <motion.div variants={itemVariants} className="text-center">
              <motion.p
                className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-rose-400/80"
                initial={{ opacity: 0, letterSpacing: '0.1em' }}
                animate={{ opacity: 1, letterSpacing: '0.3em' }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Your Streaks
              </motion.p>
              <h2
                className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl"
                style={{
                  background:
                    'linear-gradient(135deg, #ffffff 0%, #e94560 50%, #ff6b6b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                On Fire 🔥
              </h2>
            </motion.div>

            {/* Longest Streak — Hero stat */}
            <motion.div
              variants={itemVariants}
              className="relative flex w-full flex-col items-center"
            >
              <div className="relative flex flex-col items-center rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-rose-900/20 px-8 py-8 backdrop-blur-sm sm:px-12 sm:py-10">
                {/* Flame ring behind the number */}
                <div className="relative mb-3 h-32 w-32 sm:h-40 sm:w-40">
                  <FlameRing />
                  <FlameRing delay={0.5} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl font-black text-white sm:text-6xl md:text-7xl">
                      {isActive ? (
                        <AnimatedCounter
                          target={streaks.longestStreak.length}
                          duration={2000}
                          delay={500}
                        />
                      ) : (
                        '0'
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-rose-400">
                      days
                    </p>
                  </div>
                </div>

                <p className="mb-1 text-lg font-bold text-white sm:text-xl">
                  Longest Streak
                </p>
                <p className="text-center text-sm text-rose-300/70">
                  {formatDateRange(
                    streaks.longestStreak.startDate,
                    streaks.longestStreak.endDate
                  )}
                </p>
                <p className="mt-2 text-xs text-white/50">
                  {streaks.longestStreak.totalCommits.toLocaleString()} commits during this
                  streak
                </p>
              </div>
            </motion.div>

            {/* Stats grid */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Current Streak */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur-sm"
              >
                <motion.div
                  className="mb-2 text-2xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                >
                  ⚡
                </motion.div>
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isActive ? (
                    <AnimatedCounter
                      target={streaks.currentStreak.length}
                      duration={1500}
                      delay={800}
                    />
                  ) : (
                    '0'
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Current Streak
                </p>
                {streaks.currentStreak.length > 0 && (
                  <p className="mt-1 text-[10px] text-rose-400/60">
                    Since {formatDate(streaks.currentStreak.startDate)}
                  </p>
                )}
              </motion.div>

              {/* Biggest Single-Day Push */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur-sm"
              >
                <motion.div
                  className="mb-2 text-2xl"
                  animate={{
                    y: [0, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  💥
                </motion.div>
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isActive ? (
                    <AnimatedCounter
                      target={streaks.mostCommitsInDay.count}
                      duration={1500}
                      delay={1100}
                    />
                  ) : (
                    '0'
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Commits in One Day
                </p>
                <p className="mt-1 text-[10px] text-rose-400/60">
                  {formatDate(streaks.mostCommitsInDay.date)}
                </p>
              </motion.div>

              {/* Weekend Warrior */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur-sm"
              >
                <motion.div
                  className="mb-2 text-2xl"
                  animate={{
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  🏋️
                </motion.div>
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isActive ? (
                    <AnimatedCounter
                      target={weekendPercentage}
                      duration={1500}
                      delay={1400}
                      suffix="%"
                    />
                  ) : (
                    '0%'
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Weekend Commits
                </p>
                <p className="mt-1 text-[10px] text-rose-400/60">
                  {weekendPercentage > 30 ? 'Weekend Warrior' : 'Weekday Grinder'}
                </p>
              </motion.div>
            </div>

            {/* Top Streaks mini-list */}
            {streaks.topStreaks && streaks.topStreaks.length > 1 && (
              <motion.div
                variants={itemVariants}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm sm:px-6"
              >
                <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-white/40">
                  Top Streaks
                </p>
                <div className="flex flex-col gap-2">
                  {streaks.topStreaks.slice(0, 4).map((streak, i) => (
                    <motion.div
                      key={`${streak.startDate}-${i}`}
                      className="flex items-center justify-between gap-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.8 + i * 0.15, duration: 0.4 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔥'}
                        </span>
                        <span className="text-xs text-white/60">
                          {formatDateRange(streak.startDate, streak.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/40">
                          {streak.totalCommits} commits
                        </span>
                        <span className="min-w-[3rem] text-right text-sm font-bold text-rose-400">
                          {streak.length}d
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Most commits in a day — repos breakdown */}
            {streaks.mostCommitsInDay.repos && streaks.mostCommitsInDay.repos.length > 0 && (
              <motion.p
                variants={itemVariants}
                className="text-center text-xs text-white/30"
              >
                That epic day touched{' '}
                <span className="font-semibold text-white/50">
                  {streaks.mostCommitsInDay.repos.join(', ')}
                </span>
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
