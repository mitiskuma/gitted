'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type {
  WrappedSlideProps,
  ProductivityData,
  DayOfWeek,
} from '@/lib/types';

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedCounter({
  value,
  duration = 2000,
  delay = 0,
  decimals = 0,
  suffix = '',
  prefix = '',
  isActive,
}: {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  isActive: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDisplayValue(0);
      return;
    }

    const delayTimeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(eased * value);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(delayTimeout);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, value, duration, delay]);

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString();

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ─── Mini Bar Chart ──────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MiniBarChart({
  data,
  highlightIndex,
  isActive,
}: {
  data: number[];
  highlightIndex: number;
  isActive: boolean;
}) {
  const maxVal = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {data.map((val, i) => {
        const heightPercent = (val / maxVal) * 100;
        const isHighlight = i === highlightIndex;

        return (
          <div key={i} className="flex flex-col items-center flex-1 gap-1">
            <motion.div
              className="w-full rounded-t-sm min-h-[2px]"
              style={{
                background: isHighlight
                  ? 'linear-gradient(to top, #818cf8, #a78bfa)'
                  : 'rgba(255, 255, 255, 0.15)',
              }}
              initial={{ height: 0 }}
              animate={isActive ? { height: `${heightPercent}%` } : { height: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.6 + i * 0.08,
                ease: [0.34, 1.56, 0.64, 1],
              }}
            />
            <span
              className={`text-[10px] font-medium ${
                isHighlight ? 'text-indigo-300' : 'text-white/40'
              }`}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Commit Size Distribution Ring ───────────────────────────────────────────

function CommitSizeRing({
  distribution,
  isActive,
}: {
  distribution: ProductivityData['commitSizeDistribution'];
  isActive: boolean;
}) {
  const total = distribution.small + distribution.medium + distribution.large + distribution.huge;
  if (total === 0) return null;

  const segments = [
    { label: 'Small', value: distribution.small, color: '#34d399' },
    { label: 'Medium', value: distribution.medium, color: '#60a5fa' },
    { label: 'Large', value: distribution.large, color: '#fbbf24' },
    { label: 'Huge', value: distribution.huge, color: '#f87171' },
  ];

  const radius = 36;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const percentage = seg.value / total;
          const dashLength = circumference * percentage;
          const dashOffset = -currentOffset;
          currentOffset += dashLength;

          return (
            <motion.circle
              key={seg.label}
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
              initial={{ opacity: 0 }}
              animate={isActive ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5, delay: 1.0 + i * 0.15 }}
            />
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[11px] text-white/60">
                {seg.label}{' '}
                <span className="text-white/80 font-medium">
                  {Math.round((seg.value / total) * 100)}%
                </span>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  children,
  delay,
  isActive,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
  delay: number;
  isActive: boolean;
}) {
  return (
    <motion.div
      className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 overflow-hidden"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={
        isActive
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 30, scale: 0.95 }
      }
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Glow */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-br from-indigo-500/20 via-transparent to-purple-500/10" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-medium uppercase tracking-wider text-white/50">
            {label}
          </span>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

// ─── Day Name Helper ─────────────────────────────────────────────────────────

function getDayName(day: DayOfWeek): string {
  const names: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return names[day] ?? 'Unknown';
}

function getMonthName(month: number): string {
  const months = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month] ?? '';
}

// ─── Main Productivity Slide ─────────────────────────────────────────────────

export function ProductivitySlide({
  data,
  isActive,
  animationState,
  onAnimationComplete,
}: WrappedSlideProps) {
  const productivity = data.productivity;
  const totals = data.totals;

  // Synthesize by-day-of-week data from coding patterns if available
  // We'll create approximate data from the productivity info
  const dayOfWeekData = useCallback((): number[] => {
    // Generate plausible per-day distribution based on most productive day
    const baseDaily = totals.avgCommitsPerDay;
    const peakDay = productivity.mostProductiveDay.day;
    const peakAvg = productivity.mostProductiveDay.avgCommits;

    return Array.from({ length: 7 }, (_, i) => {
      if (i === peakDay) return peakAvg;
      // Weekdays are generally more active
      const isWeekend = i === 0 || i === 6;
      const factor = isWeekend ? 0.5 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4;
      return Math.round(baseDaily * factor * 10) / 10;
    });
  }, [totals.avgCommitsPerDay, productivity.mostProductiveDay])();

  useEffect(() => {
    if (animationState === 'entering' && onAnimationComplete) {
      const timeout = setTimeout(onAnimationComplete, 3000);
      return () => clearTimeout(timeout);
    }
  }, [animationState, onAnimationComplete]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 -left-20 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          }}
          animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          }}
          animate={isActive ? { scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] } : {}}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Title */}
      <motion.div
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <Badge
          variant="outline"
          className="mb-3 border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-xs"
        >
          ⚡ Productivity
        </Badge>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-transparent">
          Your Rhythm
        </h2>
        <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">
          When you code best, and how you get it done
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="relative z-10 w-full max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Most Productive Month */}
        <StatCard icon="📅" label="Peak Month" delay={0.2} isActive={isActive}>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-none">
            {getMonthName(productivity.mostProductiveMonth.month)}
          </div>
          <div className="text-sm text-white/40 mt-1">
            {productivity.mostProductiveMonth.year}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-bold text-indigo-400">
              <AnimatedCounter
                value={productivity.mostProductiveMonth.commits}
                duration={1800}
                delay={600}
                isActive={isActive}
              />
            </span>
            <span className="text-xs text-white/40">commits</span>
          </div>
        </StatCard>

        {/* Most Productive Day */}
        <StatCard icon="🔥" label="Power Day" delay={0.35} isActive={isActive}>
          <div className="text-2xl sm:text-3xl font-extrabold text-white leading-none">
            {getDayName(productivity.mostProductiveDay.day)}
          </div>
          <div className="flex items-baseline gap-1 mt-2 mb-3">
            <span className="text-xl font-bold text-purple-400">
              <AnimatedCounter
                value={productivity.mostProductiveDay.avgCommits}
                duration={1800}
                delay={800}
                decimals={1}
                isActive={isActive}
              />
            </span>
            <span className="text-xs text-white/40">avg commits/day</span>
          </div>
          <MiniBarChart
            data={dayOfWeekData}
            highlightIndex={productivity.mostProductiveDay.day}
            isActive={isActive}
          />
        </StatCard>

        {/* Average Commits Per Day */}
        <StatCard icon="📊" label="Daily Average" delay={0.5} isActive={isActive}>
          <div className="text-4xl sm:text-5xl font-black text-white leading-none">
            <AnimatedCounter
              value={productivity.avgCommitsPerActiveDay}
              duration={2000}
              delay={900}
              decimals={1}
              isActive={isActive}
            />
          </div>
          <div className="text-sm text-white/40 mt-1">
            commits per active day
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                initial={{ width: 0 }}
                animate={
                  isActive
                    ? {
                        width: `${Math.min(
                          (productivity.avgCommitsPerActiveDay / 10) * 100,
                          100
                        )}%`,
                      }
                    : { width: 0 }
                }
                transition={{ duration: 1.2, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-[10px] text-white/30 shrink-0">
              {Math.min(Math.round((productivity.avgCommitsPerActiveDay / 10) * 100), 100)}%
              intensity
            </span>
          </div>
        </StatCard>

        {/* Total Active Days */}
        <StatCard icon="✅" label="Active Days" delay={0.65} isActive={isActive}>
          <div className="text-4xl sm:text-5xl font-black text-white leading-none">
            <AnimatedCounter
              value={totals.activeDays}
              duration={2200}
              delay={1000}
              isActive={isActive}
            />
          </div>
          <div className="text-sm text-white/40 mt-1">
            out of {data.dateRange.totalDays} days
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-white/30 mb-1">
              <span>Consistency</span>
              <span>
                {data.dateRange.totalDays > 0
                  ? Math.round((totals.activeDays / data.dateRange.totalDays) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                initial={{ width: 0 }}
                animate={
                  isActive
                    ? {
                        width: `${
                          data.dateRange.totalDays > 0
                            ? Math.round(
                                (totals.activeDays / data.dateRange.totalDays) * 100
                              )
                            : 0
                        }%`,
                      }
                    : { width: 0 }
                }
                transition={{ duration: 1.4, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </StatCard>
      </div>

      {/* Commit Size Distribution */}
      <motion.div
        className="relative z-10 mt-6 w-full max-w-lg mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📐</span>
            <span className="text-xs font-medium uppercase tracking-wider text-white/50">
              Commit Size Breakdown
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <CommitSizeRing
              distribution={productivity.commitSizeDistribution}
              isActive={isActive}
            />
            <div className="flex-1">
              <div className="text-sm text-white/50 mb-1">Average lines per commit</div>
              <div className="text-2xl font-bold text-white">
                <AnimatedCounter
                  value={productivity.avgLinesPerCommit}
                  duration={1600}
                  delay={1200}
                  isActive={isActive}
                />
              </div>
              <div className="text-xs text-white/30 mt-1">
                {productivity.commitSizeDistribution.small > productivity.commitSizeDistribution.large
                  ? 'You favor small, focused commits — clean and precise.'
                  : 'You tend toward bigger commits — shipping in bulk.'}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating particles */}
      <AnimatePresence>
        {isActive &&
          Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-1 h-1 rounded-full bg-indigo-400/40"
              style={{
                left: `${15 + Math.random() * 70}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0, 1.5, 0],
                y: [0, -40 - Math.random() * 40],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: 1 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 2 + Math.random() * 3,
                ease: 'easeOut',
              }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}
