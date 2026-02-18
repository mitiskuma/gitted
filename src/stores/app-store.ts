"use client";

import { create } from "zustand";
import { ProcessingStatus } from "@/lib/types";

// App-level state store

export interface AppState {
  /** Whether the app is initialized */
  isInitialized: boolean;
  /** Current step in the flow */
  currentStep: "connect" | "select" | "analyze" | "visualize" | "wrapped";
  /** Whether dark mode is active */
  isDarkMode: boolean;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Volume level 0-1 */
  volume: number;
  /** Whether fullscreen */
  isFullscreen: boolean;
  /** Error message */
  error: string | null;
  /** Selected repository IDs */
  selectedRepos: string[];
  /** Current processing status */
  processingStatus: ProcessingStatus;
  /** Current wrapped slideshow index */
  wrappedSlideIndex: number;
}

export interface AppActions {
  setInitialized: (value: boolean) => void;
  setCurrentStep: (step: AppState["currentStep"]) => void;
  setDarkMode: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  setVolume: (value: number) => void;
  setFullscreen: (value: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedRepos: (repos: string[]) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  setWrappedSlideIndex: (index: number) => void;
  reset: () => void;
}

const initialState: AppState = {
  isInitialized: false,
  currentStep: "connect",
  isDarkMode: true,
  isMuted: false,
  volume: 0.7,
  isFullscreen: false,
  error: null,
  selectedRepos: [],
  processingStatus: ProcessingStatus.IDLE,
  wrappedSlideIndex: 0,
};

export const useAppStore = create<AppState & AppActions>((set) => ({
  ...initialState,

  setInitialized: (value: boolean) => set({ isInitialized: value }),

  setCurrentStep: (step: AppState["currentStep"]) =>
    set({ currentStep: step }),

  setDarkMode: (value: boolean) => set({ isDarkMode: value }),

  setMuted: (value: boolean) => set({ isMuted: value }),

  setVolume: (value: number) => set({ volume: Math.max(0, Math.min(1, value)) }),

  setFullscreen: (value: boolean) => set({ isFullscreen: value }),

  setError: (error: string | null) => set({ error }),

  setSelectedRepos: (repos: string[]) => set({ selectedRepos: repos }),

  setProcessingStatus: (status: ProcessingStatus) => set({ processingStatus: status }),

  setWrappedSlideIndex: (index: number) => set({ wrappedSlideIndex: index }),

  reset: () => set(initialState),
}));

// Selectors
export const selectSelectedRepos = (state: AppState & AppActions) => state.selectedRepos;
export const selectHasSelectedRepos = (state: AppState & AppActions) => state.selectedRepos.length > 0;
