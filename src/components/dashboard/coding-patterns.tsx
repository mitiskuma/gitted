'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CodingPatternsData, DayOfWeek } from '@/lib/types';

interface CodingPatternsProps {
  data: CodingPatternsData;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12a';
  if (i < 12) return `${i}a`;
  if (i === 12) return '12p';
  return `${i - 12}p`;
});

function getHourLabel(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

function getIntensityColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-muted/30';
  const ratio = value / max;
  if (ratio < 0.15) return 'bg-emerald-900/40';
  if (ratio < 0.3) return 'bg-emerald-800/60';
  if (ratio < 0.5) return 'bg-emerald-600/70';
  if (ratio < 0.7) return 'bg-emerald-500/80';
  if (ratio < 0.85) return 'bg-emerald-400/90';
  return 'bg-emerald-400';
}

function getIntensityBorder(value: number, max: number): string {
  if (max === 0 || value === 0) return 'border-transparent';
  const ratio = value / max;
  if (ratio < 0.3) return 'border-emerald-800/20';
  if (ratio < 0.6) return 'border-emerald-600/30';
  return 'border-emerald-400/40';
}

function getTimeOfDayEmoji(hour: number): string {
  if (hour >= 5 && hour < 9) return '🌅';
  if (hour >= 9 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 17) return '🌤️';
  if (hour >= 17 && hour < 21) return '🌆';
  return '🌙';
}

