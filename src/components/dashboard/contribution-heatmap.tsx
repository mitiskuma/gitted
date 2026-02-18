'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContributionHeatmapProps, HeatmapData, HeatmapCell } from '@/lib/types';

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const TOTAL_CELL = CELL_SIZE + CELL_GAP;

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const LEVEL_COLORS = {
  0: 'var(--heatmap-0, #161b22)',
  1: 'var(--heatmap-1, #0e4429)',
  2: 'var(--heatmap-2, #006d32)',
  3: 'var(--heatmap-3, #26a641)',
  4: 'var(--heatmap-4, #39d353)',
} as const;

const LEVEL_COLORS_HEX: Record<number, string> = {
  0: '#161b22',
  1: '#0e4429',
  2: '#006d32',
  3: '#26a641',
  4: '#39d353',
};

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  cell: HeatmapCell | null;
}

function getWeeksInYear(year: number): Array<Array<{ date: string; dayOfWeek: number } | null>> {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const startDay = startDate.getDay();

  const weeks: Array<Array<{ date: string; dayOfWeek: number } | null>> = [];
  let currentWeek: Array<{ date: string; dayOfWeek: number } | null> = [];

  // Fill in empty cells before the first day
  for (let i = 0; i < startDay; i++) {
    currentWeek.push(null);
  }

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = formatDateKey(current);
    const dayOfWeek = current.getDay();

    currentWeek.push({ date: dateKey, dayOfWeek });

    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    current.setDate(current.getDate() + 1);
  }

  // Push the last partial week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMonthPositions(weeks: Array<Array<{ date: string; dayOfWeek: number } | null>>): Array<{ month: number; weekIndex: number }> {
  const positions: Array<{ month: number; weekIndex: number }> = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    for (const day of week) {
      if (day) {
        const month = parseInt(day.date.substring(5, 7), 10) - 1;
        if (month !== lastMonth) {
          positions.push({ month, weekIndex });
          lastMonth = month;
        }
        break;
      }
    }
  });

  return positions;
}

