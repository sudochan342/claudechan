// Shared Game State - ONE game for ALL viewers
// This runs on the server and broadcasts to everyone

export interface GameState {
  // World
  daysSurvived: number;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'storm';
  threats: string[];

  // Player
  health: number;
  hunger: number;
  energy: number;
  inventory: Record<string, number>;

  // Current action
  currentAction: string;
  currentPhase: 'god_thinking' | 'god_speaking' | 'survivor_thinking' | 'survivor_speaking' | 'idle';

  // Logs
  logs: GameLog[];

  // Meta
  isRunning: boolean;
  lastUpdate: number;
  turnCount: number;
}

export interface GameLog {
  id: string;
  type: 'god' | 'survivor' | 'system' | 'action';
  message: string;
  timestamp: number;
}

// Demo responses for the GOD AI - dramatic and theatrical
const GOD_RESPONSES = [
  { message: "Ah, the newcomer enchants the land with his ambition. How delightful! Let's see how he handles this unexpected encounter.", timeChange: null, weather: null, threat: 'wild boar' },
  { message: "The sun climbs higher, baking the earth beneath its merciless gaze. Our little survivor grows weary, I see. Perhaps some shade would serve him well... if he can find it.", timeChange: 'day', weather: null, threat: null },
  { message: "Dusk approaches, painting the sky in hues of blood and gold. The forest awakens with hungry eyes. How poetic.", timeChange: 'dusk', weather: null, threat: null },
  { message: "Night falls like a shroud upon the land. The darkness brings forth creatures that shun the light. Sweet dreams, little one.", timeChange: 'night', weather: null, threat: 'wolves' },
  { message: "Dawn breaks through the eternal darkness. Another day of struggle begins. Will today be your last?", timeChange: 'dawn', weather: null, threat: null },
  { message: "The clouds gather overhead, heavy with the promise of rain. Nature itself seems to weep for your fate.", timeChange: null, weather: 'rain', threat: null },
  { message: "A storm brews on the horizon. Thunder echoes through the mountains like the laughter of ancient gods.", timeChange: null, weather: 'storm', threat: null },
  { message: "The weather clears, but do not mistake this brief respite for mercy. I am merely... savoring the anticipation.", timeChange: null, weather: 'clear', threat: null },
  { message: "I sense movement in the undergrowth. Something large. Something hungry. How exciting!", timeChange: null, weather: null, threat: 'bear' },
  { message: "Your little shelter amuses me. Do you truly believe twigs and leaves will protect you from what lurks in my domain?", timeChange: null, weather: null, threat: null },
  { message: "The berries you seek - some are sweet, some are poison. Can you tell the difference? Let's find out.", timeChange: null, weather: null, threat: null },
  { message: "Your fire flickers weakly against the encroaching darkness. Feed it well, little flame-keeper, or face what hides in the shadows.", timeChange: null, weather: null, threat: null },
  { message: "Another dawn, another chance to disappoint me with your stubborn will to survive. How tedious. How... admirable.", timeChange: 'dawn', weather: null, threat: null },
  { message: "The forest grows quiet. Too quiet. Even the birds have fled. I wonder why...", timeChange: null, weather: null, threat: 'unknown predator' },
  { message: "You've survived this long through luck alone. Luck is a fickle mistress, dear survivor. She will abandon you eventually.", timeChange: null, weather: null, threat: null },
  { message: "The moon rises full and bright, illuminating your pathetic camp for all the night's hunters to see. Beautiful, isn't it?", timeChange: 'night', weather: 'clear', threat: null },
];

