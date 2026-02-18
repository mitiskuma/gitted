'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { WrappedSlideProps, MonthStats } from '@/lib/types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_EMOJIS = [
  '❄️', '💝', '🌱', '🌸', '☀️', '🔥',
  '🏖️', '⚡', '🍂', '🎃', '🍁', '🎄',
];

function AnimatedCounter({ target, duration = 1200, delay = 0 }: { target: number; duration?: number; delay?: number }) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return <span>{count.toLocaleString()}</span>;
}

function CircularProgress({
  percentage,
  size = 80,
  strokeWidth = 6,
  color,
  delay = 0,
  isPeak = false,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  delay?: number;
  isPeak?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="transform -rotate-90"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: 'backOut' }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - percentage / 100) }}
        transition={{ delay: delay + 0.3, duration: 1.2, ease: 'easeOut' }}
        style={{
          filter: isPeak ? `drop-shadow(0 0 8px ${color})` : undefined,
        }}
      />
      {/* Glow for peak */}
      {isPeak && (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - percentage / 100) }}
          transition={{ delay: delay + 0.3, duration: 1.2, ease: 'easeOut' }}
          opacity={0.3}
          style={{ filter: `blur(4px)` }}
        />
      )}
    </motion.svg>
  );
}

function MonthCard({
  month,
  maxCommits,
  isPeak,
  index,
}: {
  month: MonthStats;
  maxCommits: number;
  isPeak: boolean;
  index: number;
}) {
  const percentage = maxCommits > 0 ? (month.commits / maxCommits) * 100 : 0;
  const monthIndex = month.month - 1;
  const color = isPeak
    ? '#fbbf24'
    : `hsl(${220 + index * 12}, ${60 + percentage * 0.3}%, ${50 + percentage * 0.2}%)`;

  return (
    <motion.div
      className={`relative flex flex-col items-center gap-1.5 rounded-xl p-2 sm:p-3 transition-all ${
        isPeak
          ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30'
          : 'bg-white/5 hover:bg-white/8'
      }`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: 'backOut' }}
      whileHover={{ scale: 1.05 }}
    >
      {isPeak && (
        <motion.div
          className="absolute -top-2.5 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + index * 0.08, type: 'spring', bounce: 0.6 }}
        >
          <Badge className="bg-yellow-500 text-black text-[10px] px-1.5 py-0 font-bold border-0">
            PEAK
          </Badge>
        </motion.div>
      )}

      <div className="relative flex items-center justify-center">
        <CircularProgress
          percentage={percentage}
          size={56}
          strokeWidth={4}
          color={color}
          delay={0.2 + index * 0.08}
          isPeak={isPeak}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs sm:text-sm font-bold text-white/90">
            <AnimatedCounter target={month.commits} delay={400 + index * 80} duration={800} />
          </span>
        </div>
      </div>

      <div className="text-center space-y-0.5">
        <p className={`text-xs font-semibold ${isPeak ? 'text-yellow-400' : 'text-white/80'}`}>
          {MONTH_NAMES[monthIndex]}
        </p>
        <p className="text-[10px] text-white/40">{MONTH_EMOJIS[monthIndex]}</p>
      </div>

      {month.topRepo && (
        <motion.p
          className="text-[9px] text-white/30 truncate max-w-full text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 + index * 0.08 }}
          title={month.topRepo}
        >
          {month.topRepo.split('/').pop()}
        </motion.p>
      )}
    </motion.div>
  );
}

