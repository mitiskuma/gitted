'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  FolderOpen,
  FileCode,
  Layers,
} from 'lucide-react';
import type { CommitData, FileCategory } from '@/lib/types';
import { FILE_CATEGORY_COLORS } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────

interface TreemapNode {
  name: string;
  path: string;
  size: number;
  children?: TreemapNode[];
  isDirectory: boolean;
  category?: FileCategory;
  color?: string;
  changeCount: number;
  additions: number;
  deletions: number;
  fileCount?: number;
}

interface FileChangeTreemapProps {
  commits: CommitData[];
  repoName?: string;
}

interface CustomContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color?: string;
  isDirectory?: boolean;
  depth: number;
  index: number;
}

interface TooltipPayloadEntry {
  payload: {
    name: string;
    size: number;
    changeCount: number;
    additions: number;
    deletions: number;
    isDirectory: boolean;
    category?: FileCategory;
    fileCount?: number;
  };
}

// ── Category color map with nice dark-theme palette ────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  ...FILE_CATEGORY_COLORS,
  directory: '#6366f1',
};

function getCategoryFromExtension(ext: string): FileCategory {
  const map: Record<string, FileCategory> = {
    ts: 'code' as FileCategory,
    tsx: 'code' as FileCategory,
    js: 'code' as FileCategory,
    jsx: 'code' as FileCategory,
    py: 'code' as FileCategory,
    java: 'code' as FileCategory,
    go: 'code' as FileCategory,
    rs: 'code' as FileCategory,
    cpp: 'code' as FileCategory,
    c: 'code' as FileCategory,
    cs: 'code' as FileCategory,
    rb: 'code' as FileCategory,
    php: 'code' as FileCategory,
    swift: 'code' as FileCategory,
    kt: 'code' as FileCategory,
    html: 'markup' as FileCategory,
    htm: 'markup' as FileCategory,
    xml: 'markup' as FileCategory,
    svg: 'markup' as FileCategory,
    vue: 'markup' as FileCategory,
    svelte: 'markup' as FileCategory,
    md: 'documentation' as FileCategory,
    mdx: 'documentation' as FileCategory,
    txt: 'documentation' as FileCategory,
    rst: 'documentation' as FileCategory,
    json: 'config' as FileCategory,
    yaml: 'config' as FileCategory,
    yml: 'config' as FileCategory,
    toml: 'config' as FileCategory,
    env: 'config' as FileCategory,
    gitignore: 'config' as FileCategory,
    eslintrc: 'config' as FileCategory,
    css: 'asset' as FileCategory,
    scss: 'asset' as FileCategory,
    sass: 'asset' as FileCategory,
    less: 'asset' as FileCategory,
    png: 'asset' as FileCategory,
    jpg: 'asset' as FileCategory,
    jpeg: 'asset' as FileCategory,
    gif: 'asset' as FileCategory,
    ico: 'asset' as FileCategory,
    webp: 'asset' as FileCategory,
    test: 'test' as FileCategory,
    spec: 'test' as FileCategory,
    Makefile: 'build' as FileCategory,
    Dockerfile: 'build' as FileCategory,
    csv: 'data' as FileCategory,
    tsv: 'data' as FileCategory,
  };
  return map[ext] || ('other' as FileCategory);
}

function getColorForCategory(category: FileCategory): string {
  return CATEGORY_COLORS[category] || '#94a3b8';
}

// ── Build the file tree from commit data ───────────────────────────────

function buildFileTree(commits: CommitData[]): TreemapNode {
  const fileStats = new Map<
    string,
    { changeCount: number; additions: number; deletions: number; category: FileCategory }
  >();

  for (const commit of commits) {
    for (const file of commit.files) {
      const existing = fileStats.get(file.path);
      const ext = file.extension || file.path.split('.').pop() || '';
      const category = file.category || getCategoryFromExtension(ext);

      if (existing) {
        existing.changeCount += 1;
        existing.additions += file.additions;
        existing.deletions += file.deletions;
      } else {
        fileStats.set(file.path, {
          changeCount: 1,
          additions: file.additions,
          deletions: file.deletions,
          category,
        });
      }
    }
  }

  // Build nested directory structure
  const root: TreemapNode = {
    name: '/',
    path: '/',
    size: 0,
    children: [],
    isDirectory: true,
    changeCount: 0,
    additions: 0,
    deletions: 0,
    fileCount: 0,
  };

  for (const [filePath, stats] of fileStats) {
    const parts = filePath.split('/').filter(Boolean);
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = '/' + parts.slice(0, i + 1).join('/');

      if (isFile) {
        const fileNode: TreemapNode = {
          name: part,
          path: currentPath,
          size: stats.changeCount,
          isDirectory: false,
          category: stats.category,
          color: getColorForCategory(stats.category),
          changeCount: stats.changeCount,
          additions: stats.additions,
          deletions: stats.deletions,
        };
        if (!currentNode.children) currentNode.children = [];
        currentNode.children.push(fileNode);
        // Bubble up stats
        currentNode.changeCount += stats.changeCount;
        currentNode.additions += stats.additions;
        currentNode.deletions += stats.deletions;
        currentNode.size += stats.changeCount;
        if (currentNode.fileCount !== undefined) currentNode.fileCount += 1;
      } else {
        if (!currentNode.children) currentNode.children = [];
        let dirNode = currentNode.children.find(
          (c) => c.name === part && c.isDirectory
        );
        if (!dirNode) {
          dirNode = {
            name: part,
            path: currentPath,
            size: 0,
            children: [],
            isDirectory: true,
            changeCount: 0,
            additions: 0,
            deletions: 0,
            fileCount: 0,
          };
          currentNode.children.push(dirNode);
        }
        currentNode = dirNode;
      }
    }
  }

  // Propagate sizes upward
  function propagateSize(node: TreemapNode): number {
    if (!node.children || node.children.length === 0) {
      return node.size;
    }
    let totalSize = 0;
    let totalFiles = 0;
    for (const child of node.children) {
      totalSize += propagateSize(child);
      totalFiles += child.isDirectory ? (child.fileCount || 0) : 1;
    }
    node.size = totalSize;
    node.fileCount = totalFiles;
    return totalSize;
  }
  propagateSize(root);

  return root;
}