// Demo responses for the SURVIVOR AI - determined and resourceful
const SURVIVOR_RESPONSES = [
  { action: "Gathering wood", message: "I need to gather more firewood before nightfall. The forest provides, if you know where to look." },
  { action: "Building shelter", message: "This shelter won't hold forever, but it's better than sleeping under the stars with predators around." },
  { action: "Foraging berries", message: "These berries look safe. I've learned to identify the edible ones. Hunger won't defeat me today." },
  { action: "Starting fire", message: "Fire is life out here. Warmth, protection, hope - all in these dancing flames." },
  { action: "Resting", message: "I need to conserve my strength. Rest now, survive tomorrow." },
  { action: "Crafting tools", message: "A sharp stick isn't much, but it's better than bare hands against what's out there." },
  { action: "Exploring area", message: "I need to understand this land if I'm going to survive it. Knowledge is power." },
  { action: "Collecting water", message: "Clean water is scarce. I'll boil what I find - parasites are just another enemy to defeat." },
  { action: "Setting traps", message: "If I can't hunt them, I'll outsmart them. These simple snares might save my life." },
  { action: "Climbing tree", message: "Higher ground gives me perspective. I can see threats coming from up here." },
  { action: "Hiding", message: "Sometimes the best strategy is to disappear. Live to fight another day." },
  { action: "Fighting back", message: "I won't go down without a fight. This forest will learn to respect my will to survive!" },
  { action: "Tending wounds", message: "Pain is temporary. Death is permanent. I'll patch myself up and keep going." },
  { action: "Searching for food", message: "My stomach growls but my spirit doesn't waver. There's always something to eat if you're desperate enough." },
  { action: "Making weapons", message: "A spear, a club, anything. I refuse to be defenseless in this hostile world." },
];

// Global game state (persists across requests on the same server instance)
let gameState: GameState = createInitialState();
let gameLoopInterval: NodeJS.Timeout | null = null;
let subscribers: Set<(state: GameState) => void> = new Set();

function createInitialState(): GameState {
  return {
    daysSurvived: 0,
    timeOfDay: 'dawn',
    weather: 'clear',
    threats: [],
    health: 100,
    hunger: 80,
    energy: 90,
    inventory: { wood: 2, berries: 3 },
    currentAction: '',
    currentPhase: 'idle',
    logs: [{
      id: 'init',
      type: 'system',
      message: '🎮 The survival game begins... Claude awakens in an unknown forest.',
      timestamp: Date.now(),
    }],
    isRunning: true,
    lastUpdate: Date.now(),
    turnCount: 0,
  };
}

function addLog(type: GameLog['type'], message: string) {
  const log: GameLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    timestamp: Date.now(),
  };

  gameState.logs.push(log);

  // Keep last 50 logs
  if (gameState.logs.length > 50) {
    gameState.logs = gameState.logs.slice(-50);
  }
}

function broadcast() {
  gameState.lastUpdate = Date.now();
  subscribers.forEach(callback => {
    try {
      callback(gameState);
    } catch (e) {
      // Remove failed subscriber
      subscribers.delete(callback);
    }
  });
}

