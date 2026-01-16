import { create } from 'zustand';

export interface PlayerStats {
  health: number;
  hunger: number;
  energy: number;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'god' | 'survivor' | 'system' | 'action';
  message: string;
}

export interface WorldState {
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'storm';
  daysSurvived: number;
  threats: string[];
}

export interface SharedGameState {
  daysSurvived: number;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'storm';
  threats: string[];
  health: number;
  hunger: number;
  energy: number;
  inventory: Record<string, number>;
  currentAction: string;
  currentPhase: 'god_thinking' | 'god_speaking' | 'survivor_thinking' | 'survivor_speaking' | 'idle';
  logs: { id: string; type: string; message: string; timestamp: number }[];
  isRunning: boolean;
  lastUpdate: number;
  turnCount: number;
}

interface SurvivalState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Game status
  isPlaying: boolean;
  isPaused: boolean;

  // Player
  playerStats: PlayerStats;
  inventory: Record<string, number>;

  // World
  worldState: WorldState;

  // Events & logs
  gameEvents: GameEvent[];
  currentAction: string;
  currentPhase: string;

  // Viewer count (simulated)
  viewerCount: number;

  // Actions
  connect: () => void;
  disconnect: () => void;
  syncFromServer: (serverState: SharedGameState) => void;
}

const initialPlayerStats: PlayerStats = {
  health: 100,
  hunger: 80,
  energy: 90,
};

const initialWorldState: WorldState = {
  timeOfDay: 'dawn',
  weather: 'clear',
  daysSurvived: 0,
  threats: [],
};

// Store the EventSource connection outside the store
let eventSource: EventSource | null = null;

export const useSurvivalStore = create<SurvivalState>((set, get) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  connectionError: null,

  isPlaying: false,
  isPaused: false,

  playerStats: initialPlayerStats,
  inventory: { wood: 2, berries: 3 },

  worldState: initialWorldState,

  gameEvents: [],
  currentAction: '',
  currentPhase: 'idle',

  viewerCount: Math.floor(Math.random() * 200) + 50,

  // Connect to the shared game stream
  connect: () => {
    if (eventSource || get().isConnecting) return;

    set({ isConnecting: true, connectionError: null });

    try {
      eventSource = new EventSource('/api/game-stream');

      eventSource.onopen = () => {
        set({ isConnected: true, isConnecting: false, isPlaying: true });
        console.log('[GameStream] Connected to shared game');
      };

      eventSource.onmessage = (event) => {
        try {
          const serverState: SharedGameState = JSON.parse(event.data);
          get().syncFromServer(serverState);
        } catch (e) {
          console.error('[GameStream] Failed to parse state:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[GameStream] Connection error:', error);
        set({
          isConnected: false,
          isConnecting: false,
          connectionError: 'Connection lost. Retrying...',
        });

        // Reconnect after delay
        eventSource?.close();
        eventSource = null;

        setTimeout(() => {
          if (!get().isConnected) {
            get().connect();
          }
        }, 3000);
      };
    } catch (e) {
      set({
        isConnecting: false,
        connectionError: 'Failed to connect to game server',
      });
    }
  },

  disconnect: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ isConnected: false, isPlaying: false });
  },

  // Sync local state from server
  syncFromServer: (serverState: SharedGameState) => {
    // Convert server logs to game events
    const gameEvents: GameEvent[] = serverState.logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type as GameEvent['type'],
      message: log.message,
    }));

    set({
      isPlaying: serverState.isRunning,
      playerStats: {
        health: serverState.health,
        hunger: serverState.hunger,
        energy: serverState.energy,
      },
      inventory: serverState.inventory,
      worldState: {
        timeOfDay: serverState.timeOfDay,
        weather: serverState.weather,
        daysSurvived: serverState.daysSurvived,
        threats: serverState.threats,
      },
      gameEvents,
      currentAction: serverState.currentAction,
      currentPhase: serverState.currentPhase,
    });
  },
}));