function findNodeByPath(root: TreemapNode, path: string): TreemapNode | null {
  if (root.path === path) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

// ── Custom Treemap Cell Content ────────────────────────────────────────

const CustomTreemapContent: React.FC<CustomContentProps> = ({
  x,
  y,
  width,
  height,
  name,
  color,
  isDirectory,
  depth,
}) => {
  if (width < 2 || height < 2) return null;

  const cellColor = isDirectory
    ? CATEGORY_COLORS.directory
    : color || '#94a3b8';

  const showLabel = width > 40 && height > 20;
  const showIcon = width > 24 && height > 24;
  const fontSize = Math.min(12, Math.max(8, width / 10));

  // Lighten color for depth
  const opacity = Math.max(0.5, 1 - depth * 0.15);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        ry={3}
        style={{
          fill: cellColor,
          fillOpacity: opacity,
          stroke: '#1a1a2e',
          strokeWidth: 1.5,
          cursor: isDirectory ? 'pointer' : 'default',
          transition: 'fill-opacity 0.2s ease',
        }}
      />
      {/* Subtle inner glow */}
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={2}
        ry={2}
        style={{
          fill: 'none',
          stroke: 'rgba(255,255,255,0.08)',
          strokeWidth: 1,
        }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showIcon ? 4 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${fontSize}px`,
            fill: '#e2e8f0',
            fontWeight: isDirectory ? 600 : 400,
            pointerEvents: 'none',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          {name.length > Math.floor(width / (fontSize * 0.6))
            ? name.slice(0, Math.floor(width / (fontSize * 0.6))) + '…'
            : name}
        </text>
      )}
    </g>
  );
};

// ── Custom Tooltip ─────────────────────────────────────────────────────

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}> = ({ active, payload }) => {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        {data.isDirectory ? (
          <FolderOpen className="h-4 w-4 text-indigo-400" />
        ) : (
          <FileCode className="h-4 w-4 text-blue-400" />
        )}
        <span className="font-semibold text-white text-sm">{data.name}</span>
        {data.category && (
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0"
            style={{
              borderColor: getColorForCategory(data.category),
              color: getColorForCategory(data.category),
            }}
          >
            {data.category}
          </Badge>
        )}
      </div>
      <div className="space-y-1 text-xs text-gray-300">
        <div className="flex justify-between gap-4">
          <span>Changes</span>
          <span className="font-mono font-medium text-white">
            {data.changeCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-green-400">Additions</span>
          <span className="font-mono font-medium text-green-400">
            +{data.additions.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-400">Deletions</span>
          <span className="font-mono font-medium text-red-400">
            -{data.deletions.toLocaleString()}
          </span>
        </div>
        {data.isDirectory && data.fileCount !== undefined && (
          <div className="flex justify-between gap-4 pt-1 border-t border-white/10">
            <span>Files</span>
            <span className="font-mono font-medium text-white">
              {data.fileCount}
            </span>
          </div>
        )}
      </div>
      {data.isDirectory && (
        <div className="mt-2 text-xs text-indigo-300 italic">
          Click to drill in →
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────

export function FileChangeTreemap({
  commits,
  repoName,
}: FileChangeTreemapProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['/']);

  const fileTree = useMemo(() => buildFileTree(commits), [commits]);

  const currentPath = breadcrumbs[breadcrumbs.length - 1];
  const currentNode = useMemo(
    () => findNodeByPath(fileTree, currentPath) || fileTree,
    [fileTree, currentPath]
  );

  // Prepare data for Recharts Treemap
  const treemapData = useMemo(() => {
    if (!currentNode.children || currentNode.children.length === 0) {
      return [
        {
          name: currentNode.name,
          size: currentNode.size || 1,
          color: currentNode.color || '#94a3b8',
          isDirectory: currentNode.isDirectory,
          category: currentNode.category,
          changeCount: currentNode.changeCount,
          additions: currentNode.additions,
          deletions: currentNode.deletions,
          path: currentNode.path,
          fileCount: currentNode.fileCount,
        },
      ];
    }

    return currentNode.children
      .filter((child) => child.size > 0)
      .sort((a, b) => b.size - a.size)
      .map((child) => ({
        name: child.name,
        size: child.size,
        color: child.isDirectory
          ? CATEGORY_COLORS.directory
          : child.color || '#94a3b8',
        isDirectory: child.isDirectory,
        category: child.category,
        changeCount: child.changeCount,
        additions: child.additions,
        deletions: child.deletions,
        path: child.path,
        fileCount: child.fileCount,
      }));
  }, [currentNode]);

  const handleClick = useCallback(
    (data: { path?: string; isDirectory?: boolean }) => {
      if (data && data.isDirectory && data.path) {
        setBreadcrumbs((prev) => [...prev, data.path!]);
      }
    },
    []
  );

  const handleBreadcrumbClick = useCallback((index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const handleBack = useCallback(() => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs((prev) => prev.slice(0, -1));
    }
  }, [breadcrumbs.length]);

  // Category legend
  const visibleCategories = useMemo(() => {
    const cats = new Set<string>();
    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (child.isDirectory) {
          cats.add('directory');
        } else if (child.category) {
          cats.add(child.category);
        }
      }
    }
    return Array.from(cats);
  }, [currentNode]);

  const totalFiles = currentNode.fileCount || 0;
  const totalChanges = currentNode.changeCount || 0;

  return (
    <Card className="border-white/10 bg-gray-950/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">
                File Change Treemap
              </CardTitle>
              <p className="text-sm text-gray-400">
                {repoName
                  ? `${repoName} — `
                  : ''}
                Sized by change frequency, colored by file type
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="font-mono">{totalFiles.toLocaleString()} files</span>
            <span className="text-white/20">|</span>
            <span className="font-mono">{totalChanges.toLocaleString()} changes</span>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          {breadcrumbs.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-7 px-2 text-gray-400 hover:text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const displayName = crumb === '/' ? 'root' : crumb.split('/').filter(Boolean).pop() || crumb;
            return (
              <React.Fragment key={crumb + index}>
                {index > 0 && (
                  <span className="text-gray-600 text-xs">/</span>
                )}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    isLast
                      ? 'text-white font-medium bg-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  disabled={isLast}
                >
                  {index === 0 ? (
                    <FolderOpen className="h-3.5 w-3.5 inline-block mr-1" />
                  ) : null}
                  {displayName}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {treemapData.length === 0 ? (
          <div className="flex items-center justify-center h-80 text-gray-500">
            <p>No file changes found in commit data</p>
          </div>
        ) : (
          <div className="w-full h-[420px] rounded-lg overflow-hidden border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                nameKey="name"
                stroke="#1a1a2e"
                content={
                  <CustomTreemapContent
                    x={0}
                    y={0}
                    width={0}
                    height={0}
                    name=""
                    depth={0}
                    index={0}
                  />
                }
                onClick={(node) => {
                  if (node && typeof node === 'object' && 'path' in node) {
                    handleClick(node as { path?: string; isDirectory?: boolean });
                  }
                }}
                animationDuration={400}
                animationEasing="ease-out"
                isAnimationActive={true}
              >
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={false}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {visibleCategories.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/5">
            {visibleCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor:
                      cat === 'directory'
                        ? CATEGORY_COLORS.directory
                        : getColorForCategory(cat as FileCategory),
                  }}
                />
                <span className="text-xs text-gray-400 capitalize">{cat}</span>
              </div>
            ))}
          </div>
        )}

        {/* Top changed files list */}
        {currentNode.children && currentNode.children.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Most Changed
            </h4>
            <div className="space-y-1">
              {currentNode.children
                .sort((a, b) => b.changeCount - a.changeCount)
                .slice(0, 5)
                .map((child) => (
                  <div
                    key={child.path}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                      child.isDirectory
                        ? 'hover:bg-white/5 cursor-pointer'
                        : 'hover:bg-white/3'
                    }`}
                    onClick={() => {
                      if (child.isDirectory) {
                        handleClick({ path: child.path, isDirectory: true });
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {child.isDirectory ? (
                        <FolderOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: child.color || '#94a3b8',
                          }}
                        />
                      )}
                      <span className="text-gray-300 truncate font-mono text-xs">
                        {child.name}
                      </span>
                      {child.isDirectory && child.fileCount !== undefined && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 text-gray-500 border-gray-700"
                        >
                          {child.fileCount} files
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                      <span className="text-green-400">
                        +{child.additions.toLocaleString()}
                      </span>
                      <span className="text-red-400">
                        -{child.deletions.toLocaleString()}
                      </span>
                      <span className="text-gray-500 w-12 text-right">
                        {child.changeCount}×
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
