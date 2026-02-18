'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type {
  CommitFrequencyData,
  CommitData,
  TimeGranularity,
} from '@/lib/types';
import { TimeGranularity as TG } from '@/lib/types';
import { computeCommitFrequency } from '@/lib/analytics-engine';

// Repo colors for overlaying multiple lines
const REPO_COLORS = [
  '#3178c6', // TypeScript blue
  '#f1e05a', // JavaScript yellow
  '#663399', // Purple
  '#10b981', // Emerald
  '#f97316', // Orange
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

function getRepoColor(index: number): string {
  return REPO_COLORS[index % REPO_COLORS.length];
}

function getGranularityLabel(granularity: TimeGranularity): string {
  switch (granularity) {
    case TG.DAILY:
      return 'Daily';
    case TG.WEEKLY:
      return 'Weekly';
    case TG.MONTHLY:
      return 'Monthly';
    case TG.YEARLY:
      return 'Yearly';
    default:
      return 'Monthly';
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  showPerRepo: boolean;
}

function CustomTooltip({ active, payload, label, showPerRepo }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {showPerRepo ? (
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.name
                    ? entry.name.split('/').pop() || entry.name
                    : 'Unknown'}
                </span>
              </div>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {(entry.value || 0).toLocaleString()} commits
              </span>
            </div>
          ))}
          {payload.length > 1 && (
            <div className="mt-1 flex items-center justify-between gap-4 border-t border-border/30 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Total</span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {payload
                  .reduce((sum, e) => sum + (e.value || 0), 0)
                  .toLocaleString()}{' '}
                commits
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {payload.map((entry, index) => {
            const isAdditions = entry.dataKey === 'additions';
            const isDeletions = entry.dataKey === 'deletions';
            const labelText = isAdditions
              ? 'Lines added'
              : isDeletions
                ? 'Lines removed'
                : 'Commits';
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-muted-foreground">{labelText}</span>
                </div>
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {(entry.value || 0).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Lazy-loaded recharts wrapper
function RechartsContent({
  showPerRepo,
  hasPerRepoData,
  perRepoChartData,
  chartData,
  repoNames,
  showLinesChanged,
}: {
  showPerRepo: boolean;
  hasPerRepoData: boolean;
  perRepoChartData: Record<string, unknown>[];
  chartData: Array<{ label: string; date: string; count: number; additions: number; deletions: number }>;
  repoNames: string[];
  showLinesChanged: boolean;
}) {
  const [recharts, setRecharts] = useState<typeof import('recharts') | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import('recharts').then((mod) => {
      if (!cancelled) {
        setRecharts(mod);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading || !recharts) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Loading chart...</p>
      </div>
    );
  }

  const {
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
  } = recharts;

  if (showPerRepo && hasPerRepoData) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={perRepoChartData}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <defs>
            {repoNames.map((repo, index) => (
              <linearGradient
                key={repo}
                id={`line-gradient-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={getRepoColor(index)}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={getRepoColor(index)}
                  stopOpacity={0.1}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.3 }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip showPerRepo={true} />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              const shortName = value.split('/').pop() || value;
              return shortName;
            }}
          />
          {repoNames.map((repo, index) => (
            <Line
              key={repo}
              type="monotone"
              dataKey={repo}
              name={repo}
              stroke={getRepoColor(index)}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                fill: 'hsl(var(--background))',
                stroke: getRepoColor(index),
              }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
      >
        <defs>
          <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3178c6" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#3178c6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3178c6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="additionsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="deletionsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.3}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.3 }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={45}
          yAxisId="left"
        />
        {showLinesChanged && (
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={50}
            yAxisId="right"
            orientation="right"
            tickFormatter={(value: number) =>
              value >= 1000
                ? `${(value / 1000).toFixed(0)}k`
                : value.toString()
            }
          />
        )}
        <Tooltip content={<CustomTooltip showPerRepo={false} />} />
        {showLinesChanged && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => value}
          />
        )}
        <Area
          type="monotone"
          dataKey="count"
          name="Commits"
          stroke="#3178c6"
          strokeWidth={2.5}
          fill="url(#commitGradient)"
          yAxisId="left"
          activeDot={{
            r: 5,
            strokeWidth: 2,
            fill: '#3178c6',
            stroke: 'hsl(var(--background))',
          }}
        />
        {showLinesChanged && (
          <>
            <Area
              type="monotone"
              dataKey="additions"
              name="Lines added"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#additionsGradient)"
              yAxisId="right"
              strokeDasharray="4 2"
              activeDot={{
                r: 3,
                fill: '#10b981',
                stroke: 'hsl(var(--background))',
              }}
            />
            <Area
              type="monotone"
              dataKey="deletions"
              name="Lines removed"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#deletionsGradient)"
              yAxisId="right"
              strokeDasharray="4 2"
              activeDot={{
                r: 3,
                fill: '#ef4444',
                stroke: 'hsl(var(--background))',
              }}
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface CommitTimelineChartInternalProps {
  data: CommitFrequencyData | null;
  commits?: CommitData[];
  granularityOptions?: TimeGranularity[];
  initialGranularity?: TimeGranularity;
}

export function CommitTimelineChart({
  data,
  commits,
  granularityOptions,
  initialGranularity,
}: CommitTimelineChartInternalProps) {
  const availableGranularities = granularityOptions || [TG.DAILY, TG.WEEKLY, TG.MONTHLY];
  const [granularity, setGranularity] = useState<TimeGranularity>(
    initialGranularity || data?.granularity || TG.MONTHLY
  );
  const [showPerRepo, setShowPerRepo] = useState(false);
  const [showLinesChanged, setShowLinesChanged] = useState(false);

  // Recompute frequency data when granularity changes
  const effectiveData = useMemo(() => {
    if (!data) return null;
    if (commits && commits.length > 0 && granularity !== data.granularity) {
      return computeCommitFrequency(commits, granularity);
    }
    return data;
  }, [data, commits, granularity]);

  // Get chart data based on granularity
  const chartData = useMemo(() => {
    if (!effectiveData) return [];
    return effectiveData.series;
  }, [effectiveData]);

  // Get repo names for per-repo overlay
  const repoNames = useMemo(() => {
    if (!effectiveData?.perRepoSeries) return [];
    return Object.keys(effectiveData.perRepoSeries);
  }, [effectiveData?.perRepoSeries]);

  // Build merged per-repo chart data
  const perRepoChartData = useMemo(() => {
    if (!effectiveData?.perRepoSeries || !showPerRepo) return [];

    const merged: Record<string, Record<string, unknown>> = {};

    for (const [repoId, series] of Object.entries(effectiveData.perRepoSeries)) {
      for (const point of series) {
        if (!merged[point.label]) {
          merged[point.label] = { label: point.label, date: point.date };
        }
        merged[point.label][repoId] = point.count;
      }
    }

    for (const point of effectiveData.series) {
      if (!merged[point.label]) {
        merged[point.label] = { label: point.label, date: point.date };
      }
    }

    return Object.values(merged).sort((a, b) => {
      const dateA = a.date as string;
      const dateB = b.date as string;
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
    });
  }, [effectiveData, showPerRepo]);

  // Summary stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const totalCommits = chartData.reduce((sum, p) => sum + p.count, 0);
    const peakPeriod = chartData.reduce(
      (max, p) => (p.count > max.count ? p : max),
      chartData[0]
    );
    const avgPerPeriod = Math.round(totalCommits / chartData.length);
    const totalAdditions = chartData.reduce((sum, p) => sum + p.additions, 0);
    const totalDeletions = chartData.reduce((sum, p) => sum + p.deletions, 0);

    return {
      totalCommits,
      peakPeriod,
      avgPerPeriod,
      totalAdditions,
      totalDeletions,
      periods: chartData.length,
    };
  }, [chartData]);

  const hasPerRepoData = repoNames.length > 1;

  if (!data || chartData.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Commit Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>No commit data available yet. Select repositories and generate analytics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Commit Timeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Commit frequency over time across selected repositories
            </p>
          </div>

          {/* Granularity Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
            {availableGranularities.map((g) => (
              <Button
                key={g}
                variant={granularity === g ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGranularity(g)}
                className={`h-7 px-3 text-xs transition-all ${
                  granularity === g
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {getGranularityLabel(g)}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats summary */}
        {stats && (
          <div className="mt-3 flex flex-wrap gap-3">
            <Badge variant="secondary" className="gap-1.5 bg-muted/50">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold tabular-nums">
                {stats.totalCommits.toLocaleString()} commits
              </span>
            </Badge>
            <Badge variant="secondary" className="gap-1.5 bg-muted/50">
              <span className="text-muted-foreground">Peak:</span>
              <span className="font-semibold tabular-nums">
                {stats.peakPeriod.count.toLocaleString()} in {stats.peakPeriod.label}
              </span>
            </Badge>
            <Badge variant="secondary" className="gap-1.5 bg-muted/50">
              <span className="text-muted-foreground">Avg:</span>
              <span className="font-semibold tabular-nums">
                {stats.avgPerPeriod.toLocaleString()}/{granularity === TG.DAILY ? 'day' : granularity === TG.WEEKLY ? 'week' : granularity === TG.MONTHLY ? 'month' : 'year'}
              </span>
            </Badge>
          </div>
        )}

        {/* Controls row */}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {hasPerRepoData && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-per-repo"
                checked={showPerRepo}
                onCheckedChange={setShowPerRepo}
              />
              <Label
                htmlFor="show-per-repo"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Show per-repo
              </Label>
            </div>
          )}
          {!showPerRepo && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-lines"
                checked={showLinesChanged}
                onCheckedChange={setShowLinesChanged}
              />
              <Label
                htmlFor="show-lines"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Show lines ±
              </Label>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-72 w-full sm:h-80 lg:h-96">
          <RechartsContent
            showPerRepo={showPerRepo}
            hasPerRepoData={hasPerRepoData}
            perRepoChartData={perRepoChartData}
            chartData={chartData}
            repoNames={repoNames}
            showLinesChanged={showLinesChanged}
          />
        </div>

        {/* Bottom insight */}
        {stats && stats.peakPeriod && (
          <div className="mt-4 rounded-lg border border-border/30 bg-muted/20 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">📈</span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Peak productivity: {stats.peakPeriod.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  You hit{' '}
                  <span className="font-semibold text-foreground">
                    {stats.peakPeriod.count.toLocaleString()} commits
                  </span>{' '}
                  with{' '}
                  <span className="font-medium text-emerald-500">
                    +{stats.peakPeriod.additions.toLocaleString()}
                  </span>
                  {' / '}
                  <span className="font-medium text-red-500">
                    -{stats.peakPeriod.deletions.toLocaleString()}
                  </span>{' '}
                  lines changed — that&apos;s{' '}
                  {stats.avgPerPeriod > 0
                    ? `${((stats.peakPeriod.count / stats.avgPerPeriod) * 100).toFixed(0)}% of your average`
                    : 'your most active period'}
                  .
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CommitTimelineChart;
