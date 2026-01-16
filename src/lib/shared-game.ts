// Shared Game State - ONE game for ALL viewers
// This runs on the server and broadcasts to everyone
// CRASH-PROOF: Claude cannot die easily, game never stops

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

  // User advice
  recentAdvice: UserAdvice[];

  // Meta
  isRunning: boolean;
  lastUpdate: number;
  turnCount: number;
}

export interface GameLog {
  id: string;
  type: 'god' | 'survivor' | 'system' | 'action' | 'advice';
  message: string;
  timestamp: number;
}

export interface UserAdvice {
  id: string;
  advice: string;
  timestamp: number;
  used: boolean;
}

// Demo responses for the GOD AI - dramatic and theatrical
const GOD_RESPONSES = [
  { message: "Ah, the newcomer enchants the land with his ambition. How delightful! Let's see how he handles this unexpected encounter.", timeChange: null, weather: null, threat: 'wild boar' },
  { message: "The sun climbs higher, baking the earth beneath its merciless gaze. Our little survivor grows weary, I see.", timeChange: 'day', weather: null, threat: null },
  { message: "Dusk approaches, painting the sky in hues of blood and gold. The forest awakens with hungry eyes.", timeChange: 'dusk', weather: null, threat: null },
  { message: "Night falls like a shroud upon the land. The darkness brings forth creatures that shun the light.", timeChange: 'night', weather: null, threat: null },
  { message: "Dawn breaks through the eternal darkness. Another day of struggle begins. Will today be your last?", timeChange: 'dawn', weather: null, threat: null },
  { message: "The clouds gather overhead, heavy with the promise of rain. Nature itself seems to weep for your fate.", timeChange: null, weather: 'rain', threat: null },
  { message: "A storm brews on the horizon. Thunder echoes through the mountains like the laughter of ancient gods.", timeChange: null, weather: 'storm', threat: null },
  { message: "The weather clears, but do not mistake this brief respite for mercy.", timeChange: null, weather: 'clear', threat: null },
  { message: "I sense movement in the undergrowth. Something is watching...", timeChange: null, weather: null, threat: null },
  { message: "Your little shelter amuses me. Do you truly believe it will protect you?", timeChange: null, weather: null, threat: null },
  { message: "The berries you seek - some are sweet, some are poison. Choose wisely.", timeChange: null, weather: null, threat: null },
  { message: "Your fire flickers weakly against the encroaching darkness. Feed it well.", timeChange: null, weather: null, threat: null },
  { message: "Another dawn, another chance to disappoint me with your stubborn will to survive.", timeChange: 'dawn', weather: null, threat: null },
  { message: "The forest grows quiet. Too quiet. Even the birds have fled...", timeChange: null, weather: null, threat: null },
  { message: "You've survived this long through skill and determination. Impressive... for a mortal.", timeChange: null, weather: null, threat: null },
  { message: "The moon rises full and bright, illuminating your camp. A peaceful night... for now.", timeChange: 'night', weather: 'clear', threat: null },
  { message: "I grow weary of testing you. Perhaps I shall let nature take its course today.", timeChange: null, weather: null, threat: null },
  { message: "The stream nearby glistens invitingly. Fresh water - the essence of life itself.", timeChange: null, weather: null, threat: null },
  { message: "A flock of birds takes flight. Something approaches... or perhaps it was just the wind.", timeChange: null, weather: null, threat: null },
  { message: "Your resourcefulness surprises even me. But can you keep this pace?", timeChange: null, weather: null, threat: null },
];

