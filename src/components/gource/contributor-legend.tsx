'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import type { GourceContributor, ContributorLegendProps } from '@/lib/types';
import { Search, Eye, EyeOff, Users, GitCommitHorizontal, X } from 'lucide-react';

interface ExtendedContributorLegendProps extends ContributorLegendProps {
  totalCommits?: number;
}

// Map from contributor to commit count (derived from GourceContributor data)
interface ContributorDisplayData {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  isVisible: boolean;
  opacity: number;
  commitEstimate: number;
}

let _colorCtx: CanvasRenderingContext2D | null = null;
function normalizeToHex(color: string): string {
  if (color.startsWith('#') && color.length >= 7) return color;
  if (typeof document === 'undefined') return '#646464';
  if (!_colorCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _colorCtx = c.getContext('2d')!;
  }
  _colorCtx.fillStyle = '#000000';
  _colorCtx.fillStyle = color;
  return _colorCtx.fillStyle;
}

function hexToRgba(color: string, alpha: number): string {
  if (!color) return `rgba(100, 100, 100, ${alpha})`;
  const hex = normalizeToHex(color);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ContributorLegend({
  contributors,
  highlightedId,
  onContributorClick,
  totalCommits = 0,
}: ExtendedContributorLegendProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Build display data from GourceContributor[]
  const displayData: ContributorDisplayData[] = useMemo(() => {
    return contributors
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl,
        color: c.color,
        isVisible: c.isVisible,
        opacity: c.opacity,
        // Use a heuristic for commit estimate — in real usage the engine tracks this
        commitEstimate: Math.max(1, Math.round(c.opacity * 10)),
      }))
      .sort((a, b) => {
        // Sort by visibility, then by name
        if (a.isVisible && !b.isVisible) return -1;
        if (!a.isVisible && b.isVisible) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [contributors]);

  // Filter contributors by search
  const filteredContributors = useMemo(() => {
    if (!searchQuery.trim()) return displayData;
    const query = searchQuery.toLowerCase();
    return displayData.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query)
    );
  }, [displayData, searchQuery]);

  const activeCount = displayData.filter((c) => c.isVisible).length;

  if (isCollapsed) {
    return (
      <div className="absolute right-4 top-4 z-30">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-white/10 bg-black/60 text-white/80 backdrop-blur-xl hover:bg-white/10 hover:text-white"
                onClick={() => setIsCollapsed(false)}
              >
                <Users className="h-4 w-4" />
                {activeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Show contributors</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-4 z-30 flex w-64 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white/90">Contributors</h3>
          <Badge
            variant="secondary"
            className="h-5 rounded-md border-0 bg-white/10 px-1.5 text-[10px] font-medium text-white/70"
          >
            {displayData.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md text-white/40 hover:bg-white/10 hover:text-white/80"
          onClick={() => setIsCollapsed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search */}
      {displayData.length > 5 && (
        <div className="border-b border-white/5 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contributors..."
              className="h-8 rounded-lg border-white/5 bg-white/5 pl-8 text-xs text-white/90 placeholder:text-white/25 focus-visible:border-blue-500/30 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded text-white/30 hover:bg-white/10 hover:text-white/60"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Active contributors summary */}
      <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2">
        <Eye className="h-3 w-3 text-emerald-400/60" />
        <span className="text-[11px] text-white/40">
          {activeCount} active in view
        </span>
        {highlightedId && (
          <>
            <span className="text-white/20">·</span>
            <button
              className="text-[11px] text-blue-400/70 transition-colors hover:text-blue-400"
              onClick={() => onContributorClick(highlightedId)}
            >
              Clear filter
            </button>
          </>
        )}
      </div>

      {/* Contributor list */}
      <ScrollArea className="max-h-[400px]">
        <div className="flex flex-col py-1">
          {filteredContributors.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-white/30">No contributors found</p>
            </div>
          ) : (
            filteredContributors.map((contributor, index) => {
              const isHighlighted = highlightedId === contributor.id;
              const isSoloed = highlightedId !== null && !isHighlighted;

              return (
                <button
                  key={contributor.id}
                  className={`group flex w-full items-center gap-3 px-4 py-2 text-left transition-all duration-150 ${
                    isHighlighted
                      ? 'bg-white/10'
                      : isSoloed
                        ? 'opacity-40 hover:opacity-70'
                        : 'hover:bg-white/5'
                  }`}
                  onClick={() => onContributorClick(contributor.id)}
                >
                  {/* Color indicator + Avatar */}
                  <div className="relative flex-shrink-0">
                    {/* Color ring */}
                    <div
                      className="absolute -inset-0.5 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${contributor.color}, ${hexToRgba(contributor.color, 0.4)})`,
                        opacity: isHighlighted ? 1 : 0.6,
                      }}
                    />
                    {/* Avatar */}
                    <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/10 bg-black/40">
                      {contributor.avatarUrl ? (
                        <Image
                          src={`${contributor.avatarUrl}${contributor.avatarUrl.includes('?') ? '&' : '?'}s=56`}
                          alt={contributor.name}
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white"
                          style={{ backgroundColor: contributor.color }}
                        >
                          {contributor.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Active indicator */}
                    {contributor.isVisible && contributor.opacity > 0.5 && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black/70 bg-emerald-400">
                        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-xs font-medium transition-colors ${
                        isHighlighted
                          ? 'text-white'
                          : 'text-white/70'
                      }`}
                    >
                      {contributor.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: contributor.color }}
                      />
                      <span className="text-[10px] text-white/30">
                        {contributor.id !== contributor.name
                          ? contributor.id
                          : 'contributor'}
                      </span>
                    </div>
                  </div>

                  {/* Visibility indicator */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {contributor.isVisible ? (
                      <Eye className="h-3 w-3 text-white/20 transition-colors" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-white/10" />
                    )}
                  </div>

                  {/* Highlight indicator */}
                  {isHighlighted && (
                    <div
                      className="absolute left-0 top-0 h-full w-0.5"
                      style={{ backgroundColor: contributor.color }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer with stats */}
      <div className="border-t border-white/5 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-white/25">
            <GitCommitHorizontal className="h-3 w-3" />
            <span>Click to solo a contributor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContributorLegend;
