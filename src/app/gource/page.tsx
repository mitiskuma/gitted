'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGitData } from '@/context/git-data-provider';
import { useGourcePlayback } from '@/hooks/use-gource-playback';
import { createGourceEngine } from '@/lib/gource-engine';
import type { GourceEngine } from '@/lib/gource-engine';
import { GourceViewer } from '@/components/gource/gource-viewer';
import { PlaybackControls } from '@/components/gource/playback-controls';
import { TimelineScrubber } from '@/components/gource/timeline-scrubber';
import { ContributorLegend } from '@/components/gource/contributor-legend';
import { RepoSelectorTabs } from '@/components/gource/repo-selector-tabs';
import { VisualizationSettings } from '@/components/gource/visualization-settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Maximize,
  Minimize,
  Users,
  GitBranch,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Download,
} from 'lucide-react';
import type {
  GourceContributor,
  GourceSettings,
  GourceCommitEvent,
} from '@/lib/types';
import {
  PlaybackSpeed,
  DEFAULT_GOURCE_SETTINGS,
} from '@/lib/types';

/** Main Gource visualization page orchestrating the viewer, playback, and settings. */
export default function GourcePage() {
  const router = useRouter();
  const {
    selectedRepositories,
    allCommitsSorted,
    contributors,
    fetchSelectedRepoData,
  } = useGitData();

  // Derive real contributor list from provider data
  const realContributors = useMemo(
    () => Object.values(contributors),
    [contributors],
  );

  // Engine & playback
  const engineRef = useRef<GourceEngine | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const playback = useGourcePlayback();

  // Page state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<string>('Waiting for data...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [highlightedContributor, setHighlightedContributor] = useState<string | null>(null);
  const [settings, setSettings] = useState<GourceSettings>({ ...DEFAULT_GOURCE_SETTINGS });
  const [commitDensity, setCommitDensity] = useState<number[]>([]);
  const [gourceContributors, setGourceContributors] = useState<GourceContributor[]>([]);
  const [repoColors, setRepoColors] = useState<Map<string, string>>(new Map());
  const [commitEventsForViewer, setCommitEventsForViewer] = useState<GourceCommitEvent[]>([]);
  const [timelineStartDate, setTimelineStartDate] = useState('');
  const [timelineEndDate, setTimelineEndDate] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Fetch data if we have selected repos but no commits yet
  useEffect(() => {
    if (selectedRepositories.length > 0 && allCommitsSorted.length === 0) {
      setLoadingPhase('Fetching commit data...');
      setLoadingProgress(10);
      fetchSelectedRepoData();
    }
  }, [selectedRepositories, allCommitsSorted.length, fetchSelectedRepoData]);

  // Convert commits to GourceCommitEvents and prepare viewer data
  // (no engine needed — just a lightweight data transform)
  useEffect(() => {
    if (selectedRepositories.length === 0) {
      setIsLoading(false);
      return;
    }
    if (allCommitsSorted.length === 0) return;

    try {
      setLoadingPhase('Processing commit history...');
      setLoadingProgress(50);

      // Use a temporary engine to convert commits → GourceCommitEvents
      // and extract metadata. This engine has no canvas — just data processing.
      const tempEngine = createGourceEngine({
        commits: allCommitsSorted,
        repositories: selectedRepositories,
        contributors: realContributors,
      });

      setLoadingPhase('Building file tree...');
      setLoadingProgress(70);

      // Extract the processed commit events for the viewer
      const events = tempEngine.getCommitEvents();
      setCommitEventsForViewer(events);

      // Extract metadata for UI controls
      setCommitDensity(tempEngine.getCommitDensity(120));
      setGourceContributors(Array.from(tempEngine.getContributors().values()));
      setRepoColors(tempEngine.getRepoColors());
      setSettings(tempEngine.getSettings());
      setTimelineStartDate(tempEngine.getStartDate());
      setTimelineEndDate(tempEngine.getEndDate());

      setLoadingPhase('Initializing renderer...');
      setLoadingProgress(90);

      // Destroy the temp engine — the GourceViewer will create its own
      // with a canvas for actual rendering.
      tempEngine.destroy();

      setIsInitialized(true);
      setIsLoading(false);
      setLoadingProgress(100);
    } catch (err) {
      console.error('Failed to prepare Gource data:', err);
      setError('Failed to initialize the visualization engine. Please try again.');
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepositories, allCommitsSorted, realContributors]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      canvasContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Settings change
  const handleSettingsChange = useCallback((partialSettings: Partial<GourceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partialSettings };
      engineRef.current?.setSettings(partialSettings);
      return updated;
    });
  }, []);

  // Settings reset
  const handleSettingsReset = useCallback(() => {
    setSettings({ ...DEFAULT_GOURCE_SETTINGS });
    engineRef.current?.setSettings({ ...DEFAULT_GOURCE_SETTINGS });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (playback.isPlaying) {
            playback.pause();
          } else {
            playback.play();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const speeds = [PlaybackSpeed.HALF, PlaybackSpeed.NORMAL, PlaybackSpeed.DOUBLE, PlaybackSpeed.FAST, PlaybackSpeed.ULTRA];
            const currentIdx = speeds.indexOf(playback.speed);
            if (currentIdx < speeds.length - 1) {
              playback.setSpeed(speeds[currentIdx + 1]);
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const speeds = [PlaybackSpeed.HALF, PlaybackSpeed.NORMAL, PlaybackSpeed.DOUBLE, PlaybackSpeed.FAST, PlaybackSpeed.ULTRA];
            const currentIdx = speeds.indexOf(playback.speed);
            if (currentIdx > 0) {
              playback.setSpeed(speeds[currentIdx - 1]);
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          playback.seek(Math.min(1, playback.progress + 0.05));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playback.seek(Math.max(0, playback.progress - 0.05));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'r':
          engineRef.current?.resetCamera();
          break;
        case 'l':
          handleSettingsChange({ showLabels: !settings.showLabels });
          break;
        case 'a':
          handleSettingsChange({ showAvatars: !settings.showAvatars });
          break;
        case '+':
        case '=':
          engineRef.current?.zoomCamera(-100);
          break;
        case '-':
        case '_':
          engineRef.current?.zoomCamera(100);
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          }
          engineRef.current?.highlightContributor(null);
          setHighlightedContributor(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playback, settings, toggleFullscreen, handleSettingsChange]);

  // Repo tab change
  const handleRepoChange = useCallback((repoId: string | null) => {
    setActiveRepoId(repoId);
    engineRef.current?.setActiveRepo(repoId);
  }, []);

  // Contributor highlight
  const handleContributorClick = useCallback((contributorId: string) => {
    setHighlightedContributor((prev) => {
      const newVal = prev === contributorId ? null : contributorId;
      engineRef.current?.highlightContributor(newVal);
      return newVal;
    });
  }, []);

  // Update contributor list periodically
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      if (engineRef.current) {
        const contributorMap = engineRef.current.getContributors();
        setGourceContributors(Array.from(contributorMap.values()));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Clear engine ref on unmount to prevent stale references after viewer destroys engine
  useEffect(() => {
    return () => {
      engineRef.current = null;
    };
  }, []);

  // Engine ready callback (from GourceViewer)
  // The viewer owns the real engine (with canvas). Connect it to our playback controls.
  const handleEngineReady = useCallback((engine: GourceEngine) => {
    engineRef.current = engine;
    playback.setEngine(engine);
    setTimeout(() => {
      playback.play();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.setEngine, playback.play]);

  // Video recording toggle
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    // Start recording
    const container = canvasContainerRef.current;
    if (!container) return;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(30); // 30fps
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `gource-${new Date().toISOString().split('T')[0]}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      recorder.start(1000); // collect data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Also start playback if not already playing
      if (!playback.isPlaying) {
        playback.play();
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [isRecording, playback]);

  // No repos selected state
  if (!isLoading && selectedRepositories.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <GitBranch className="h-12 w-12 text-blue-400/50" />
          <div>
            <h2 className="text-xl font-semibold text-white">No Repositories Selected</h2>
            <p className="mt-2 text-sm text-white/60">
              Select repositories on the Connect page to visualize their commit history.
            </p>
          </div>
          <Button
            onClick={() => router.push('/connect')}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Connect
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <div className="relative rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-4">
              <GitBranch className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <span className="text-lg font-medium text-white/80">
              {loadingPhase}
            </span>
          </div>
          <p className="max-w-sm text-center text-sm text-white/40">
            {allCommitsSorted.length > 0
              ? `Processing ${allCommitsSorted.length.toLocaleString()} commits from ${selectedRepositories.length} ${selectedRepositories.length === 1 ? 'repository' : 'repositories'}`
              : `Fetching commits from ${selectedRepositories.length} ${selectedRepositories.length === 1 ? 'repository' : 'repositories'}`}
          </p>
          {/* Progress bar */}
          <div className="w-64">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-xs text-white/30">
              {loadingProgress}%
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="flex max-w-md flex-col items-center gap-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Visualization Error</h2>
            <p className="mt-2 text-sm text-white/60">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasContainerRef}
      className="relative flex h-screen flex-col overflow-hidden bg-[#0a0a0f]"
    >
      {/* Top Bar: Repo Selector Tabs + Controls */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/5 bg-[#0a0a0f]/90 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-white/50 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Dashboard</span>
            </Button>
          )}
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <RepoSelectorTabs
            repositories={selectedRepositories}
            activeRepoId={activeRepoId}
            onRepoChange={handleRepoChange}
            repoColors={repoColors}
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden border-white/10 bg-white/5 text-xs text-white/50 sm:flex"
          >
            <GitBranch className="mr-1 h-3 w-3" />
            {allCommitsSorted.length} commits
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleRecording}
            className={`h-8 w-8 hover:bg-white/5 hover:text-white ${isRecording ? 'text-red-400 animate-pulse' : 'text-white/50'}`}
            aria-label={isRecording ? 'Stop recording and download' : 'Record video'}
          >
            {isRecording ? (
              <div className="h-3 w-3 rounded-sm bg-red-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLegend(!showLegend)}
            className={`h-8 w-8 text-white/50 hover:bg-white/5 hover:text-white ${showLegend ? 'bg-white/10 text-white' : ''}`}
            aria-label={showLegend ? 'Hide contributor legend' : 'Show contributor legend'}
          >
            <Users className="h-4 w-4" />
          </Button>

          <VisualizationSettings
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onReset={handleSettingsReset}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 text-white/50 hover:bg-white/5 hover:text-white"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Gource Canvas Viewer */}
        <div className="relative flex-1">
          {isInitialized && commitEventsForViewer.length > 0 && (
            <GourceViewer
              events={commitEventsForViewer}
              repositories={selectedRepositories}
              contributors={realContributors}
              settings={settings}
              combinedView={activeRepoId === null}
              activeRepoId={activeRepoId}
              onEngineReady={handleEngineReady}
              className="h-full w-full"
            />
          )}

          {/* Keyboard Shortcuts Help — bottom left */}
          <div className="absolute bottom-24 left-3 z-20 hidden select-none lg:block">
            <div className="rounded-lg border border-white/5 bg-black/40 px-3 py-2 backdrop-blur-sm">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/30">
                Keyboard Shortcuts
              </p>
              <div className="space-y-0.5 text-[10px] text-white/20">
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">Space</kbd> Play/Pause</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">Arrow Up/Down</kbd> Speed</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">Arrow Left/Right</kbd> Seek</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">F</kbd> Fullscreen</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">R</kbd> Reset Camera</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">L</kbd> Labels</p>
                <p><kbd className="rounded bg-white/10 px-1 text-white/40">A</kbd> Avatars</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contributor Legend Sidebar */}
        {showLegend && gourceContributors.length > 0 && (
          <div className="absolute right-0 top-0 z-20 h-full lg:relative">
            <ContributorLegend
              contributors={gourceContributors}
              highlightedId={highlightedContributor}
              onContributorClick={handleContributorClick}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Area */}
      <div className="relative z-30 border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
        {/* Timeline Scrubber */}
        <div className="px-3 pt-2 sm:px-4">
          <TimelineScrubber
            progress={playback.progress}
            onSeek={playback.seek}
            onSeekStart={() => playback.pause()}
            startDate={timelineStartDate}
            endDate={timelineEndDate}
            commitDensity={commitDensity}
          />
        </div>

        {/* Playback Controls */}
        <div className="relative px-3 pb-2 sm:px-4">
          <PlaybackControls
            playbackState={playback.state}
            speed={playback.speed}
            currentDate={playback.currentDate}
            onPlay={playback.play}
            onPause={playback.pause}
            onSpeedChange={playback.setSpeed}
            onFullscreenToggle={toggleFullscreen}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>
    </div>
  );
}