function BarChart({
  months,
  maxCommits,
  peakIndex,
}: {
  months: MonthStats[];
  maxCommits: number;
  peakIndex: number;
}) {
  return (
    <div className="flex items-end gap-1 sm:gap-1.5 h-32 sm:h-40 w-full px-2">
      {months.map((month, index) => {
        const height = maxCommits > 0 ? (month.commits / maxCommits) * 100 : 0;
        const isPeak = index === peakIndex;
        const monthIndex = month.month - 1;

        return (
          <div key={`${month.year}-${month.month}`} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t-sm relative overflow-hidden min-h-[2px]"
              style={{
                background: isPeak
                  ? 'linear-gradient(to top, #f59e0b, #fbbf24)'
                  : `linear-gradient(to top, hsl(${240 + index * 8}, 60%, 40%), hsl(${240 + index * 8}, 70%, 55%))`,
              }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(height, 2)}%` }}
              transition={{
                delay: 0.3 + index * 0.06,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {isPeak && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/10"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
            <motion.span
              className={`text-[9px] sm:text-[10px] ${isPeak ? 'text-yellow-400 font-bold' : 'text-white/40'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.06 }}
            >
              {MONTH_NAMES[monthIndex]}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyBreakdownSlide({
  data,
  isActive,
  animationState,
  onAnimationComplete,
}: WrappedSlideProps) {
  const [showDetail, setShowDetail] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthlyData = data.monthlyBreakdown;
  const months = monthlyData.months;
  const peakIndex = monthlyData.peakMonthIndex;
  const peakMonth = months[peakIndex] || null;
  const maxCommits = peakMonth ? peakMonth.commits : 1;

  // Show detail view after initial animation
  useEffect(() => {
    if (isActive && animationState === 'active') {
      const timeout = setTimeout(() => setShowDetail(true), 1800);
      return () => clearTimeout(timeout);
    } else {
      setShowDetail(false);
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

  // Calculate total for the year
  const totalCommits = months.reduce((sum, m) => sum + m.commits, 0);
  const totalActiveDays = months.reduce((sum, m) => sum + m.activeDays, 0);

  // Determine quiet months (bottom 3)
  const sortedByCommits = [...months].sort((a, b) => a.commits - b.commits);
  const quietestMonth = sortedByCommits[0];

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center w-full h-full px-4 sm:px-8 py-8 sm:py-12 relative overflow-hidden"
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #190061 0%, transparent 70%)',
          }}
        />
        {peakMonth && (
          <motion.div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        )}
      </div>

      {/* Title */}
      <motion.div
        className="text-center mb-6 sm:mb-8 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.p
          className="text-xs sm:text-sm font-medium tracking-widest uppercase text-white/50 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Month by Month
        </motion.p>
        <motion.h2
          className="text-2xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Your {data.wrappedYear} Timeline
        </motion.h2>
      </motion.div>

      {/* Bar Chart */}
      <motion.div
        className="w-full max-w-lg relative z-10 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <BarChart months={months} maxCommits={maxCommits} peakIndex={peakIndex} />
      </motion.div>

      {/* Peak Month Highlight */}
      {peakMonth && (
        <motion.div
          className="text-center mb-6 relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-2">
            <motion.span
              className="text-lg"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ delay: 1.5, duration: 0.6 }}
            >
              🏆
            </motion.span>
            <span className="text-sm font-semibold text-yellow-300">
              {MONTH_FULL_NAMES[peakMonth.month - 1]} was your biggest month
            </span>
            <span className="text-sm font-bold text-yellow-400">
              — <AnimatedCounter target={peakMonth.commits} delay={1400} /> commits
            </span>
          </div>
        </motion.div>
      )}

      {/* Month Grid */}
      <motion.div
        className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3 w-full max-w-xl relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {months.map((month, index) => (
          <MonthCard
            key={`${month.year}-${month.month}`}
            month={month}
            maxCommits={maxCommits}
            isPeak={index === peakIndex}
            index={index}
          />
        ))}
      </motion.div>

      {/* Bottom Stats */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-6 sm:mt-8 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-white">
                <AnimatedCounter target={totalCommits} delay={2000} />
              </p>
              <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider">
                Total Commits
              </p>
            </div>

            <div className="w-px h-8 bg-white/10" />

            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-white">
                <AnimatedCounter target={totalActiveDays} delay={2100} />
              </p>
              <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider">
                Active Days
              </p>
            </div>

            <div className="w-px h-8 bg-white/10" />

            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-white">
                <AnimatedCounter target={Math.round(totalCommits / 12)} delay={2200} />
              </p>
              <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider">
                Avg / Month
              </p>
            </div>

            {quietestMonth && quietestMonth.commits > 0 && (
              <>
                <div className="w-px h-8 bg-white/10 hidden sm:block" />
                <motion.div
                  className="text-center hidden sm:block"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5 }}
                >
                  <p className="text-xs text-white/30">
                    Quietest: {MONTH_FULL_NAMES[quietestMonth.month - 1]}{' '}
                    <span className="text-white/50">({quietestMonth.commits})</span>
                  </p>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle floating particles */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-indigo-400/20"
              style={{
                left: `${15 + i * 14}%`,
                top: `${70 + (i % 3) * 10}%`,
              }}
              animate={{
                y: [-20, -60, -20],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.7,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
