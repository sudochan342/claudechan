'use client';

import { create } from 'zustand';
import { DebateMessage } from '@/lib/agents';

interface DebateState {
  // Current debate
  topic: string;
  messages: DebateMessage[];
  synthesis: string | null;
  isDebating: boolean;
  currentSpeaker: 'lumis' | 'umbra' | 'synthesis' | null;
  debateId: string | null;

  // UI State
  showHistory: boolean;

  // Actions
  setTopic: (topic: string) => void;
  startDebate: () => void;
  addMessage: (message: DebateMessage) => void;
  setSynthesis: (synthesis: string) => void;
  setCurrentSpeaker: (speaker: 'lumis' | 'umbra' | 'synthesis' | null) => void;
  endDebate: () => void;
  resetDebate: () => void;
  toggleHistory: () => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  // Initial state
  topic: '',
  messages: [],
  synthesis: null,
  isDebating: false,
  currentSpeaker: null,
  debateId: null,
  showHistory: false,

  // Actions
  setTopic: (topic) => set({ topic }),

  startDebate: () => set({
    isDebating: true,
    messages: [],
    synthesis: null,
    debateId: `debate_${Date.now()}`,
  }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  setSynthesis: (synthesis) => set({ synthesis }),

  setCurrentSpeaker: (speaker) => set({ currentSpeaker: speaker }),

  endDebate: () => set({
    isDebating: false,
    currentSpeaker: null,
  }),

  resetDebate: () => set({
    topic: '',
    messages: [],
    synthesis: null,
    isDebating: false,
    currentSpeaker: null,
    debateId: null,
  }),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),
}));
