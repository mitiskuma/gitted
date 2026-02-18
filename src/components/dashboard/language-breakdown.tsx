'use client';

import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Code2,
  Layers,
} from 'lucide-react';
import type { LanguageBreakdownData, LanguageEntry } from '@/lib/types';

interface LanguageBreakdownProps {
  data: LanguageBreakdownData | null;
}

type SortField = 'name' | 'percentage' | 'bytes' | 'repoCount';
type SortDirection = 'asc' | 'desc';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatLines(bytes: number): string {
  // Approximate lines from bytes (rough estimate: ~40 bytes per line)
  const lines = Math.round(bytes / 40);
  if (lines >= 1_000_000) return `${(lines / 1_000_000).toFixed(1)}M`;
  if (lines >= 1_000) return `${(lines / 1_000).toFixed(1)}K`;
  return lines.toLocaleString();
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LanguageEntry }>;
}) => {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        <span className="font-semibold text-sm text-foreground">
          {entry.name}
        </span>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <div>{entry.percentage.toFixed(1)}% of codebase</div>
        <div>{formatBytes(entry.bytes)}</div>
        <div>
          ~{formatLines(entry.bytes)} lines
        </div>
        <div>
          {entry.repoCount} {entry.repoCount === 1 ? 'repo' : 'repos'}
        </div>
      </div>
    </div>
  );
};

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
  if (!percent || !midAngle || percent < 0.05) return null;
  const numCx = typeof cx === 'string' ? parseFloat(cx) : (cx ?? 0);
  const numCy = typeof cy === 'string' ? parseFloat(cy) : (cy ?? 0);
  const numInner = typeof innerRadius === 'string' ? parseFloat(innerRadius) : (innerRadius ?? 0);
  const numOuter = typeof outerRadius === 'string' ? parseFloat(outerRadius) : (outerRadius ?? 0);
  const radius = numInner + (numOuter - numInner) * 0.5;
  const x = numCx + radius * Math.cos(-midAngle * RADIAN);
  const y = numCy + radius * Math.sin(-midAngle * RADIAN);
  const labelName = typeof name === 'string' ? name : String(name ?? '');

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-medium pointer-events-none"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
    >
      {labelName.length > 8 ? `${labelName.slice(0, 7)}…` : labelName}
    </text>
  );
};

export function LanguageBreakdown({ data }: LanguageBreakdownProps) {
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAll, setShowAll] = useState(false);

  const sortedLanguages = useMemo(() => {
    if (!data) return [];

    const sorted = [...data.languages].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'percentage':
          comparison = a.percentage - b.percentage;
          break;
        case 'bytes':
          comparison = a.bytes - b.bytes;
          break;
        case 'repoCount':
          comparison = a.repoCount - b.repoCount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortField, sortDirection]);

  const chartData = useMemo(() => {
    if (!data) return [];
    // Group languages with <2% into "Other"
    const threshold = 2;
    const major = data.languages.filter((l) => l.percentage >= threshold);
    const minor = data.languages.filter((l) => l.percentage < threshold);

    if (minor.length > 0) {
      const otherBytes = minor.reduce((sum, l) => sum + l.bytes, 0);
      const otherPercentage = minor.reduce((sum, l) => sum + l.percentage, 0);
      const otherRepoCount = new Set(minor.flatMap((l) => l.name)).size;

      return [
        ...major,
        {
          name: 'Other',
          bytes: otherBytes,
          percentage: otherPercentage,
          repoCount: otherRepoCount,
          color: '#64748b',
        },
      ];
    }

    return major;
  }, [data]);

  const displayedLanguages = showAll
    ? sortedLanguages
    : sortedLanguages.slice(0, 8);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  if (!data || data.languages.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="w-5 h-5 text-purple-400" />
            Language Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No language data available yet</p>
            <p className="text-xs mt-1 opacity-60">
              Language breakdown will appear once commits are analyzed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topLanguage = data.languages[0];

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="w-5 h-5 text-purple-400" />
            Language Distribution
          </CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            {data.languages.length} language{data.languages.length !== 1 && 's'}
          </Badge>
        </div>
        {topLanguage && (
          <p className="text-xs text-muted-foreground mt-1">
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: topLanguage.color }}
            />
            {topLanguage.name} dominates at {topLanguage.percentage.toFixed(1)}%
            across {topLanguage.repoCount}{' '}
            {topLanguage.repoCount === 1 ? 'repo' : 'repos'}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Donut Chart */}
        <div className="w-full h-[280px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                paddingAngle={2}
                dataKey="bytes"
                nameKey="name"
                labelLine={false}
                label={renderCustomizedLabel}
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
                stroke="transparent"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {formatBytes(data.totalBytes)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total Code
              </div>
            </div>
          </div>
        </div>

        {/* Language color legend (horizontal, wrapping) */}
        <div className="flex flex-wrap gap-2 justify-center px-2">
          {chartData.slice(0, 6).map((lang) => (
            <div key={lang.name} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: lang.color }}
              />
              <span className="text-muted-foreground whitespace-nowrap">
                {lang.name}
              </span>
              <span className="text-foreground font-medium">
                {lang.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Sortable Table */}
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="text-left px-3 py-2.5">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Language
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5">
                    <button
                      onClick={() => handleSort('percentage')}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      Share
                      <SortIcon field="percentage" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 hidden sm:table-cell">
                    <button
                      onClick={() => handleSort('bytes')}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      Size
                      <SortIcon field="bytes" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 hidden md:table-cell">
                    <button
                      onClick={() => handleSort('repoCount')}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      Repos
                      <SortIcon field="repoCount" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedLanguages.map((lang, index) => (
                  <tr
                    key={lang.name}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
                          style={{ backgroundColor: lang.color }}
                        />
                        <Badge
                          variant="secondary"
                          className="font-medium text-xs px-2 py-0.5"
                          style={{
                            backgroundColor: `${lang.color}15`,
                            color: lang.color,
                            borderColor: `${lang.color}30`,
                          }}
                        >
                          {lang.name}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.max(2, lang.percentage)}%`,
                              backgroundColor: lang.color,
                            }}
                          />
                        </div>
                        <span className="text-foreground font-medium tabular-nums text-xs min-w-[3rem] text-right">
                          {lang.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground text-xs tabular-nums hidden sm:table-cell">
                      {formatBytes(lang.bytes)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                        {lang.repoCount}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show all / Show less toggle */}
          {sortedLanguages.length > 8 && (
            <div className="border-t border-border/30 px-3 py-2 bg-muted/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((prev) => !prev)}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                {showAll
                  ? 'Show less'
                  : `Show all ${sortedLanguages.length} languages`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