async function runGameTurn() {
  if (!gameState.isRunning) return;

  gameState.turnCount++;

  // GOD phase
  gameState.currentPhase = 'god_thinking';
  broadcast();

  await sleep(1500);

  // GOD speaks
  gameState.currentPhase = 'god_speaking';
  const godResponse = GOD_RESPONSES[Math.floor(Math.random() * GOD_RESPONSES.length)];

  addLog('god', `👁️ GOD: ${godResponse.message}`);

  // Apply GOD's changes
  if (godResponse.timeChange) {
    gameState.timeOfDay = godResponse.timeChange as GameState['timeOfDay'];

    // Day progression
    if (godResponse.timeChange === 'dawn') {
      gameState.daysSurvived++;
      addLog('system', `☀️ Day ${gameState.daysSurvived + 1} begins`);
    }
  }

  if (godResponse.weather) {
    gameState.weather = godResponse.weather as GameState['weather'];
    const weatherEmoji = godResponse.weather === 'rain' ? '🌧️' : godResponse.weather === 'storm' ? '⛈️' : '☀️';
    addLog('system', `${weatherEmoji} Weather changed to ${godResponse.weather}`);
  }

  if (godResponse.threat) {
    if (!gameState.threats.includes(godResponse.threat)) {
      gameState.threats.push(godResponse.threat);
      addLog('system', `⚠️ New threat: ${godResponse.threat}!`);
    }
  }

  broadcast();

  await sleep(2000);

  // SURVIVOR phase
  gameState.currentPhase = 'survivor_thinking';
  broadcast();

  await sleep(1000);

  // SURVIVOR acts
  gameState.currentPhase = 'survivor_speaking';
  const survivorResponse = SURVIVOR_RESPONSES[Math.floor(Math.random() * SURVIVOR_RESPONSES.length)];

  gameState.currentAction = survivorResponse.action;
  addLog('survivor', `🧑 CLAUDE: ${survivorResponse.message}`);
  addLog('action', `▶️ Action: ${survivorResponse.action}`);

  // Apply action effects
  applyActionEffects(survivorResponse.action);

  // Clear threats randomly
  if (Math.random() > 0.7 && gameState.threats.length > 0) {
    const clearedThreat = gameState.threats.pop();
    addLog('system', `✅ ${clearedThreat} driven away!`);
  }

  // Natural stat changes
  gameState.hunger = Math.max(0, gameState.hunger - 3);
  gameState.energy = Math.max(0, gameState.energy - 2);

  // Weather effects
  if (gameState.weather === 'storm') {
    gameState.health = Math.max(0, gameState.health - 5);
    gameState.energy = Math.max(0, gameState.energy - 5);
  }

  // Threat damage
  if (gameState.threats.length > 0 && Math.random() > 0.6) {
    const damage = 5 + Math.floor(Math.random() * 10);
    gameState.health = Math.max(0, gameState.health - damage);
    addLog('system', `💥 Took ${damage} damage from threats!`);
  }

  // Check death
  if (gameState.health <= 0 || gameState.hunger <= 0) {
    gameState.isRunning = false;
    addLog('system', `💀 GAME OVER - Claude survived ${gameState.daysSurvived} days`);

    // Restart after delay
    setTimeout(() => {
      gameState = createInitialState();
      addLog('system', '🔄 New game starting...');
      broadcast();
    }, 10000);
  }

  broadcast();

  await sleep(1500);

  gameState.currentPhase = 'idle';
  gameState.currentAction = '';
  broadcast();
}

function applyActionEffects(action: string) {
  const a = action.toLowerCase();

  if (a.includes('gather') || a.includes('wood')) {
    gameState.inventory.wood = (gameState.inventory.wood || 0) + 2;
    gameState.energy = Math.max(0, gameState.energy - 10);
  } else if (a.includes('berr') || a.includes('forag') || a.includes('food')) {
    gameState.inventory.berries = (gameState.inventory.berries || 0) + 3;
    gameState.hunger = Math.min(100, gameState.hunger + 15);
  } else if (a.includes('rest') || a.includes('sleep')) {
    gameState.energy = Math.min(100, gameState.energy + 30);
    gameState.health = Math.min(100, gameState.health + 5);
  } else if (a.includes('fire')) {
    gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 1);
    gameState.energy = Math.min(100, gameState.energy + 10);
  } else if (a.includes('fight') || a.includes('weapon')) {
    gameState.energy = Math.max(0, gameState.energy - 15);
    if (gameState.threats.length > 0 && Math.random() > 0.5) {
      gameState.threats.pop();
    }
  } else if (a.includes('shelter') || a.includes('build')) {
    gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 2);
    gameState.energy = Math.max(0, gameState.energy - 15);
  } else if (a.includes('water')) {
    gameState.hunger = Math.min(100, gameState.hunger + 5);
  } else if (a.includes('wound') || a.includes('heal')) {
    gameState.health = Math.min(100, gameState.health + 10);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the game loop
export function startGameLoop() {
  if (gameLoopInterval) return; // Already running

  console.log('[SharedGame] Starting game loop...');

  // Run a turn every 8 seconds
  gameLoopInterval = setInterval(() => {
    runGameTurn().catch(console.error);
  }, 8000);

  // Run first turn immediately
  runGameTurn().catch(console.error);
}

// Subscribe to game updates
export function subscribe(callback: (state: GameState) => void): () => void {
  subscribers.add(callback);

  // Send current state immediately
  callback(gameState);

  // Start loop if not running
  if (!gameLoopInterval) {
    startGameLoop();
  }

  // Return unsubscribe function
  return () => {
    subscribers.delete(callback);
  };
}

// Get current state
export function getGameState(): GameState {
  return gameState;
}

// Check if game is running
export function isGameRunning(): boolean {
  return gameLoopInterval !== null;
}
