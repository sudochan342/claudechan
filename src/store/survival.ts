import { create } from 'zustand';

export interface PlayerStats {
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  morale: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  icon: string;
  type: 'resource' | 'tool' | 'food' | 'weapon';
}

export interface GameEvent {
  id: string;
  timestamp: number;
  source: 'god' | 'survivor' | 'system' | 'world';
  type: 'action' | 'thought' | 'environmental' | 'danger' | 'success' | 'failure' | 'resource';
  content: string;
  emoji?: string;
}

export interface WorldState {
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'cloudy' | 'rain' | 'storm';
  temperature: number;
  daysSurvived: number;
  currentLocation: string;
  threats: string[];
  resources: string[];
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  color: string;
}

export interface UserAdvice {
  id: string;
  advice: string;
  timestamp: number;
  applied: boolean;
}

interface SurvivalState {
  // Game status
  isPlaying: boolean;
  isPaused: boolean;
  gameSpeed: 1 | 2 | 3;

  // Player
  playerStats: PlayerStats;
  inventory: InventoryItem[];

  // World
  worldState: WorldState;

  // Events & logs
  gameEvents: GameEvent[];
  godThoughts: string;
  survivorThoughts: string;
  currentAction: string;

  // Chat
  chatMessages: ChatMessage[];
  viewerCount: number;

  // User advice/teaching
  userAdvice: UserAdvice[];

  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  setGameSpeed: (speed: 1 | 2 | 3) => void;

  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string, quantity?: number) => void;

  updateWorldState: (state: Partial<WorldState>) => void;

  addGameEvent: (event: Omit<GameEvent, 'id' | 'timestamp'>) => void;
  setGodThoughts: (thoughts: string) => void;
  setSurvivorThoughts: (thoughts: string) => void;
  setCurrentAction: (action: string) => void;

  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setViewerCount: (count: number) => void;

  addUserAdvice: (advice: string) => void;
  markAdviceApplied: (id: string) => void;
  getActiveAdvice: () => UserAdvice[];

  resetGame: () => void;
}

const initialPlayerStats: PlayerStats = {
  health: 100,
  hunger: 100,
  thirst: 100,
  energy: 100,
  morale: 75,
};

const initialWorldState: WorldState = {
  timeOfDay: 'dawn',
  weather: 'clear',
  temperature: 18,
  daysSurvived: 0,
  currentLocation: 'Forest Clearing',
  threats: [],
  resources: ['wood', 'berries', 'water'],
};

const initialInventory: InventoryItem[] = [
  { id: 'stone', name: 'Stone', quantity: 2, icon: '🪨', type: 'resource' },
  { id: 'stick', name: 'Stick', quantity: 3, icon: '🪵', type: 'resource' },
];

export const useSurvivalStore = create<SurvivalState>((set, get) => ({
  // Initial state
  isPlaying: false,
  isPaused: false,
  gameSpeed: 1,

  playerStats: initialPlayerStats,
  inventory: initialInventory,

  worldState: initialWorldState,

  gameEvents: [],
  godThoughts: '',
  survivorThoughts: '',
  currentAction: '',

  chatMessages: [],
  viewerCount: Math.floor(Math.random() * 500) + 100,
  userAdvice: [],

  // Actions
  startGame: () => set({ isPlaying: true, isPaused: false }),
  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),
  endGame: () => set({ isPlaying: false, isPaused: false }),
  setGameSpeed: (speed) => set({ gameSpeed: speed }),

  updatePlayerStats: (stats) => set((state) => ({
    playerStats: { ...state.playerStats, ...stats }
  })),

  addInventoryItem: (item) => set((state) => {
    const existing = state.inventory.find(i => i.id === item.id);
    if (existing) {
      return {
        inventory: state.inventory.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      };
    }
    return { inventory: [...state.inventory, item] };
  }),

  removeInventoryItem: (itemId, quantity = 1) => set((state) => {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return state;

    if (item.quantity <= quantity) {
      return { inventory: state.inventory.filter(i => i.id !== itemId) };
    }
    return {
      inventory: state.inventory.map(i =>
        i.id === itemId
          ? { ...i, quantity: i.quantity - quantity }
          : i
      )
    };
  }),

  updateWorldState: (worldState) => set((state) => ({
    worldState: { ...state.worldState, ...worldState }
  })),

  addGameEvent: (event) => set((state) => ({
    gameEvents: [
      ...state.gameEvents,
      {
        ...event,
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      }
    ].slice(-100) // Keep last 100 events
  })),

  setGodThoughts: (thoughts) => set({ godThoughts: thoughts }),
  setSurvivorThoughts: (thoughts) => set({ survivorThoughts: thoughts }),
  setCurrentAction: (action) => set({ currentAction: action }),

  addChatMessage: (message) => set((state) => ({
    chatMessages: [
      ...state.chatMessages,
      {
        ...message,
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      }
    ].slice(-200) // Keep last 200 messages
  })),

  setViewerCount: (count) => set({ viewerCount: count }),

  addUserAdvice: (advice) => set((state) => ({
    userAdvice: [
      ...state.userAdvice,
      {
        id: `advice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        advice,
        timestamp: Date.now(),
        applied: false,
      }
    ].slice(-20) // Keep last 20 pieces of advice
  })),

  markAdviceApplied: (id) => set((state) => ({
    userAdvice: state.userAdvice.map(a =>
      a.id === id ? { ...a, applied: true } : a
    )
  })),

  getActiveAdvice: () => {
    const state = get();
    return state.userAdvice.filter(a => !a.applied).slice(-5);
  },

  resetGame: () => set({
    isPlaying: false,
    isPaused: false,
    gameSpeed: 1,
    playerStats: initialPlayerStats,
    inventory: initialInventory,
    worldState: initialWorldState,
    gameEvents: [],
    godThoughts: '',
    survivorThoughts: '',
    currentAction: '',
    chatMessages: [],
    viewerCount: Math.floor(Math.random() * 500) + 100,
    userAdvice: [],
  }),
}));
