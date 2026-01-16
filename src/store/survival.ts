import { create } from 'zustand';

export interface PlayerStats {
  health: number;
  hunger: number;
  energy: number;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'god' | 'survivor' | 'system' | 'action' | 'advice';
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
  reconnectAttempts: number;

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
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

export const useSurvivalStore = create<SurvivalState>((set, get) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  reconnectAttempts: 0,

  isPlaying: true, // Always show as playing
  isPaused: false,

  playerStats: initialPlayerStats,
  inventory: { wood: 5, berries: 5 },

  worldState: initialWorldState,

  gameEvents: [],
  currentAction: '',
  currentPhase: 'idle',

  viewerCount: Math.floor(Math.random() * 200) + 100,

  // Connect to the shared game stream - CRASH PROOF
  connect: () => {
    // Don't connect if already connected or connecting
    if (eventSource?.readyState === EventSource.OPEN || get().isConnecting) {
      return;
    }

    // Clear any existing connection
    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {
        // Ignore close errors
      }
      eventSource = null;
    }

    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    set({ isConnecting: true, connectionError: null });

    try {
      eventSource = new EventSource('/api/game-stream');

      eventSource.onopen = () => {
        console.log('[GameStream] Connected!');
        set({
          isConnected: true,
          isConnecting: false,
          isPlaying: true,
          connectionError: null,
          reconnectAttempts: 0,
        });

        // Start heartbeat to check connection
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          const lastUpdate = get().gameEvents[get().gameEvents.length - 1]?.timestamp || 0;
          const timeSinceUpdate = Date.now() - lastUpdate;

          // If no update in 30 seconds, reconnect
          if (timeSinceUpdate > 30000 && get().isConnected) {
            console.log('[GameStream] No updates, reconnecting...');
            get().disconnect();
            setTimeout(() => get().connect(), 1000);
          }
        }, 10000);
      };

      eventSource.onmessage = (event) => {
        try {
          const serverState: SharedGameState = JSON.parse(event.data);
          get().syncFromServer(serverState);
        } catch (e) {
          console.error('[GameStream] Parse error:', e);
          // Don't disconnect on parse errors
        }
      };

      eventSource.onerror = () => {
        console.log('[GameStream] Connection error, will reconnect...');

        const attempts = get().reconnectAttempts;

        set({
          isConnected: false,
          isConnecting: false,
          reconnectAttempts: attempts + 1,
        });

        // Close and cleanup
        try {
          eventSource?.close();
        } catch (e) {
          // Ignore
        }
        eventSource = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);

        reconnectTimeout = setTimeout(() => {
          if (!get().isConnected) {
            console.log(`[GameStream] Reconnecting (attempt ${attempts + 1})...`);
            get().connect();
          }
        }, delay);
      };

    } catch (e) {
      console.error('[GameStream] Failed to create connection:', e);
      set({
        isConnecting: false,
        connectionError: 'Connection failed',
      });

      // Retry after delay
      reconnectTimeout = setTimeout(() => get().connect(), 3000);
    }
  },

  disconnect: () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {
        // Ignore
      }
      eventSource = null;
    }
    set({ isConnected: false, isConnecting: false });
  },

  // Sync local state from server - with error handling
  syncFromServer: (serverState: SharedGameState) => {
    try {
      // Validate server state
      if (!serverState || typeof serverState !== 'object') {
        return;
      }

      // Convert server logs to game events with validation
      const gameEvents: GameEvent[] = (serverState.logs || [])
        .filter(log => log && log.id && log.message)
        .map(log => ({
          id: log.id,
          timestamp: log.timestamp || Date.now(),
          type: (log.type as GameEvent['type']) || 'system',
          message: log.message,
        }));

      set({
        isPlaying: true, // Always playing
        playerStats: {
          health: Math.max(0, Math.min(100, serverState.health || 100)),
          hunger: Math.max(0, Math.min(100, serverState.hunger || 80)),
          energy: Math.max(0, Math.min(100, serverState.energy || 90)),
        },
        inventory: serverState.inventory || { wood: 5, berries: 5 },
        worldState: {
          timeOfDay: serverState.timeOfDay || 'dawn',
          weather: serverState.weather || 'clear',
          daysSurvived: serverState.daysSurvived || 0,
          threats: serverState.threats || [],
        },
        gameEvents,
        currentAction: serverState.currentAction || '',
        currentPhase: serverState.currentPhase || 'idle',
      });
    } catch (e) {
      console.error('[GameStream] Sync error:', e);
      // Don't crash, just log the error
    }
  },
}));

// Auto-connect when the store is first accessed in browser
if (typeof window !== 'undefined') {
  // Small delay to ensure hydration is complete
  setTimeout(() => {
    useSurvivalStore.getState().connect();
  }, 100);
}
