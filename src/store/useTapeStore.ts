import { create } from "zustand";
import type { TapeTag } from "@/types/tape";
import { AUDIO_CONSTRAINTS } from "@/types/tape";

export type DeckMode = "RECORD" | "LISTEN" | "MAILBOX";

export type DeckStatus =
  | "IDLE"
  | "RECORDING"
  | "PAUSED_REC"
  | "RECORDED"
  | "PLAYING"
  | "PAUSED_PLAY"
  | "EJECTING";

export interface TapeState {
  mode: DeckMode;
  status: DeckStatus;
  elapsedSeconds: number;
  recordedDuration: number;
  selectedTag: TapeTag;
  voiceMaskEnabled: boolean;

  // Ambient & 2-Layer Scene controls
  deckOpen: boolean;
  doorEventCount: number;
  lightningEventCount: number;
  hasUnreadReply: boolean;
  audioUnlocked: boolean;
  rainEnabled: boolean;
  rainVolume: number; // 0.0 -> 1.0
  teaSteaming: boolean;

  // Listen mode mock/active tape info
  activeListenDuration: number;
  activeListenTag: TapeTag;
  activeRemainingHours: number;

  // Actions
  setMode: (mode: DeckMode) => void;
  setStatus: (status: DeckStatus) => void;
  setElapsedSeconds: (seconds: number) => void;
  tickSecond: () => void;
  setSelectedTag: (tag: TapeTag) => void;
  toggleVoiceMask: () => void;
  setAudioUnlocked: (unlocked: boolean) => void;
  setHasUnreadReply: (unread: boolean) => void;
  setDeckOpen: (open: boolean) => void;
  triggerDoorEvent: () => void;
  triggerLightningEvent: () => void;
  toggleRain: () => void;
  setRainVolume: (volume: number) => void;
  setActiveListenDuration: (duration: number) => void;
  triggerTeaSteam: () => void;
  resetTape: () => void;
}

export const useTapeStore = create<TapeState>((set, get) => ({
  mode: "RECORD",
  status: "IDLE",
  elapsedSeconds: 0,
  recordedDuration: 0,
  selectedTag: "QUARTER_LIFE",
  voiceMaskEnabled: false,

  deckOpen: false,
  doorEventCount: 0,
  lightningEventCount: 0,
  hasUnreadReply: false,
  audioUnlocked: false,
  rainEnabled: true,
  rainVolume: 0.45,
  teaSteaming: true,

  activeListenDuration: 192, // 3:12 demo tape for Phase 1 UI testing
  activeListenTag: "LONELY",
  activeRemainingHours: 18,

  setMode: (mode) =>
    set({
      mode,
      status: "IDLE",
      elapsedSeconds: 0,
    }),

  setStatus: (status) => set({ status }),

  setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds }),

  tickSecond: () => {
    const { status, elapsedSeconds, mode, activeListenDuration, recordedDuration } = get();

    if (status === "RECORDING") {
      const next = elapsedSeconds + 1;
      if (next >= AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS) {
        set({
          elapsedSeconds: AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS,
          recordedDuration: AUDIO_CONSTRAINTS.MAX_TAPE_DURATION_SECONDS,
          status: "RECORDED",
        });
      } else {
        set({ elapsedSeconds: next, recordedDuration: next });
      }
      return;
    }

    if (status === "PLAYING") {
      const limit = mode === "RECORD" ? recordedDuration : activeListenDuration;
      const next = elapsedSeconds + 1;
      if (limit > 0 && next >= limit) {
        set({
          elapsedSeconds: 0,
          status: mode === "RECORD" ? "RECORDED" : "IDLE",
        });
      } else {
        set({ elapsedSeconds: next });
      }
    }
  },

  setSelectedTag: (selectedTag) => set({ selectedTag }),

  toggleVoiceMask: () =>
    set((state) => ({ voiceMaskEnabled: !state.voiceMaskEnabled })),

  setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),

  setHasUnreadReply: (hasUnreadReply) => set({ hasUnreadReply }),

  setDeckOpen: (deckOpen) => set({ deckOpen }),

  triggerDoorEvent: () =>
    set((state) => ({ doorEventCount: state.doorEventCount + 1 })),

  triggerLightningEvent: () =>
    set((state) => ({ lightningEventCount: state.lightningEventCount + 1 })),

  toggleRain: () => set((state) => ({ rainEnabled: !state.rainEnabled })),

  setRainVolume: (rainVolume) =>
    set({ rainVolume: Math.max(0, Math.min(1, rainVolume)) }),

  setActiveListenDuration: (activeListenDuration) =>
    set({ activeListenDuration }),

  triggerTeaSteam: () => set({ teaSteaming: true }),

  resetTape: () =>
    set({
      status: "IDLE",
      elapsedSeconds: 0,
      recordedDuration: 0,
    }),
}));