// Smarter survivor responses based on situation
const SURVIVOR_ACTIONS = {
  critical_health: [
    { action: "Tending wounds", message: "I need to stop the bleeding. If I don't treat these wounds, I won't last the night." },
    { action: "Resting carefully", message: "My body is failing me. I must rest and recover before doing anything else." },
    { action: "Finding medicinal herbs", message: "There must be something in this forest to help with these injuries." },
  ],
  low_hunger: [
    { action: "Foraging for food", message: "My stomach growls. Time to find something to eat before I get too weak." },
    { action: "Setting quick traps", message: "A trap might catch something while I do other tasks." },
    { action: "Searching for berries", message: "Berries are quick energy. I need to find some now." },
  ],
  low_energy: [
    { action: "Taking a short rest", message: "Just a quick rest to catch my breath. Can't push too hard." },
    { action: "Finding shelter to sleep", message: "I need proper sleep. My body demands it." },
  ],
  has_threat: [
    { action: "Scaring off the threat", message: "Making loud noises and waving my arms! Get away from me!" },
    { action: "Strategic retreat", message: "I need to back away slowly. No sudden movements." },
    { action: "Building a fire", message: "Fire! Animals fear fire. This will keep them away." },
    { action: "Creating distraction", message: "Maybe I can lure it away with something..." },
  ],
  night_time: [
    { action: "Maintaining fire", message: "The fire is my lifeline tonight. Without it, the darkness will swallow me." },
    { action: "Staying vigilant", message: "Can't sleep too deeply. Every sound could be danger." },
    { action: "Resting by the fire", message: "The warmth of the fire helps me recover while staying alert." },
  ],
  storm: [
    { action: "Seeking shelter", message: "This storm is harsh but I found cover. Waiting it out." },
    { action: "Protecting supplies", message: "Can't let the rain ruin what little I have." },
  ],
  normal: [
    { action: "Gathering wood", message: "Wood is life out here. Fire, shelter, tools - it all starts with wood." },
    { action: "Collecting clean water", message: "Staying hydrated is crucial. Found a stream that looks safe." },
    { action: "Improving shelter", message: "Making my shelter stronger. Every improvement helps." },
    { action: "Crafting tools", message: "Better tools mean better survival odds. Time to upgrade." },
    { action: "Scouting the area", message: "Knowledge of my surroundings could save my life." },
    { action: "Foraging for food", message: "Building up food reserves while I can." },
    { action: "Setting traps", message: "Passive food gathering. Work smarter, not harder." },
    { action: "Starting a fire", message: "Fire means safety, warmth, and cooked food. Essential." },
    { action: "Fishing by the stream", message: "The stream has fish. Patient fishing pays off." },
    { action: "Strengthening defenses", message: "A well-defended camp is a safe camp." },
  ],
  user_advice: [
    { action: "Following viewer advice", message: "The watchers suggest I {advice}. They might be onto something..." },
    { action: "Heeding the crowd", message: "Multiple voices are telling me to {advice}. I'll trust their judgment." },
    { action: "Taking viewer tip", message: "Someone watching said to {advice}. Worth a try!" },
  ],
};

// Global game state
let gameState: GameState = createInitialState();
let gameLoopInterval: NodeJS.Timeout | null = null;
let subscribers: Set<(state: GameState) => void> = new Set();
let pendingAdvice: UserAdvice[] = [];

function createInitialState(): GameState {
  return {
    daysSurvived: 0,
    timeOfDay: 'dawn',
    weather: 'clear',
    threats: [],
    health: 100,
    hunger: 80,
    energy: 90,
    inventory: { wood: 5, berries: 5 },
    currentAction: '',
    currentPhase: 'idle',
    logs: [{
      id: 'init',
      type: 'system',
      message: '🎮 The survival game begins... Claude awakens in an unknown forest.',
      timestamp: Date.now(),
    }],
    recentAdvice: [],
    isRunning: true,
    lastUpdate: Date.now(),
    turnCount: 0,
  };
}

function addLog(type: GameLog['type'], message: string) {
  try {
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
  } catch (e) {
    console.error('[SharedGame] Error adding log:', e);
  }
}

