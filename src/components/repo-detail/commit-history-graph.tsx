'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CommitData,
  CommitFrequencyPoint,
  TimeGranularity,
} from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function groupCommitsByGranularity(
  commits: CommitData[],
  granularity: 'daily' | 'weekly' | 'monthly'
): CommitFrequencyPoint[] {
  if (!commits.length) return [];

  const sorted = [...commits].sort((a, b) => a.timestampMs - b.timestampMs);
  const buckets = new Map<
    string,
    { count: number; additions: number; deletions: number; date: string }
  >();

  for (const commit of sorted) {
    const d = new Date(commit.timestamp);
    let key: string;
    let label: string;

    if (granularity === 'daily') {
      key = commit.dateKey;
      label = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } else if (granularity === 'weekly') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().slice(0, 10);
      label = `Week of ${weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    }

    const existing = buckets.get(key) ?? {
      count: 0,
      additions: 0,
      deletions: 0,
      date: key,
    };
    existing.count += 1;
    existing.additions += commit.additions;
    existing.deletions += commit.deletions;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => ({
      label: formatLabel(val.date, granularity),
      date: val.date,
      count: val.count,
      additions: val.additions,
      deletions: val.deletions,
    }));
}

function formatLabel(dateStr: string, granularity: string): string {
  if (granularity === 'monthly') {
    const [year, month] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (granularity === 'weekly') {
    const d = new Date(dateStr);
    return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function computeMovingAverage(
  data: CommitFrequencyPoint[],
  window: number
): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += data[j].count;
    }
    return parseFloat((sum / window).toFixed(1));
  });
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: CommitFrequencyPoint & { movingAvg: number | null };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-sm font-medium text-zinc-300">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
            Commits
          </span>
          <span className="text-sm font-semibold text-white">
            {data.count.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Additions
          </span>
          <span className="text-sm font-medium text-emerald-400">
            +{data.additions.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
            Deletions
          </span>
          <span className="text-sm font-medium text-rose-400">
            -{data.deletions.toLocaleString()}
          </span>
        </div>
        {data.movingAvg !== null && data.movingAvg !== undefined && (
          <div className="flex items-center justify-between gap-6 border-t border-white/5 pt-1.5">
            <span className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Moving Avg
            </span>
            <span className="text-sm font-medium text-amber-400">
              {data.movingAvg}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CommitHistoryGraphProps {
  commits: CommitData[];
  repoName?: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CommitHistoryGraph({
  commits,
  repoName,
}: CommitHistoryGraphProps) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>(
    'weekly'
  );
  const [showTrend, setShowTrend] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');

  const data = useMemo(
    () => groupCommitsByGranularity(commits, granularity),
    [commits, granularity]
  );

  const movingAvgWindow = granularity === 'daily' ? 7 : granularity === 'weekly' ? 4 : 3;
  const movingAvgValues = useMemo(
    () => computeMovingAverage(data, movingAvgWindow),
    [data, movingAvgWindow]
  );

  const enrichedData = useMemo(
    () =>
      data.map((point, i) => ({
        ...point,
        movingAvg: movingAvgValues[i],
      })),
    [data, movingAvgValues]
  );

  const stats = useMemo(() => {
    if (!data.length) return null;
    const counts = data.map((d) => d.count);
    const maxCommits = Math.max(...counts);
    const avgCommits = counts.reduce((a, b) => a + b, 0) / counts.length;
    const peakPeriod = data.find((d) => d.count === maxCommits);
    const totalCommits = counts.reduce((a, b) => a + b, 0);

    return {
      maxCommits,
      avgCommits: avgCommits.toFixed(1),
      peakPeriod: peakPeriod?.label ?? '',
      totalCommits,
      periods: data.length,
    };
  }, [data]);

  const avgLine = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((sum, d) => sum + d.count, 0) / data.length;
  }, [data]);

  const handleGranularityChange = useCallback((val: string) => {
    setGranularity(val as 'daily' | 'weekly' | 'monthly');
  }, []);

  if (!commits.length) {
    return (
      <Card className="border-white/5 bg-zinc-900/50">
        <CardContent className="flex h-64 items-center justify-center">
          <p className="text-zinc-500">No commit data available for this repository.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/5 bg-zinc-900/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-white">
              Commit History
            </CardTitle>
            {repoName && (
              <Badge
                variant="secondary"
                className="bg-violet-500/10 text-violet-400 border-violet-500/20"
              >
                {repoName}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-zinc-800/50 p-0.5">
              {(['line', 'area', 'bar'] as const).map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => setChartType(type)}
                  className={`h-7 rounded-md px-2.5 text-xs capitalize transition-all ${
                    chartType === type
                      ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  {type}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTrend(!showTrend)}
              className={`h-7 rounded-md px-2.5 text-xs transition-all ${
                showTrend
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              Trend
            </Button>

            <Select value={granularity} onValueChange={handleGranularityChange}>
              <SelectTrigger className="h-7 w-[110px] border-white/5 bg-zinc-800/50 text-xs text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-900">
                <SelectItem value="daily" className="text-xs text-zinc-300">
                  Daily
                </SelectItem>
                <SelectItem value="weekly" className="text-xs text-zinc-300">
                  Weekly
                </SelectItem>
                <SelectItem value="monthly" className="text-xs text-zinc-300">
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/5 bg-zinc-800/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Total Commits
              </p>
              <p className="mt-0.5 text-lg font-bold text-white">
                {stats.totalCommits.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-800/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Peak
              </p>
              <p className="mt-0.5 text-lg font-bold text-violet-400">
                {stats.maxCommits.toLocaleString()}
              </p>
              <p className="truncate text-[10px] text-zinc-500">
                {stats.peakPeriod}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-800/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Average / {granularity === 'daily' ? 'Day' : granularity === 'weekly' ? 'Week' : 'Month'}
              </p>
              <p className="mt-0.5 text-lg font-bold text-emerald-400">
                {stats.avgCommits}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-800/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Periods
              </p>
              <p className="mt-0.5 text-lg font-bold text-zinc-300">
                {stats.periods.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-[360px] w-full sm:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <ComposedChart
                data={enrichedData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }} />
                <ReferenceLine
                  y={avgLine}
                  stroke="rgba(251,191,36,0.3)"
                  strokeDasharray="6 4"
                  label={{
                    value: `avg: ${avgLine.toFixed(1)}`,
                    fill: '#fbbf24',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGradient)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
                {showTrend && (
                  <Line
                    dataKey="movingAvg"
                    type="monotone"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    strokeDasharray="4 2"
                  />
                )}
                <Brush
                  dataKey="label"
                  height={28}
                  stroke="rgba(139, 92, 246, 0.3)"
                  fill="rgba(24, 24, 27, 0.9)"
                  tickFormatter={() => ''}
                />
              </ComposedChart>
            ) : (
              <ComposedChart
                data={enrichedData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="50%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#c4b5fd" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: 'rgba(139,92,246,0.2)', strokeWidth: 1 }}
                />
                <ReferenceLine
                  y={avgLine}
                  stroke="rgba(251,191,36,0.3)"
                  strokeDasharray="6 4"
                  label={{
                    value: `avg: ${avgLine.toFixed(1)}`,
                    fill: '#fbbf24',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
                {chartType === 'area' ? (
                  <Area
                    dataKey="count"
                    type="monotone"
                    stroke="url(#lineGradient)"
                    strokeWidth={2.5}
                    fill="url(#areaFill)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#a78bfa',
                      stroke: '#1e1e2e',
                      strokeWidth: 2,
                    }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                ) : (
                  <Line
                    dataKey="count"
                    type="monotone"
                    stroke="url(#lineGradient)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#a78bfa',
                      stroke: '#1e1e2e',
                      strokeWidth: 2,
                    }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                )}
                {showTrend && (
                  <Line
                    dataKey="movingAvg"
                    type="monotone"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    strokeDasharray="4 2"
                    animationDuration={1000}
                  />
                )}
                <Brush
                  dataKey="label"
                  height={28}
                  stroke="rgba(139, 92, 246, 0.3)"
                  fill="rgba(24, 24, 27, 0.9)"
                  tickFormatter={() => ''}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-gradient-to-r from-violet-600 to-violet-400" />
            Commits
          </span>
          {showTrend && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-sm bg-amber-500" style={{ borderTop: '2px dashed #f59e0b' }} />
              {movingAvgWindow}-period moving avg
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ borderTop: '2px dashed rgba(251,191,36,0.3)' }}
            />
            Overall average
          </span>
        </div>

        <p className="mt-2 text-center text-[10px] text-zinc-600">
          Drag the brush below the chart to zoom into a specific time range
        </p>
      </CardContent>
    </Card>
  );
}
