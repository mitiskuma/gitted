'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type {
  WrappedSlideProps,
  YearOverYearData,
  YearStats,
  YearGrowth,
} from '@/lib/types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  GitCommit,
  Code2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface AnimatedCounterProps {
  target: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  isActive: boolean;
}

function AnimatedCounter({
  target,
  duration = 1500,
  delay = 0,
  suffix = '',
  prefix = '',
  isActive,
}: AnimatedCounterProps) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setCurrent(0);
      return;
    }

    const startTime = performance.now() + delay;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay, isActive]);

  return (
    <span>
      {prefix}
      {current.toLocaleString()}
      {suffix}
    </span>
  );
}

interface ComparisonBarProps {
  label: string;
  valueA: number;
  valueB: number;
  yearA: number;
  yearB: number;
  isActive: boolean;
  delay: number;
  color: string;
}

function ComparisonBar({
  label,
  valueA,
  valueB,
  yearA,
  yearB,
  isActive,
  delay,
  color,
}: ComparisonBarProps) {
  const maxVal = Math.max(valueA, valueB, 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
      transition={{ duration: 0.5, delay }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <GrowthBadge current={valueB} previous={valueA} isActive={isActive} delay={delay + 0.3} />
      </div>

      {/* Year A bar */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-10 shrink-0">{yearA}</span>
          <div className="flex-1 h-7 rounded-md bg-white/5 overflow-hidden relative">
            <motion.div
              className="h-full rounded-md flex items-center px-2"
              style={{
                background: `linear-gradient(90deg, ${color}66, ${color}33)`,
              }}
              initial={{ width: 0 }}
              animate={isActive ? { width: `${(valueA / maxVal) * 100}%` } : { width: 0 }}
              transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
            >
              <span className="text-xs font-semibold text-white/90 whitespace-nowrap">
                {isActive && <AnimatedCounter target={valueA} isActive={isActive} delay={(delay + 0.2) * 1000} duration={800} />}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Year B bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-10 shrink-0">{yearB}</span>
          <div className="flex-1 h-7 rounded-md bg-white/5 overflow-hidden relative">
            <motion.div
              className="h-full rounded-md flex items-center px-2"
              style={{
                background: `linear-gradient(90deg, ${color}, ${color}99)`,
              }}
              initial={{ width: 0 }}
              animate={isActive ? { width: `${(valueB / maxVal) * 100}%` } : { width: 0 }}
              transition={{ duration: 0.8, delay: delay + 0.4, ease: 'easeOut' }}
            >
              <span className="text-xs font-semibold text-white whitespace-nowrap">
                {isActive && <AnimatedCounter target={valueB} isActive={isActive} delay={(delay + 0.4) * 1000} duration={800} />}
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GrowthBadge({
  current,
  previous,
  isActive,
  delay,
}: {
  current: number;
  previous: number;
  isActive: boolean;
  delay: number;
}) {
  if (previous === 0 && current === 0) return null;

  const growthPercent =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 100);

  const isPositive = growthPercent > 0;
  const isNeutral = growthPercent === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.4, delay }}
    >
      <Badge
        variant="outline"
        className={`
          text-xs font-bold border-0 px-2 py-0.5
          ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : ''}
          ${!isPositive && !isNeutral ? 'bg-red-500/20 text-red-400' : ''}
          ${isNeutral ? 'bg-white/10 text-white/60' : ''}
        `}
      >
        {isPositive && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
        {!isPositive && !isNeutral && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
        {isNeutral && <Minus className="w-3 h-3 mr-0.5" />}
        {isPositive ? '+' : ''}
        {growthPercent}%
      </Badge>
    </motion.div>
  );
}

function GrowthSummaryCard({
  growth,
  isActive,
  delay,
}: {
  growth: YearGrowth;
  isActive: boolean;
  delay: number;
}) {
  const metrics = [
    {
      label: 'Commits',
      value: growth.commitGrowth,
      icon: GitCommit,
    },
    {
      label: 'Active Days',
      value: growth.activeDaysGrowth,
      icon: Calendar,
    },
    {
      label: 'Lines Changed',
      value: growth.linesGrowth,
      icon: Code2,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay }}
      className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm"
    >
      <div className="text-center mb-3">
        <p className="text-xs text-white/50 uppercase tracking-wider">
          {growth.fromYear} → {growth.toYear}
        </p>
        <p className="text-sm font-medium text-white/70 mt-0.5">Year-over-Year Growth</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric, i) => {
          const isPositive = metric.value > 0;
          const isNeutral = metric.value === 0;
          const Icon = metric.icon;

          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, delay: delay + 0.2 + i * 0.1 }}
              className="text-center"
            >
              <div
                className={`
                  w-10 h-10 rounded-xl mx-auto mb-1.5 flex items-center justify-center
                  ${isPositive ? 'bg-emerald-500/20' : ''}
                  ${!isPositive && !isNeutral ? 'bg-red-500/20' : ''}
                  ${isNeutral ? 'bg-white/10' : ''}
                `}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isPositive
                      ? 'text-emerald-400'
                      : !isNeutral
                        ? 'text-red-400'
                        : 'text-white/50'
                  }`}
                />
              </div>
              <p
                className={`text-lg font-bold ${
                  isPositive
                    ? 'text-emerald-400'
                    : !isNeutral
                      ? 'text-red-400'
                      : 'text-white/60'
                }`}
              >
                {isPositive ? '+' : ''}
                {Math.round(metric.value)}%
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{metric.label}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function NoMultiYearData({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
          <Calendar className="w-10 h-10 text-white/40" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">One Year of Data</h3>
        <p className="text-white/50 text-base max-w-sm mx-auto">
          Keep pushing code and come back next year to see how you&apos;ve grown.
          Multi-year comparison unlocks after your second year.
        </p>
      </motion.div>
    </div>
  );
}

export function YearlyComparisonSlide({
  data,
  isActive,
  animationState,
  onAnimationComplete,
}: WrappedSlideProps) {
  const yearOverYear = data.yearOverYear;
  const hasMultiYear = yearOverYear.hasMultipleYears && yearOverYear.years.length >= 2;

  useEffect(() => {
    if (animationState === 'entering') {
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [animationState, onAnimationComplete]);

  if (!hasMultiYear) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#240046] via-[#3c096c] to-[#240046]" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full">
          <NoMultiYearData isActive={isActive} />
        </div>
      </div>
    );
  }

  // Get the last two years for primary comparison
  const sortedYears = [...yearOverYear.years].sort((a, b) => a.year - b.year);
  const prevYear = sortedYears[sortedYears.length - 2];
  const currYear = sortedYears[sortedYears.length - 1];
  const latestGrowth =
    yearOverYear.growth.length > 0
      ? yearOverYear.growth[yearOverYear.growth.length - 1]
      : null;

  // Determine overall trend
  const overallTrend = latestGrowth
    ? latestGrowth.commitGrowth > 10
      ? 'surging'
      : latestGrowth.commitGrowth > 0
        ? 'growing'
        : latestGrowth.commitGrowth === 0
          ? 'steady'
          : latestGrowth.commitGrowth > -10
            ? 'dipping'
            : 'declining'
    : 'steady';

  const trendEmoji =
    overallTrend === 'surging'
      ? '🚀'
      : overallTrend === 'growing'
        ? '📈'
        : overallTrend === 'steady'
          ? '➡️'
          : overallTrend === 'dipping'
            ? '📉'
            : '⬇️';

  const trendMessage =
    overallTrend === 'surging'
      ? 'You went absolutely beast mode'
      : overallTrend === 'growing'
        ? 'Steady growth, solid consistency'
        : overallTrend === 'steady'
          ? 'Consistent as ever'
          : overallTrend === 'dipping'
            ? 'A quieter year, but quality counts'
            : 'Sometimes less is more';

  const comparisonMetrics = [
    {
      label: 'Total Commits',
      valueA: prevYear.commits,
      valueB: currYear.commits,
      color: '#a78bfa',
    },
    {
      label: 'Active Days',
      valueA: prevYear.activeDays,
      valueB: currYear.activeDays,
      color: '#60a5fa',
    },
    {
      label: 'Lines Added',
      valueA: prevYear.additions,
      valueB: currYear.additions,
      color: '#34d399',
    },
    {
      label: 'Lines Deleted',
      valueA: prevYear.deletions,
      valueB: currYear.deletions,
      color: '#f97316',
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#240046] via-[#3c096c] to-[#240046]" />

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-10 right-10 w-72 h-72 rounded-full bg-purple-500/15 blur-[100px]"
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 30, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-violet-600/10 blur-[120px]"
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 20, -30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-fuchsia-500/8 blur-[80px]"
          animate={{
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-6 py-8 md:px-12 md:py-12 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8 shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-purple-300/70 mb-2">
              Year-over-Year
            </p>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-violet-300"
          >
            {prevYear.year} vs {currYear.year}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isActive ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-2 mt-3"
          >
            <span className="text-2xl">{trendEmoji}</span>
            <p className="text-sm md:text-base text-white/60 italic">{trendMessage}</p>
          </motion.div>
        </div>

        {/* Comparison Bars */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 mb-6 scrollbar-hide">
          {comparisonMetrics.map((metric, i) => (
            <ComparisonBar
              key={metric.label}
              label={metric.label}
              valueA={metric.valueA}
              valueB={metric.valueB}
              yearA={prevYear.year}
              yearB={currYear.year}
              isActive={isActive}
              delay={0.3 + i * 0.15}
              color={metric.color}
            />
          ))}

          {/* Repos contributed comparison */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                <Flame className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Repos Contributed</p>
                <p className="text-xs text-white/40">
                  {prevYear.repoCount} → {currYear.repoCount}
                </p>
              </div>
            </div>
            <GrowthBadge
              current={currYear.repoCount}
              previous={prevYear.repoCount}
              isActive={isActive}
              delay={1.1}
            />
          </motion.div>

          {/* Top language comparison */}
          {(prevYear.topLanguage || currYear.topLanguage) && (
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Top Language</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {prevYear.topLanguage && (
                      <Badge variant="outline" className="text-[10px] bg-white/5 border-white/20 text-white/60">
                        {prevYear.year}: {prevYear.topLanguage}
                      </Badge>
                    )}
                    {currYear.topLanguage && (
                      <Badge variant="outline" className="text-[10px] bg-purple-500/20 border-purple-400/30 text-purple-300">
                        {currYear.year}: {currYear.topLanguage}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {prevYear.topLanguage !== currYear.topLanguage && currYear.topLanguage && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                  transition={{ duration: 0.4, delay: 1.3 }}
                  className="text-lg"
                >
                  🔄
                </motion.span>
              )}
            </motion.div>
          )}
        </div>

        {/* Growth Summary Card */}
        {latestGrowth && (
          <div className="shrink-0">
            <GrowthSummaryCard growth={latestGrowth} isActive={isActive} delay={1.2} />
          </div>
        )}

        {/* Multi-year timeline (if more than 2 years) */}
        {sortedYears.length > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 1.5 }}
            className="mt-4 shrink-0"
          >
            <p className="text-xs text-white/40 uppercase tracking-wider text-center mb-3">
              Commit Trend Over the Years
            </p>
            <div className="flex items-end justify-center gap-3 h-16">
              {sortedYears.map((year, i) => {
                const maxCommits = Math.max(...sortedYears.map((y) => y.commits), 1);
                const heightPercent = (year.commits / maxCommits) * 100;

                return (
                  <motion.div
                    key={year.year}
                    className="flex flex-col items-center gap-1"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={
                      isActive
                        ? { opacity: 1, scaleY: 1 }
                        : { opacity: 0, scaleY: 0 }
                    }
                    transition={{ duration: 0.5, delay: 1.6 + i * 0.1 }}
                    style={{ originY: 1 }}
                  >
                    <span className="text-[10px] text-white/50 font-medium">
                      {year.commits}
                    </span>
                    <div
                      className="w-8 md:w-10 rounded-t-md"
                      style={{
                        height: `${Math.max(heightPercent * 0.5, 4)}px`,
                        background:
                          i === sortedYears.length - 1
                            ? 'linear-gradient(to top, #a78bfa, #7c3aed)'
                            : 'linear-gradient(to top, rgba(167,139,250,0.3), rgba(167,139,250,0.15))',
                      }}
                    />
                    <span
                      className={`text-[10px] font-semibold ${
                        i === sortedYears.length - 1
                          ? 'text-purple-300'
                          : 'text-white/40'
                      }`}
                    >
                      {year.year}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