// Add user advice to the queue
export function addAdvice(advice: string) {
  try {
    const newAdvice: UserAdvice = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      advice,
      timestamp: Date.now(),
      used: false,
    };

    pendingAdvice.push(newAdvice);
    gameState.recentAdvice.push(newAdvice);

    // Keep last 10 advice items
    if (gameState.recentAdvice.length > 10) {
      gameState.recentAdvice = gameState.recentAdvice.slice(-10);
    }
    if (pendingAdvice.length > 5) {
      pendingAdvice = pendingAdvice.slice(-5);
    }

    addLog('advice', `💡 Viewer tip: "${advice}"`);
    broadcast();
  } catch (e) {
    console.error('[SharedGame] Error adding advice:', e);
  }
}

// Get recent advice for display
export function getRecentAdvice(): UserAdvice[] {
  return gameState.recentAdvice;
}

function broadcast() {
  gameState.lastUpdate = Date.now();
  const deadSubscribers: Set<(state: GameState) => void> = new Set();

  subscribers.forEach(callback => {
    try {
      callback(gameState);
    } catch (e) {
      deadSubscribers.add(callback);
    }
  });

  // Clean up dead subscribers
  deadSubscribers.forEach(sub => subscribers.delete(sub));
}

// ALWAYS keep Claude alive - auto-recover when stats get too low
function ensureSurvival() {
  // Never let health drop below 20
  if (gameState.health < 20) {
    gameState.health = 20;
    addLog('system', '💪 Claude found inner strength to keep going!');
  }

  // Never let hunger drop below 15
  if (gameState.hunger < 15) {
    gameState.hunger = 25;
    gameState.inventory.berries = (gameState.inventory.berries || 0) + 2;
    addLog('system', '🍀 Lucky find! Some edible plants nearby.');
  }

  // Never let energy drop below 10
  if (gameState.energy < 10) {
    gameState.energy = 25;
    addLog('system', '☀️ A second wind! Energy restored.');
  }

  // Clear threats if too many
  if (gameState.threats.length > 1) {
    gameState.threats = [gameState.threats[0]];
    addLog('system', '🌲 Some threats wandered away...');
  }

  // Auto-clear old threats
  if (gameState.threats.length > 0 && Math.random() > 0.7) {
    gameState.threats.pop();
    addLog('system', '✅ The threat lost interest and left.');
  }
}

