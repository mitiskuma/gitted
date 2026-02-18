'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GourceViewerProps,
  GourceNode,
  GourceContributor,
  Point,
} from '@/lib/types';
import { FileCategory } from '@/lib/types';
import { GourceEngine, createGourceEngine, screenToWorld, hitTestNode, hitTestContributor } from '@/lib/gource-engine';
import type { GourceEngineData } from '@/lib/gource-engine';
import { cn } from '@/lib/utils';

interface GourceViewerInternalProps extends GourceViewerProps {
  className?: string;
  onEngineReady?: (engine: GourceEngine) => void;
  onNodeHover?: (node: GourceNode | null) => void;
  onContributorHover?: (contributor: GourceContributor | null) => void;
}

export function GourceViewer({
  events,
  repositories,
  contributors,
  settings: initialSettings,
  combinedView,
  activeRepoId,
  onPlaybackChange,
  onDateChange,
  onEngineReady,
  onNodeHover,
  onContributorHover,
  className,
}: GourceViewerInternalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GourceEngine | null>(null);
  const isInitializedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Mouse / input state refs (avoid re-renders)
  const mouseStateRef = useRef<{
    isDown: boolean;
    isDragging: boolean;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    dragThreshold: number;
  }>({
    isDown: false,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    dragThreshold: 4,
  });

  // Touch state for pinch zoom
  const touchStateRef = useRef<{
    touches: Array<{ id: number; x: number; y: number }>;
    lastPinchDistance: number | null;
    lastCenterX: number;
    lastCenterY: number;
  }>({
    touches: [],
    lastPinchDistance: null,
    lastCenterX: 0,
    lastCenterY: 0,
  });

  const [hoveredNode, setHoveredNode] = useState<GourceNode | null>(null);
  const [hoveredContributor, setHoveredContributor] = useState<GourceContributor | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // =========================================================================
  // ENGINE INITIALIZATION
  // =========================================================================

  useEffect(() => {
    if (isInitializedRef.current) return;
    if (!canvasRef.current || !containerRef.current) return;
    if (events.length === 0 && repositories.length === 0) return;

    isInitializedRef.current = true;

    // Build commit data from events — the engine expects CommitData[]
    // but we receive GourceCommitEvent[]. We need to adapt.
    // The GourceEngine constructor accepts GourceEngineData which takes CommitData[].
    // Since we already have processed events, we'll create a minimal CommitData mapping.
    const commitDataForEngine = events.map((event) => ({
      sha: event.sha,
      shortSha: event.sha.substring(0, 7),
      message: `Commit ${event.sha.substring(0, 7)}`,
      messageHeadline: `Commit ${event.sha.substring(0, 7)}`,
      author: {
        name: event.contributorName,
        email: '',
        login: event.contributorId,
        avatarUrl: event.contributorAvatarUrl,
      },
      committer: {
        name: event.contributorName,
        email: '',
        login: event.contributorId,
        avatarUrl: event.contributorAvatarUrl,
      },
      timestamp: new Date(event.timestamp).toISOString(),
      timestampMs: event.timestamp,
      repoId: event.repoId,
      repoName: event.repoId,
      filesChanged: event.affectedFiles.length,
      additions: event.affectedFiles.reduce((sum, f) => sum + f.additions, 0),
      deletions: event.affectedFiles.reduce((sum, f) => sum + f.deletions, 0),
      totalChanges: event.affectedFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0),
      isMerge: false,
      parents: [],
      files: event.affectedFiles.map((f) => ({
        path: f.path,
        filename: f.path.split('/').pop() || f.path,
        directory: f.path.split('/').slice(0, -1).join('/') || '/',
        extension: (f.path.split('.').pop() || '').toLowerCase(),
        status: f.type === 'add' ? 'added' as const : f.type === 'delete' ? 'removed' as const : f.type === 'rename' ? 'renamed' as const : 'modified' as const,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.additions + f.deletions,
        previousPath: null,
        category: FileCategory.CODE,
      })),
      htmlUrl: '',
      hourOfDay: new Date(event.timestamp).getHours(),
      dayOfWeek: new Date(event.timestamp).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      year: new Date(event.timestamp).getFullYear(),
      month: new Date(event.timestamp).getMonth() + 1,
      dayOfMonth: new Date(event.timestamp).getDate(),
      weekOfYear: 1,
      dateKey: new Date(event.timestamp).toISOString().split('T')[0],
    }));

    const engineData: GourceEngineData = {
      commits: commitDataForEngine,
      repositories,
      contributors,
    };

    const engine = createGourceEngine(engineData);
    engine.initialize(canvasRef.current);

    // Apply initial settings
    if (initialSettings) {
      engine.setSettings(initialSettings);
    }

    // Set active repo if not combined
    if (!combinedView && activeRepoId) {
      engine.setActiveRepo(activeRepoId);
    }

    // Set up engine callbacks
    engine.setCallbacks({
      onPlaybackChange: (state) => {
        onPlaybackChange?.(state);
      },
      onDateChange: (date) => {
        onDateChange?.(date);
      },
    });

    engineRef.current = engine;
    onEngineReady?.(engine);

    // Start the engine (begins render loop in paused state)
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
      isInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, repositories, contributors]);

  // =========================================================================
  // ACTIVE REPO CHANGE
  // =========================================================================

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (combinedView) {
      engine.setActiveRepo(null);
    } else if (activeRepoId) {
      engine.setActiveRepo(activeRepoId);
    }
  }, [combinedView, activeRepoId]);

  // =========================================================================
  // SETTINGS CHANGE
  // =========================================================================

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !initialSettings) return;

    engine.setSettings(initialSettings);
  }, [initialSettings]);

  // =========================================================================
  // RESIZE HANDLING
  // =========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (width > 0 && height > 0) {
        setCanvasSize({ width, height });
        const engine = engineRef.current;
        if (engine) {
          engine.resize(width, height);
        }
      }
    };

    // Initial size
    handleResize();

    // Observe size changes
    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(container);
    resizeObserverRef.current = observer;

    // Also handle window resize for fallback
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // =========================================================================
  // MOUSE EVENT HANDLERS
  // =========================================================================

  const getCanvasCoords = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const ms = mouseStateRef.current;
    ms.isDown = true;
    ms.isDragging = false;
    ms.startX = coords.x;
    ms.startY = coords.y;
    ms.lastX = coords.x;
    ms.lastY = coords.y;
  }, [getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const ms = mouseStateRef.current;
    const engine = engineRef.current;

    if (ms.isDown) {
      const dx = coords.x - ms.startX;
      const dy = coords.y - ms.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > ms.dragThreshold) {
        ms.isDragging = true;
      }

      if (ms.isDragging && engine) {
        const deltaX = coords.x - ms.lastX;
        const deltaY = coords.y - ms.lastY;
        engine.panCamera(deltaX, deltaY);
      }

      ms.lastX = coords.x;
      ms.lastY = coords.y;
    } else if (engine) {
      // Hover detection
      const state = engine.getState();
      const worldPos = screenToWorld(
        coords.x,
        coords.y,
        state.camera,
        canvasSize.width,
        canvasSize.height
      );

      const node = hitTestNode(worldPos.x, worldPos.y, engine.getNodes(), state.settings.nodeSize);
      const contributor = node ? null : hitTestContributor(worldPos.x, worldPos.y, engine.getContributors());

      if (node !== hoveredNode) {
        setHoveredNode(node);
        onNodeHover?.(node);
      }

      if (contributor !== hoveredContributor) {
        setHoveredContributor(contributor);
        onContributorHover?.(contributor);
      }

      if (node || contributor) {
        setTooltipPos({ x: coords.x, y: coords.y });
      }
    }
  }, [getCanvasCoords, canvasSize, hoveredNode, hoveredContributor, onNodeHover, onContributorHover]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ms = mouseStateRef.current;

    if (!ms.isDragging && engineRef.current) {
      // Click — could toggle contributor highlight etc.
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const engine = engineRef.current;
      const state = engine.getState();
      const worldPos = screenToWorld(
        coords.x,
        coords.y,
        state.camera,
        canvasSize.width,
        canvasSize.height
      );

      const contributor = hitTestContributor(worldPos.x, worldPos.y, engine.getContributors());
      if (contributor) {
        engine.highlightContributor(contributor.id);
      }
    }

    ms.isDown = false;
    ms.isDragging = false;
  }, [getCanvasCoords, canvasSize]);

  const handleMouseLeave = useCallback(() => {
    const ms = mouseStateRef.current;
    ms.isDown = false;
    ms.isDragging = false;
    setHoveredNode(null);
    setHoveredContributor(null);
    onNodeHover?.(null);
    onContributorHover?.(null);
  }, [onNodeHover, onContributorHover]);

  // Native wheel handler with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const engine = engineRef.current;
      if (!engine) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      engine.zoomCamera(e.deltaY, x, y);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // =========================================================================
  // TOUCH EVENT HANDLERS (mobile pinch/pan)
  // =========================================================================

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = touchStateRef.current;
    ts.touches = Array.from(e.touches).map((t) => {
      const coords = getCanvasCoords(t.clientX, t.clientY);
      return { id: t.identifier, x: coords.x, y: coords.y };
    });

    if (ts.touches.length === 2) {
      const dx = ts.touches[1].x - ts.touches[0].x;
      const dy = ts.touches[1].y - ts.touches[0].y;
      ts.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
      ts.lastCenterX = (ts.touches[0].x + ts.touches[1].x) / 2;
      ts.lastCenterY = (ts.touches[0].y + ts.touches[1].y) / 2;
    } else if (ts.touches.length === 1) {
      const ms = mouseStateRef.current;
      ms.isDown = true;
      ms.isDragging = false;
      ms.startX = ts.touches[0].x;
      ms.startY = ts.touches[0].y;
      ms.lastX = ts.touches[0].x;
      ms.lastY = ts.touches[0].y;
    }
  }, [getCanvasCoords]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const engine = engineRef.current;
    if (!engine) return;

    const ts = touchStateRef.current;
    const currentTouches = Array.from(e.touches).map((t) => {
      const coords = getCanvasCoords(t.clientX, t.clientY);
      return { id: t.identifier, x: coords.x, y: coords.y };
    });

    if (currentTouches.length === 2 && ts.lastPinchDistance !== null) {
      // Pinch zoom
      const dx = currentTouches[1].x - currentTouches[0].x;
      const dy = currentTouches[1].y - currentTouches[0].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const centerX = (currentTouches[0].x + currentTouches[1].x) / 2;
      const centerY = (currentTouches[0].y + currentTouches[1].y) / 2;

      const pinchDelta = ts.lastPinchDistance - distance;
      engine.zoomCamera(pinchDelta * 2, centerX, centerY);

      // Pan with two fingers
      const panDx = centerX - ts.lastCenterX;
      const panDy = centerY - ts.lastCenterY;
      engine.panCamera(panDx, panDy);

      ts.lastPinchDistance = distance;
      ts.lastCenterX = centerX;
      ts.lastCenterY = centerY;
    } else if (currentTouches.length === 1) {
      // Single finger pan
      const ms = mouseStateRef.current;
      const deltaX = currentTouches[0].x - ms.lastX;
      const deltaY = currentTouches[0].y - ms.lastY;
      const distance = Math.sqrt(
        (currentTouches[0].x - ms.startX) ** 2 +
        (currentTouches[0].y - ms.startY) ** 2
      );

      if (distance > ms.dragThreshold) {
        ms.isDragging = true;
        engine.panCamera(deltaX, deltaY);
      }

      ms.lastX = currentTouches[0].x;
      ms.lastY = currentTouches[0].y;
    }

    ts.touches = currentTouches;
  }, [getCanvasCoords]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const ts = touchStateRef.current;
    const ms = mouseStateRef.current;

    ts.touches = Array.from(e.touches).map((t) => {
      const coords = getCanvasCoords(t.clientX, t.clientY);
      return { id: t.identifier, x: coords.x, y: coords.y };
    });

    if (ts.touches.length < 2) {
      ts.lastPinchDistance = null;
    }

    if (ts.touches.length === 0) {
      ms.isDown = false;
      ms.isDragging = false;
    }
  }, [getCanvasCoords]);

  // =========================================================================
  // CURSOR STYLE
  // =========================================================================

  const getCursorStyle = (): string => {
    const ms = mouseStateRef.current;
    if (ms.isDragging) return 'grabbing';
    if (hoveredNode || hoveredContributor) return 'pointer';
    return 'grab';
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden bg-[#0a0a0f] select-none',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursorStyle() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Hover Tooltip */}
      {(hoveredNode || hoveredContributor) && (
        <div
          className="pointer-events-none absolute z-50 max-w-[240px] rounded-lg border border-white/10 bg-black/85 px-3 py-2 shadow-xl backdrop-blur-sm"
          style={{
            left: Math.min(tooltipPos.x + 16, canvasSize.width - 260),
            top: Math.max(tooltipPos.y - 40, 8),
            transition: 'left 0.08s ease-out, top 0.08s ease-out',
          }}
        >
          {hoveredNode && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: hoveredNode.color }}
                />
                <span className="truncate text-xs font-medium text-white/90">
                  {hoveredNode.name}
                </span>
              </div>
              <p className="truncate text-[10px] text-white/50 font-mono">
                {hoveredNode.path}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-white/40">
                {hoveredNode.isDirectory ? (
                  <span>{hoveredNode.children.length} items</span>
                ) : (
                  <>
                    <span className="uppercase">{hoveredNode.extension || 'file'}</span>
                    <span>{hoveredNode.modificationCount} edits</span>
                  </>
                )}
              </div>
            </div>
          )}
          {hoveredContributor && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hoveredContributor.avatarImage ? (
                  <div className="h-5 w-5 rounded-full overflow-hidden shrink-0 ring-1 ring-white/20">
                    <img
                      src={hoveredContributor.avatarUrl || ''}
                      alt={hoveredContributor.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: hoveredContributor.color }}
                  >
                    {hoveredContributor.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-xs font-medium text-white/90">
                  {hoveredContributor.name}
                </span>
              </div>
              <p className="text-[10px] text-white/40">
                Click to highlight commits
              </p>
            </div>
          )}
        </div>
      )}

      {/* Loading state overlay */}
      {events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/60">
                Preparing visualization...
              </p>
              <p className="mt-1 text-xs text-white/30">
                Building file tree from commit history
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint (bottom-left) */}
      <div className="absolute bottom-4 left-4 hidden text-[10px] text-white/15 lg:block">
        <div className="space-y-0.5">
          <span className="font-mono">Space</span> Play/Pause ·{' '}
          <span className="font-mono">R</span> Reset Camera ·{' '}
          <span className="font-mono">+/-</span> Zoom ·{' '}
          <span className="font-mono">L</span> Labels ·{' '}
          <span className="font-mono">A</span> Avatars
        </div>
      </div>
    </div>
  );
}

export default GourceViewer;