export function ContributionHeatmap({
  data,
  year,
  onYearChange,
  onCellClick,
}: ContributionHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    cell: null,
  });

  const weeks = useMemo(() => getWeeksInYear(year), [year]);
  const monthPositions = useMemo(() => getMonthPositions(weeks), [weeks]);

  const totalCommitsForYear = useMemo(() => {
    let total = 0;
    for (const [dateKey, cell] of Object.entries(data.cells)) {
      if (dateKey.startsWith(String(year))) {
        total += cell.count;
      }
    }
    return total;
  }, [data.cells, year]);

  const activeDaysForYear = useMemo(() => {
    let count = 0;
    for (const [dateKey, cell] of Object.entries(data.cells)) {
      if (dateKey.startsWith(String(year)) && cell.count > 0) {
        count++;
      }
    }
    return count;
  }, [data.cells, year]);

  const maxCountForYear = useMemo(() => {
    let max = 0;
    for (const [dateKey, cell] of Object.entries(data.cells)) {
      if (dateKey.startsWith(String(year))) {
        max = Math.max(max, cell.count);
      }
    }
    return max;
  }, [data.cells, year]);

  const labelWidth = 36;
  const topPadding = 24;
  const svgWidth = labelWidth + weeks.length * TOTAL_CELL + CELL_GAP;
  const svgHeight = topPadding + 7 * TOTAL_CELL + CELL_GAP;

  const getCellLevel = useCallback(
    (dateKey: string): 0 | 1 | 2 | 3 | 4 => {
      const cell = data.cells[dateKey];
      if (!cell || cell.count === 0) return 0;
      return cell.level;
    },
    [data.cells]
  );

  const getCellColor = useCallback(
    (dateKey: string): string => {
      const level = getCellLevel(dateKey);
      return LEVEL_COLORS_HEX[level];
    },
    [getCellLevel]
  );

  const handleCellHover = useCallback(
    (e: React.MouseEvent<SVGRectElement>, dateKey: string) => {
      const cell = data.cells[dateKey] || {
        date: dateKey,
        count: 0,
        level: 0 as const,
        repos: [],
      };

      const svgEl = svgRef.current;
      if (!svgEl) return;

      const rect = svgEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setTooltip({
        visible: true,
        x,
        y: y - 12,
        cell,
      });
    },
    [data.cells]
  );

  const handleCellLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCellClick = useCallback(
    (dateKey: string) => {
      if (onCellClick) {
        const cell = data.cells[dateKey] || {
          date: dateKey,
          count: 0,
          level: 0 as const,
          repos: [],
        };
        onCellClick(cell);
      }
    },
    [data.cells, onCellClick]
  );

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <span className="text-xl">📊</span>
              Contribution Activity
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {totalCommitsForYear.toLocaleString()} contributions in {year}
              {activeDaysForYear > 0 && (
                <span className="ml-1">
                  · {activeDaysForYear} active days
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.years.length > 1 && (
              <Select
                value={String(year)}
                onValueChange={(val) => onYearChange(parseInt(val, 10))}
              >
                <SelectTrigger className="w-[100px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.years
                    .sort((a, b) => b - a)
                    .map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {maxCountForYear > 0 && (
              <Badge variant="secondary" className="text-xs font-mono">
                Peak: {maxCountForYear} / day
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[680px]">
            <svg
              ref={svgRef}
              width="100%"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="select-none"
              role="img"
              aria-label={`Contribution heatmap for ${year} showing ${totalCommitsForYear} total contributions`}
            >
              {/* Month labels */}
              {monthPositions.map(({ month, weekIndex }) => (
                <text
                  key={`month-${month}-${weekIndex}`}
                  x={labelWidth + weekIndex * TOTAL_CELL}
                  y={topPadding - 8}
                  className="fill-muted-foreground"
                  fontSize="10"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {MONTH_LABELS[month]}
                </text>
              ))}

              {/* Day labels */}
              {DAY_LABELS.map((label, index) => {
                if (!label) return null;
                return (
                  <text
                    key={`day-${index}`}
                    x={labelWidth - 8}
                    y={topPadding + index * TOTAL_CELL + CELL_SIZE - 1}
                    className="fill-muted-foreground"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {label}
                  </text>
                );
              })}

              {/* Heatmap cells */}
              {weeks.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  if (!day) return null;

                  const x = labelWidth + weekIndex * TOTAL_CELL;
                  const y = topPadding + dayIndex * TOTAL_CELL;
                  const color = getCellColor(day.date);
                  const level = getCellLevel(day.date);

                  return (
                    <rect
                      key={day.date}
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={CELL_RADIUS}
                      ry={CELL_RADIUS}
                      fill={color}
                      className="transition-opacity duration-150 cursor-pointer hover:opacity-80"
                      style={{
                        stroke: level > 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                        strokeWidth: 0.5,
                      }}
                      onMouseEnter={(e) => handleCellHover(e, day.date)}
                      onMouseLeave={handleCellLeave}
                      onClick={() => handleCellClick(day.date)}
                      role="gridcell"
                      aria-label={`${day.date}: ${data.cells[day.date]?.count ?? 0} commits`}
                    />
                  );
                })
              )}
            </svg>

            {/* Tooltip */}
            {tooltip.visible && tooltip.cell && (
              <div
                className="absolute z-50 pointer-events-none"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs whitespace-nowrap">
                  <p className="font-semibold text-popover-foreground">
                    {tooltip.cell.count === 0
                      ? 'No contributions'
                      : `${tooltip.cell.count} contribution${tooltip.cell.count === 1 ? '' : 's'}`}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {formatDisplayDate(tooltip.cell.date)}
                  </p>
                  {tooltip.cell.repos.length > 0 && (
                    <p className="text-muted-foreground mt-0.5 truncate max-w-[200px]">
                      {tooltip.cell.repos.length === 1
                        ? tooltip.cell.repos[0]
                        : `${tooltip.cell.repos.length} repos`}
                    </p>
                  )}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                    style={{
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid hsl(var(--border))',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-xs text-muted-foreground">
              Learn how we count contributions from your selected repositories.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Less</span>
              {([0, 1, 2, 3, 4] as const).map((level) => (
                <div
                  key={level}
                  className="rounded-sm"
                  style={{
                    width: 11,
                    height: 11,
                    backgroundColor: LEVEL_COLORS_HEX[level],
                    border:
                      level === 0
                        ? '1px solid rgba(255,255,255,0.06)'
                        : '1px solid rgba(255,255,255,0.03)',
                  }}
                  title={
                    level === 0
                      ? '0 contributions'
                      : level === 1
                        ? '1-3 contributions'
                        : level === 2
                          ? '4-6 contributions'
                          : level === 3
                            ? '7-9 contributions'
                            : '10+ contributions'
                  }
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">More</span>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        {totalCommitsForYear > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {totalCommitsForYear.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Commits</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {activeDaysForYear}
              </p>
              <p className="text-xs text-muted-foreground">Active Days</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {activeDaysForYear > 0
                  ? (totalCommitsForYear / activeDaysForYear).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-muted-foreground">Avg / Day</p>
            </div>
          </div>
        )}

        {totalCommitsForYear === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-3xl mb-2">🌱</span>
            <p className="text-sm text-muted-foreground">
              No contributions found for {year}.
            </p>
            {data.years.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Try selecting a different year to see your activity.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