function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 9) return 'Early Morning';
  if (hour >= 9 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 14) return 'Midday';
  if (hour >= 14 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

function getChronotype(isNightOwl: boolean, isEarlyBird: boolean): { label: string; emoji: string; description: string } {
  if (isNightOwl) return { label: 'Night Owl', emoji: '🦉', description: 'Most of your commits happen after 8 PM — your best code comes alive at night.' };
  if (isEarlyBird) return { label: 'Early Bird', emoji: '🐦', description: 'You crush it before 9 AM — morning commits are your superpower.' };
  return { label: 'Balanced Coder', emoji: '⚖️', description: 'You code across the day with no strong peak — a true all-day developer.' };
}

export function CodingPatterns({ data }: CodingPatternsProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);

  const maxHourDayValue = useMemo(() => {
    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const val = data.hourDayMatrix[d]?.[h] ?? 0;
        if (val > max) max = val;
      }
    }
    return max;
  }, [data.hourDayMatrix]);

  const maxByHour = useMemo(() => Math.max(...data.byHour, 1), [data.byHour]);
  const maxByDay = useMemo(() => Math.max(...data.byDayOfWeek, 1), [data.byDayOfWeek]);
  const totalCommits = useMemo(() => data.byHour.reduce((s, v) => s + v, 0), [data.byHour]);

  const chronotype = getChronotype(data.isNightOwl, data.isEarlyBird);

  // Radar chart points for day-of-week
  const radarPoints = useMemo(() => {
    const center = 80;
    const radius = 60;
    const points: { x: number; y: number; value: number; day: string; fullDay: string }[] = [];

    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
      const ratio = maxByDay > 0 ? data.byDayOfWeek[i] / maxByDay : 0;
      const r = radius * ratio;
      points.push({
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        value: data.byDayOfWeek[i],
        day: DAY_LABELS[i],
        fullDay: DAY_FULL_LABELS[i],
      });
    }
    return points;
  }, [data.byDayOfWeek, maxByDay]);

  const radarOuterPoints = useMemo(() => {
    const center = 80;
    const radius = 60;
    return Array.from({ length: 7 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
      return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
    });
  }, []);

  const radarGridRings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Coding Patterns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            When your best work happens — analyzed from {totalCommits.toLocaleString()} commits
          </p>
        </div>
        <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1">
          {chronotype.emoji} {chronotype.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart — Commits by Day of Week */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commits by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <svg viewBox="0 0 160 160" className="w-full max-w-[240px] h-auto">
                {/* Grid rings */}
                {radarGridRings.map((ring) => (
                  <polygon
                    key={ring}
                    points={Array.from({ length: 7 }, (_, i) => {
                      const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                      const r = 60 * ring;
                      return `${80 + r * Math.cos(angle)},${80 + r * Math.sin(angle)}`;
                    }).join(' ')}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    strokeWidth={0.5}
                  />
                ))}

                {/* Axis lines */}
                {radarOuterPoints.map((pt, i) => (
                  <line
                    key={i}
                    x1={80}
                    y1={80}
                    x2={pt.x}
                    y2={pt.y}
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    strokeWidth={0.5}
                  />
                ))}

                {/* Data polygon */}
                <polygon
                  points={radarPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  className="transition-all duration-500"
                />

                {/* Data points */}
                {radarPoints.map((point, i) => (
                  <g key={i}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill="hsl(var(--chart-1))"
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      className="transition-all duration-300"
                    />
                  </g>
                ))}

                {/* Labels */}
                {radarOuterPoints.map((pt, i) => {
                  const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
                  const labelR = 72;
                  const lx = 80 + labelR * Math.cos(angle);
                  const ly = 80 + labelR * Math.sin(angle);
                  return (
                    <text
                      key={i}
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-[9px] font-medium"
                    >
                      {DAY_LABELS[i]}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Day stats below radar */}
            <div className="mt-4 grid grid-cols-7 gap-1">
              {data.byDayOfWeek.map((count, i) => {
                const ratio = maxByDay > 0 ? count / maxByDay : 0;
                const isPeak = i === data.peakDay;
                return (
                  <div key={i} className="text-center">
                    <div
                      className={`mx-auto rounded-full w-2 mb-1 transition-all duration-300 ${
                        isPeak ? 'bg-emerald-400' : 'bg-muted-foreground/30'
                      }`}
                      style={{ height: `${Math.max(4, ratio * 32)}px` }}
                    />
                    <span className={`text-[10px] font-medium ${isPeak ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs text-muted-foreground">
                Peak day:{' '}
                <span className="font-semibold text-foreground">
                  {DAY_FULL_LABELS[data.peakDay]}
                </span>{' '}
                with{' '}
                <span className="font-semibold text-emerald-400">
                  {data.byDayOfWeek[data.peakDay].toLocaleString()}
                </span>{' '}
                commits
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap — Commits by Hour x Day */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Activity Heatmap (Hour × Day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider delayDuration={100}>
              <div className="overflow-x-auto">
                <div className="min-w-[280px]">
                  {/* Hour labels (top) - show every 3 hours */}
                  <div className="flex ml-8 mb-1">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1 text-center">
                        {h % 3 === 0 ? (
                          <span className="text-[8px] text-muted-foreground">{HOUR_LABELS[h]}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {/* Grid rows (one per day) */}
                  {Array.from({ length: 7 }, (_, day) => (
                    <div key={day} className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px] text-muted-foreground w-7 text-right shrink-0">
                        {DAY_LABELS[day]}
                      </span>
                      <div className="flex flex-1 gap-[1px]">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const value = data.hourDayMatrix[day]?.[hour] ?? 0;
                          const isHovered =
                            hoveredCell?.day === day && hoveredCell?.hour === hour;
                          return (
                            <Tooltip key={hour}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex-1 aspect-square rounded-[2px] border transition-all duration-150 cursor-default ${getIntensityColor(
                                    value,
                                    maxHourDayValue
                                  )} ${getIntensityBorder(value, maxHourDayValue)} ${
                                    isHovered ? 'ring-1 ring-foreground/50 scale-125 z-10' : ''
                                  }`}
                                  onMouseEnter={() => setHoveredCell({ day, hour })}
                                  onMouseLeave={() => setHoveredCell(null)}
                                />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="text-xs"
                              >
                                <p className="font-semibold">
                                  {DAY_FULL_LABELS[day]} at {getHourLabel(hour)}
                                </p>
                                <p className="text-muted-foreground">
                                  {value.toLocaleString()} commit{value !== 1 ? 's' : ''}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-muted-foreground">Less</span>
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
                  <div
                    key={ratio}
                    className={`w-3 h-3 rounded-[2px] ${getIntensityColor(
                      ratio * maxHourDayValue,
                      maxHourDayValue
                    )}`}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground">More</span>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Peak Productivity Summary */}
        <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peak Productivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Chronotype */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
              <span className="text-3xl">{chronotype.emoji}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{chronotype.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {chronotype.description}
                </p>
              </div>
            </div>

            {/* Peak Hour */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Peak Hour</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{getTimeOfDayEmoji(data.peakHour)}</span>
                  <span className="font-semibold text-sm">{getHourLabel(data.peakHour)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Peak Day</span>
                <span className="font-semibold text-sm">{DAY_FULL_LABELS[data.peakDay]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Time of Day</span>
                <span className="font-semibold text-sm">{getTimeOfDayLabel(data.peakHour)}</span>
              </div>
            </div>

            {/* Weekend vs Weekday */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Weekday</span>
                <span>Weekend</span>
              </div>
              <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                  style={{ width: `${100 - data.weekendPercentage}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700"
                  style={{ width: `${data.weekendPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-blue-400">
                  {(100 - data.weekendPercentage).toFixed(1)}%
                </span>
                <span className="font-medium text-violet-400">
                  {data.weekendPercentage.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Hourly distribution sparkline */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">24-Hour Distribution</span>
              <div className="flex items-end gap-[2px] h-12">
                {data.byHour.map((count, hour) => {
                  const ratio = maxByHour > 0 ? count / maxByHour : 0;
                  const isPeak = hour === data.peakHour;
                  return (
                    <TooltipProvider key={hour} delayDuration={50}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 rounded-t-sm transition-all duration-300 cursor-default ${
                              isPeak
                                ? 'bg-emerald-400'
                                : ratio > 0.5
                                ? 'bg-emerald-500/60'
                                : ratio > 0
                                ? 'bg-emerald-600/40'
                                : 'bg-muted/20'
                            }`}
                            style={{ height: `${Math.max(2, ratio * 100)}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{getHourLabel(hour)}</p>
                          <p className="text-muted-foreground">
                            {count.toLocaleString()} commit{count !== 1 ? 's' : ''}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span>12AM</span>
                <span>6AM</span>
                <span>12PM</span>
                <span>6PM</span>
                <span>12AM</span>
              </div>
            </div>

            {/* Quick badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.isNightOwl && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  🌙 Night Owl
                </Badge>
              )}
              {data.isEarlyBird && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  🌅 Early Bird
                </Badge>
              )}
              {data.weekendPercentage > 30 && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  🏋️ Weekend Warrior
                </Badge>
              )}
              {data.weekendPercentage < 10 && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  💼 Weekday Focused
                </Badge>
              )}
              {data.peakHour >= 22 || data.peakHour <= 4 ? (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  🌃 Midnight Coder
                </Badge>
              ) : null}
              {data.byHour.filter((c) => c > 0).length >= 18 && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  ⏰ Always On
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
