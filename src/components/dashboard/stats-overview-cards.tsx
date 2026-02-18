'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  GitCommit,
  FolderGit2,
  Plus,
  Minus,
  CalendarDays,
  Flame,
} from 'lucide-react';
import type { TotalStats, StreakData } from '@/lib/types';

// ─── Animated Counter ────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 1800): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

// ─── Sparkline Mini-Chart ────────────────────────────────────────────
function Sparkline({
  data,
  color,
  width = 80,
  height = 28,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;
  const areaPath = `${pathData} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient
          id={`spark-fill-${color.replace('#', '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#spark-fill-${color.replace('#', '')})`}
      />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot at end */}
      <circle
        cx={width}
        cy={
          height -
          ((data[data.length - 1] - min) / range) * (height - 4) -
          2
        }
        r={2}
        fill={color}
      />
    </svg>
  );
}

// ─── Format number with commas ───────────────────────────────────────
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Single Stat Card ────────────────────────────────────────────────
interface StatCardConfig {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  sparklineData: number[];
  sparklineColor: string;
  variant: 'default' | 'success' | 'danger' | 'info' | 'warning' | 'fire';
  suffix?: string;
}

function StatCard({ config }: { config: StatCardConfig }) {
  const animatedValue = useAnimatedCounter(config.value, 2000);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cardRef}>
      <Card
        className={`relative overflow-hidden border border-white/[0.06] bg-gradient-to-br transition-all duration-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 ${
          isVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0'
        }`}
        style={{
          backgroundImage: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})`,
        }}
      >
        {/* Subtle glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

        <div className="relative p-5 sm:p-6">
          {/* Header: icon and sparkline */}
          <div className="flex items-start justify-between mb-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.08] backdrop-blur-sm"
            >
              {config.icon}
            </div>
            <div className="opacity-70 hover:opacity-100 transition-opacity">
              <Sparkline
                data={config.sparklineData}
                color={config.sparklineColor}
              />
            </div>
          </div>

          {/* Value */}
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
              {formatNumber(isVisible ? animatedValue : 0)}
            </span>
            {config.suffix && (
              <span className="text-sm text-white/50 ml-1">{config.suffix}</span>
            )}
          </div>

          {/* Label */}
          <p className="text-sm text-white/60 mt-1 font-medium">
            {config.label}
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.sparklineColor}40, transparent)`,
          }}
        />
      </Card>
    </div>
  );
}

// ─── Generate sparkline data ─────────────────────────────────────────
function generateSparklineFromValue(value: number, points = 12): number[] {
  // Create a realistic-looking trend line based on the value
  const data: number[] = [];
  const base = value * 0.3;
  const amplitude = value * 0.15;

  for (let i = 0; i < points; i++) {
    const trend = (i / points) * value * 0.4;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * amplitude;
    data.push(Math.max(0, base + trend + noise));
  }

  return data;
}

// ─── Main Component ──────────────────────────────────────────────────
export interface StatsOverviewCardsProps {
  totals: TotalStats | null;
  streaks: StreakData | null;
}

export function StatsOverviewCards({
  totals,
  streaks,
}: StatsOverviewCardsProps) {
  const stats = useMemo((): StatCardConfig[] => {
    const t = totals ?? {
      totalCommits: 0,
      totalRepos: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      activeDays: 0,
      totalFilesChanged: 0,
      uniqueContributors: 0,
      avgCommitsPerDay: 0,
      avgCommitsPerWeek: 0,
    };

    const longestStreak = streaks?.longestStreak?.length ?? 0;

    return [
      {
        label: 'Total Commits',
        value: t.totalCommits,
        icon: <GitCommit className="w-5 h-5 text-blue-400" />,
        gradientFrom: 'rgba(30, 58, 138, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(t.totalCommits),
        sparklineColor: '#60a5fa',
        variant: 'default' as const,
      },
      {
        label: 'Repositories Analyzed',
        value: t.totalRepos,
        icon: <FolderGit2 className="w-5 h-5 text-violet-400" />,
        gradientFrom: 'rgba(88, 28, 135, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(t.totalRepos, 8),
        sparklineColor: '#a78bfa',
        variant: 'info' as const,
      },
      {
        label: 'Lines Added',
        value: t.totalAdditions,
        icon: <Plus className="w-5 h-5 text-emerald-400" />,
        gradientFrom: 'rgba(6, 78, 59, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(t.totalAdditions),
        sparklineColor: '#34d399',
        variant: 'success' as const,
      },
      {
        label: 'Lines Removed',
        value: t.totalDeletions,
        icon: <Minus className="w-5 h-5 text-rose-400" />,
        gradientFrom: 'rgba(127, 29, 29, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(t.totalDeletions),
        sparklineColor: '#fb7185',
        variant: 'danger' as const,
      },
      {
        label: 'Active Days',
        value: t.activeDays,
        icon: <CalendarDays className="w-5 h-5 text-amber-400" />,
        gradientFrom: 'rgba(120, 53, 15, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(t.activeDays),
        sparklineColor: '#fbbf24',
        variant: 'warning' as const,
      },
      {
        label: 'Longest Streak',
        value: longestStreak,
        icon: <Flame className="w-5 h-5 text-orange-400" />,
        gradientFrom: 'rgba(154, 52, 18, 0.5)',
        gradientTo: 'rgba(15, 23, 42, 0.8)',
        sparklineData: generateSparklineFromValue(longestStreak, 10),
        sparklineColor: '#fb923c',
        variant: 'fire' as const,
        suffix: 'days',
      },
    ];
  }, [totals, streaks]);

  return (
    <section aria-label="Stats Overview">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <StatCard config={stat} />
          </div>
        ))}
      </div>
    </section>
  );
}
