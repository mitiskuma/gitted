'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GourceEngine } from '@/lib/gource-engine';
import type { UseGourcePlaybackReturn } from '@/lib/types';
import { PlaybackState, PlaybackSpeed } from '@/lib/types';

function dateToString(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toISOString().split('T')[0];
}

/**
 * Hook managing gource animation playback state.
 * Thin wrapper around GourceEngine — delegates all game logic to the engine.
 * Syncs playback state with the zustand app store (gourcePlaybackState).
 */
export function useGourcePlayback(): UseGourcePlaybackReturn & {
  engineRef: React.MutableRefObject<GourceEngine | null>;
  setEngine: (engine: GourceEngine) => void;
} {
  const engineRef = useRef<GourceEngine | null>(null);
  const animationRef = useRef<number | null>(null);

  // Playback state managed locally (not in the global zustand store)
  const [gourcePlaybackState, setGourcePlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);

  // Local state for derived values that change every frame — kept in state
  // to avoid forcing full zustand updates at 60fps
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentDate, setCurrentDate] = useState('');
  const [speed, setSpeedState] = useState<PlaybackSpeed>(PlaybackSpeed.NORMAL);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync local state from engine at ~30fps for UI updates
  const syncFromEngine = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const state = engine.getState();
    setCurrentTime(state.currentTime);
    setTotalDuration(state.totalDuration);
    setProgress(state.progress);
    setCurrentDate(state.currentDate);
    setSpeedState(state.speed);
    setIsPlaying(state.playback === PlaybackState.PLAYING);
  }, []);

  // Set up a sync loop that polls engine state for UI
  useEffect(() => {
    let lastSync = 0;
    const syncInterval = 1000 / 30; // 30fps UI updates

    const tick = (timestamp: number) => {
      if (timestamp - lastSync >= syncInterval) {
        syncFromEngine();
        lastSync = timestamp;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [syncFromEngine]);

  /**
   * Bind an engine instance to this hook.
   * Called by the gource page after constructing and initializing the engine.
   */
  const setEngine = useCallback(
    (engine: GourceEngine) => {
      engineRef.current = engine;

      // Set up engine callbacks to keep store in sync
      engine.setCallbacks({
        onPlaybackChange: (state) => {
          setGourcePlaybackState(state);
          setIsPlaying(state === PlaybackState.PLAYING);
        },
        onDateChange: (date) => {
          setCurrentDate(date);
        },
        onFrame: (engineState) => {
          // Lightweight — we batch UI updates in the sync loop above
        },
      });

      // Initialize local state from engine
      const state = engine.getState();
      setCurrentTime(state.currentTime);
      setTotalDuration(state.totalDuration);
      setProgress(state.progress);
      setCurrentDate(state.currentDate);
      setSpeedState(state.speed);
      setIsPlaying(state.playback === PlaybackState.PLAYING);
    },
    [setGourcePlaybackState],
  );

  /**
   * Start or resume playback.
   */
  const play = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const state = engine.getState();
    if (state.playback === PlaybackState.STOPPED) {
      engine.start();
    } else {
      engine.play();
    }
    setIsPlaying(true);
    setGourcePlaybackState(PlaybackState.PLAYING);
  }, [setGourcePlaybackState]);

  /**
   * Pause playback (keeps render loop alive for camera smoothing).
   */
  const pause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.pause();
    setIsPlaying(false);
    setGourcePlaybackState(PlaybackState.PAUSED);
  }, [setGourcePlaybackState]);

  /**
   * Set playback speed multiplier.
   */
  const setSpeed = useCallback((newSpeed: PlaybackSpeed) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.setSpeed(newSpeed);
    setSpeedState(newSpeed);
  }, []);

  /**
   * Seek to a specific progress position (0-1).
   */
  const seek = useCallback(
    (newProgress: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      engine.seek(newProgress);

      // Immediately sync state after seeking
      const state = engine.getState();
      setCurrentTime(state.currentTime);
      setProgress(state.progress);
      setCurrentDate(state.currentDate);
      setGourcePlaybackState(state.playback);
    },
    [setGourcePlaybackState],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) {
        engine.stop();
      }
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    speed,
    currentTime,
    totalDuration,
    progress,
    play,
    pause,
    setSpeed,
    seek,
    currentDate,
    state: gourcePlaybackState,
    engineRef,
    setEngine,
  };
}