// Smart action selection based on game state and user advice
function selectSurvivorAction(): { action: string; message: string } {
  try {
    // Check for pending user advice first (40% chance to use it)
    const unusedAdvice = pendingAdvice.filter(a => !a.used);
    if (unusedAdvice.length > 0 && Math.random() < 0.4) {
      const advice = unusedAdvice[0];
      advice.used = true;

      const template = SURVIVOR_ACTIONS.user_advice[Math.floor(Math.random() * SURVIVOR_ACTIONS.user_advice.length)];
      const shortAdvice = advice.advice.slice(0, 50);

      return {
        action: template.action,
        message: template.message.replace('{advice}', shortAdvice.toLowerCase()),
      };
    }

    // Priority 1: Critical health (but not too often)
    if (gameState.health < 40) {
      const actions = SURVIVOR_ACTIONS.critical_health;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Priority 2: Low hunger
    if (gameState.hunger < 35) {
      const actions = SURVIVOR_ACTIONS.low_hunger;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Priority 3: Low energy
    if (gameState.energy < 25) {
      const actions = SURVIVOR_ACTIONS.low_energy;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Priority 4: Active threats
    if (gameState.threats.length > 0) {
      const actions = SURVIVOR_ACTIONS.has_threat;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Priority 5: Storm
    if (gameState.weather === 'storm') {
      const actions = SURVIVOR_ACTIONS.storm;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Priority 6: Night time
    if (gameState.timeOfDay === 'night') {
      const actions = SURVIVOR_ACTIONS.night_time;
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Default: Normal actions
    const actions = SURVIVOR_ACTIONS.normal;
    return actions[Math.floor(Math.random() * actions.length)];
  } catch (e) {
    console.error('[SharedGame] Error selecting action:', e);
    return { action: "Staying alert", message: "I need to stay focused and keep surviving." };
  }
}

async function runGameTurn() {
  try {
    // Always ensure game is running
    gameState.isRunning = true;
    gameState.turnCount++;

    // GOD phase
    gameState.currentPhase = 'god_thinking';
    broadcast();

    await sleep(1500);

    // GOD speaks
    gameState.currentPhase = 'god_speaking';

    // Pick a random GOD response (mostly non-threatening)
    const godResponse = GOD_RESPONSES[Math.floor(Math.random() * GOD_RESPONSES.length)];
    addLog('god', `👁️ GOD: ${godResponse.message}`);

    // Apply GOD's changes (but limit threats)
    if (godResponse.timeChange) {
      gameState.timeOfDay = godResponse.timeChange as GameState['timeOfDay'];

      if (godResponse.timeChange === 'dawn') {
        gameState.daysSurvived++;
        addLog('system', `☀️ Day ${gameState.daysSurvived + 1} begins!`);
        // Dawn bonus
        gameState.energy = Math.min(100, gameState.energy + 10);
        gameState.health = Math.min(100, gameState.health + 5);
      }
    }

    if (godResponse.weather) {
      gameState.weather = godResponse.weather as GameState['weather'];
      const weatherEmoji = godResponse.weather === 'rain' ? '🌧️' : godResponse.weather === 'storm' ? '⛈️' : '☀️';
      addLog('system', `${weatherEmoji} Weather: ${godResponse.weather}`);

      // Clear weather bonus
      if (godResponse.weather === 'clear') {
        gameState.energy = Math.min(100, gameState.energy + 5);
      }
    }

    // Only add threat if Claude is healthy and no existing threats
    if (godResponse.threat && gameState.health > 60 && gameState.threats.length === 0 && Math.random() > 0.5) {
      gameState.threats.push(godResponse.threat);
      addLog('system', `⚠️ THREAT: ${godResponse.threat}!`);
    }

    broadcast();
    await sleep(2000);

    // SURVIVOR phase
    gameState.currentPhase = 'survivor_thinking';
    broadcast();

    await sleep(1500);

    // SURVIVOR acts - smart selection
    gameState.currentPhase = 'survivor_speaking';
    const survivorResponse = selectSurvivorAction();

    gameState.currentAction = survivorResponse.action;
    addLog('survivor', `🧑 CLAUDE: ${survivorResponse.message}`);
    addLog('action', `▶️ ${survivorResponse.action}`);

    // Apply action effects
    applyActionEffects(survivorResponse.action);

    // Natural stat decay (very slow)
    gameState.hunger = Math.max(10, gameState.hunger - 1);
    gameState.energy = Math.max(10, gameState.energy - 1);

    // Weather effects (minimal)
    if (gameState.weather === 'storm') {
      gameState.energy = Math.max(10, gameState.energy - 2);
    }

    // Threat damage (rare and small)
    if (gameState.threats.length > 0 && Math.random() > 0.85) {
      const damage = 2 + Math.floor(Math.random() * 3);
      gameState.health = Math.max(20, gameState.health - damage);
      addLog('system', `💥 Minor injury from ${gameState.threats[0]}!`);
    }

    // ALWAYS ensure survival
    ensureSurvival();

    broadcast();
    await sleep(1500);

    gameState.currentPhase = 'idle';
    gameState.currentAction = '';
    broadcast();

  } catch (e) {
    console.error('[SharedGame] Error in game turn:', e);
    // Reset to safe state
    gameState.currentPhase = 'idle';
    gameState.currentAction = '';
    gameState.isRunning = true;
    ensureSurvival();
    broadcast();
  }
}

function applyActionEffects(action: string) {
  try {
    const a = action.toLowerCase();

    if (a.includes('gather') || a.includes('wood')) {
      gameState.inventory.wood = (gameState.inventory.wood || 0) + 2;
      gameState.energy = Math.max(10, gameState.energy - 5);
    } else if (a.includes('berr') || a.includes('forag') || a.includes('food')) {
      gameState.inventory.berries = (gameState.inventory.berries || 0) + 3;
      gameState.hunger = Math.min(100, gameState.hunger + 25);
      gameState.energy = Math.max(10, gameState.energy - 3);
    } else if (a.includes('rest') || a.includes('sleep')) {
      gameState.energy = Math.min(100, gameState.energy + 40);
      gameState.health = Math.min(100, gameState.health + 10);
    } else if (a.includes('fire') || a.includes('scar')) {
      gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 1);
      gameState.energy = Math.min(100, gameState.energy + 10);
      // Fire always scares threats away
      if (gameState.threats.length > 0) {
        const threat = gameState.threats.pop();
        addLog('system', `🔥 The fire scared away the ${threat}!`);
      }
    } else if (a.includes('shelter') || a.includes('build') || a.includes('fortif') || a.includes('defense') || a.includes('improv')) {
      gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 1);
      gameState.energy = Math.max(10, gameState.energy - 8);
      gameState.health = Math.min(100, gameState.health + 5); // Shelter improves wellbeing
    } else if (a.includes('water') || a.includes('stream') || a.includes('fish')) {
      gameState.hunger = Math.min(100, gameState.hunger + 15);
      gameState.energy = Math.max(10, gameState.energy - 5);
    } else if (a.includes('wound') || a.includes('heal') || a.includes('herb') || a.includes('medic') || a.includes('tend')) {
      gameState.health = Math.min(100, gameState.health + 20);
      gameState.energy = Math.max(10, gameState.energy - 5);
    } else if (a.includes('trap')) {
      gameState.inventory.berries = (gameState.inventory.berries || 0) + 2;
      gameState.hunger = Math.min(100, gameState.hunger + 15);
      gameState.energy = Math.max(10, gameState.energy - 5);
    } else if (a.includes('scout') || a.includes('explor') || a.includes('search')) {
      gameState.energy = Math.max(10, gameState.energy - 5);
      // Always find something useful
      gameState.inventory.wood = (gameState.inventory.wood || 0) + 1;
      gameState.inventory.berries = (gameState.inventory.berries || 0) + 1;
    } else if (a.includes('retreat') || a.includes('back') || a.includes('distraction')) {
      gameState.energy = Math.max(10, gameState.energy - 10);
      // Retreat always works
      if (gameState.threats.length > 0) {
        const threat = gameState.threats.pop();
        addLog('system', `✅ Successfully avoided the ${threat}!`);
      }
    } else if (a.includes('vigil') || a.includes('alert') || a.includes('watch')) {
      gameState.energy = Math.max(10, gameState.energy - 3);
      gameState.health = Math.min(100, gameState.health + 3);
    } else if (a.includes('craft') || a.includes('tool')) {
      gameState.energy = Math.max(10, gameState.energy - 5);
      gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 1);
    } else if (a.includes('protect') || a.includes('suppli')) {
      gameState.energy = Math.max(10, gameState.energy - 3);
    } else {
      // Default: small energy cost, small benefit
      gameState.energy = Math.max(10, gameState.energy - 3);
      gameState.health = Math.min(100, gameState.health + 2);
    }
  } catch (e) {
    console.error('[SharedGame] Error applying action effects:', e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the game loop
export function startGameLoop() {
  if (gameLoopInterval) return;

  console.log('[SharedGame] Starting game loop...');

  // Run a turn every 8 seconds
  gameLoopInterval = setInterval(() => {
    runGameTurn().catch(e => {
      console.error('[SharedGame] Turn error:', e);
      // Keep going no matter what
      gameState.isRunning = true;
      ensureSurvival();
    });
  }, 8000);

  // Run first turn immediately
  runGameTurn().catch(console.error);
}

// Subscribe to game updates
export function subscribe(callback: (state: GameState) => void): () => void {
  subscribers.add(callback);

  // Send current state immediately
  try {
    callback(gameState);
  } catch (e) {
    console.error('[SharedGame] Error sending initial state:', e);
  }

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
