"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CommitData, TimeGranularity } from "@/lib/types";

interface CodeFrequencyChartProps {
  commits: CommitData[];
  repoName?: string;
}

interface WeeklyDataPoint {
  weekStart: string;
  label: string;
  additions: number;
  deletions: number;
  netChange: number;
  commits: number;
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day;
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split("T")[0];
}

function getMonthStart(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

type Granularity = "weekly" | "monthly";

function aggregateData(
  commits: CommitData[],
  granularity: Granularity
): WeeklyDataPoint[] {
  if (!commits.length) return [];

  const bucketMap = new Map<
    string,
    { additions: number; deletions: number; commits: number }
  >();

  const sortedCommits = [...commits].sort(
    (a, b) => a.timestampMs - b.timestampMs
  );

  for (const commit of sortedCommits) {
    const key =
      granularity === "weekly"
        ? getWeekStart(commit.timestamp)
        : getMonthStart(commit.timestamp);

    const existing = bucketMap.get(key) || {
      additions: 0,
      deletions: 0,
      commits: 0,
    };
    existing.additions += commit.additions;
    existing.deletions += commit.deletions;
    existing.commits += 1;
    bucketMap.set(key, existing);
  }

  const entries = Array.from(bucketMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Fill gaps
  if (entries.length > 1) {
    const startDate = new Date(entries[0][0]);
    const endDate = new Date(entries[entries.length - 1][0]);
    const filledMap = new Map(bucketMap);

    const current = new Date(startDate);
    while (current <= endDate) {
      const key =
        granularity === "weekly"
          ? getWeekStart(current.toISOString())
          : getMonthStart(current.toISOString());

      if (!filledMap.has(key)) {
        filledMap.set(key, { additions: 0, deletions: 0, commits: 0 });
      }

      if (granularity === "weekly") {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }

    const filledEntries = Array.from(filledMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return filledEntries.map(([key, val]) => ({
      weekStart: key,
      label:
        granularity === "weekly" ? formatWeekLabel(key) : formatMonthLabel(key),
      additions: val.additions,
      deletions: -Math.abs(val.deletions),
      netChange: val.additions - val.deletions,
      commits: val.commits,
    }));
  }

  return entries.map(([key, val]) => ({
    weekStart: key,
    label:
      granularity === "weekly" ? formatWeekLabel(key) : formatMonthLabel(key),
    additions: val.additions,
    deletions: -Math.abs(val.deletions),
    netChange: val.additions - val.deletions,
    commits: val.commits,
  }));
}

function formatNumber(num: number): string {
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: WeeklyDataPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="mb-2 text-sm font-semibold text-zinc-200">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-zinc-400">Additions:</span>
          <span className="text-xs font-medium text-emerald-400">
            +{formatNumber(data.additions)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="text-xs text-zinc-400">Deletions:</span>
          <span className="text-xs font-medium text-red-400">
            {formatNumber(data.deletions)}
          </span>
        </div>
        <div className="mt-1.5 border-t border-zinc-700 pt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Net change:</span>
            <span
              className={`text-xs font-medium ${
                data.netChange >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {data.netChange >= 0 ? "+" : ""}
              {formatNumber(data.netChange)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Commits:</span>
            <span className="text-xs font-medium text-zinc-200">
              {data.commits}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CodeFrequencyChart({
  commits,
  repoName,
}: CodeFrequencyChartProps) {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [showNet, setShowNet] = useState(false);

  const data = useMemo(
    () => aggregateData(commits, granularity),
    [commits, granularity]
  );

  const stats = useMemo(() => {
    if (!data.length)
      return {
        totalAdditions: 0,
        totalDeletions: 0,
        peakAdditions: 0,
        peakDeletions: 0,
        peakAdditionsWeek: "",
        peakDeletionsWeek: "",
        avgChurnPerWeek: 0,
      };

    let totalAdditions = 0;
    let totalDeletions = 0;
    let peakAdditions = 0;
    let peakDeletions = 0;
    let peakAdditionsWeek = "";
    let peakDeletionsWeek = "";

    for (const d of data) {
      totalAdditions += d.additions;
      totalDeletions += Math.abs(d.deletions);
      if (d.additions > peakAdditions) {
        peakAdditions = d.additions;
        peakAdditionsWeek = d.label;
      }
      if (Math.abs(d.deletions) > peakDeletions) {
        peakDeletions = Math.abs(d.deletions);
        peakDeletionsWeek = d.label;
      }
    }

    return {
      totalAdditions,
      totalDeletions,
      peakAdditions,
      peakDeletions,
      peakAdditionsWeek,
      peakDeletionsWeek,
      avgChurnPerWeek: Math.round(
        (totalAdditions + totalDeletions) / data.length
      ),
    };
  }, [data]);

  if (!commits.length) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">
            Code Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-zinc-500">
              No commit data available for code frequency analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-zinc-100">
              Code Frequency
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Lines added and deleted over the{" "}
              {repoName ? (
                <span className="font-medium text-zinc-400">{repoName}</span>
              ) : (
                "repository"
              )}{" "}
              lifetime
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showNet ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowNet(!showNet)}
              className="h-7 text-xs"
            >
              {showNet ? "Net" : "Stacked"}
            </Button>
            <Select
              value={granularity}
              onValueChange={(v) => setGranularity(v as Granularity)}
            >
              <SelectTrigger className="h-7 w-[100px] border-zinc-700 bg-zinc-800 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800">
                <SelectItem value="weekly" className="text-xs">
                  Weekly
                </SelectItem>
                <SelectItem value="monthly" className="text-xs">
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Total Added
            </p>
            <p className="text-sm font-bold text-emerald-400">
              +{formatNumber(stats.totalAdditions)}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Total Deleted
            </p>
            <p className="text-sm font-bold text-red-400">
              -{formatNumber(stats.totalDeletions)}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Peak Additions
            </p>
            <p className="text-sm font-bold text-emerald-300">
              +{formatNumber(stats.peakAdditions)}
            </p>
            <p className="truncate text-[10px] text-zinc-600">
              {stats.peakAdditionsWeek}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Avg Churn/{granularity === "weekly" ? "wk" : "mo"}
            </p>
            <p className="text-sm font-bold text-zinc-300">
              {formatNumber(stats.avgChurnPerWeek)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="h-[320px] w-full sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="additionsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="deletionsGradient"
                  x1="0"
                  y1="1"
                  x2="0"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="netGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                iconType="circle"
                iconSize={8}
              />

              {showNet ? (
                <Area
                  type="monotone"
                  dataKey="netChange"
                  name="Net Change"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#netGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: "#818cf8",
                    stroke: "#1e1b4b",
                  }}
                />
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="additions"
                    name="Additions"
                    stroke="#34d399"
                    strokeWidth={1.5}
                    fill="url(#additionsGradient)"
                    dot={false}
                    activeDot={{
                      r: 3,
                      strokeWidth: 2,
                      fill: "#34d399",
                      stroke: "#022c22",
                    }}
                    stackId="code"
                  />
                  <Area
                    type="monotone"
                    dataKey="deletions"
                    name="Deletions"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    fill="url(#deletionsGradient)"
                    dot={false}
                    activeDot={{
                      r: 3,
                      strokeWidth: 2,
                      fill: "#f87171",
                      stroke: "#450a0a",
                    }}
                    stackId="code"
                  />
                </>
              )}

              {data.length > 20 && (
                <Brush
                  dataKey="label"
                  height={24}
                  stroke="#3f3f46"
                  fill="#18181b"
                  travellerWidth={8}
                  tickFormatter={() => ""}
                >
                  <AreaChart data={data}>
                    <Area
                      type="monotone"
                      dataKey="additions"
                      stroke="#34d399"
                      fill="#34d39920"
                      strokeWidth={1}
                    />
                    <Area
                      type="monotone"
                      dataKey="deletions"
                      stroke="#f87171"
                      fill="#f8717120"
                      strokeWidth={1}
                    />
                  </AreaChart>
                </Brush>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Info */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="border-emerald-800 bg-emerald-950/30 text-emerald-400"
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Additions (lines added)
          </Badge>
          <Badge
            variant="outline"
            className="border-red-800 bg-red-950/30 text-red-400"
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-400" />
            Deletions (lines removed)
          </Badge>
          <span className="text-[10px] text-zinc-600">
            {data.length} {granularity === "weekly" ? "weeks" : "months"} of
            data • {commits.length.toLocaleString()} total commits
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
