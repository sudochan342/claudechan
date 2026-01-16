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
  { message: "Night falls like a shroud upon the land. The darkness brings forth creatures that shun the light.", timeChange: 'night', weather: null, threat: 'wolves' },
  { message: "Dawn breaks through the eternal darkness. Another day of struggle begins. Will today be your last?", timeChange: 'dawn', weather: null, threat: null },
  { message: "The clouds gather overhead, heavy with the promise of rain. Nature itself seems to weep for your fate.", timeChange: null, weather: 'rain', threat: null },
  { message: "A storm brews on the horizon. Thunder echoes through the mountains like the laughter of ancient gods.", timeChange: null, weather: 'storm', threat: null },
  { message: "The weather clears, but do not mistake this brief respite for mercy.", timeChange: null, weather: 'clear', threat: null },
  { message: "I sense movement in the undergrowth. Something large. Something hungry!", timeChange: null, weather: null, threat: 'bear' },
  { message: "Your little shelter amuses me. Do you truly believe it will protect you?", timeChange: null, weather: null, threat: null },
  { message: "The berries you seek - some are sweet, some are poison. Choose wisely.", timeChange: null, weather: null, threat: null },
  { message: "Your fire flickers weakly against the encroaching darkness. Feed it well.", timeChange: null, weather: null, threat: null },
  { message: "Another dawn, another chance to disappoint me with your stubborn will to survive.", timeChange: 'dawn', weather: null, threat: null },
  { message: "The forest grows quiet. Too quiet. Even the birds have fled...", timeChange: null, weather: null, threat: 'unknown predator' },
  { message: "You've survived this long through luck alone. Luck will abandon you eventually.", timeChange: null, weather: null, threat: null },
  { message: "The moon rises full and bright, illuminating your camp for all hunters to see.", timeChange: 'night', weather: 'clear', threat: null },
];

// Smarter survivor responses based on situation
const SURVIVOR_ACTIONS = {
  critical_health: [
    { action: "Tending wounds", message: "I need to stop the bleeding. If I don't treat these wounds, I won't last the night." },
    { action: "Resting carefully", message: "My body is failing me. I must rest and recover before doing anything else." },
    { action: "Finding medicinal herbs", message: "There must be something in this forest to help with these injuries." },
  ],
  critical_hunger: [
    { action: "Desperately foraging", message: "Starvation is setting in. I MUST find food NOW or I'm done for!" },
    { action: "Setting quick traps", message: "My hands shake from hunger but I have to catch something to eat." },
    { action: "Searching for berries", message: "Any food will do at this point. Even bitter berries are better than nothing." },
  ],
  critical_energy: [
    { action: "Forced rest", message: "I can barely keep my eyes open. If I don't rest now, I'll collapse." },
    { action: "Finding shelter to sleep", message: "I need sleep. Real sleep. My body is shutting down." },
  ],
  has_threat: [
    { action: "Fighting back!", message: "I won't run anymore! Time to show this creature what survival means!" },
    { action: "Strategic retreat", message: "I need to lose this threat before it's too late. Running now, fighting later." },
    { action: "Building defenses", message: "If I can't run and can't fight, I'll make myself harder to reach." },
    { action: "Creating distraction", message: "Maybe I can lure it away with noise... or something that smells like food." },
  ],
  night_time: [
    { action: "Maintaining fire", message: "The fire is my lifeline tonight. Without it, the darkness will swallow me." },
    { action: "Staying vigilant", message: "Can't sleep deeply tonight. Every sound could be a predator." },
    { action: "Fortifying camp", message: "Using the darkness to strengthen my position. They won't catch me off guard." },
  ],
  storm: [
    { action: "Seeking shelter", message: "This storm will kill me if I stay exposed. Need cover NOW!" },
    { action: "Protecting supplies", message: "Can't let the rain ruin what little I have. Everything under cover!" },
  ],
  normal: [
    { action: "Gathering wood", message: "Wood is life out here. Fire, shelter, tools - it all starts with wood." },
    { action: "Collecting clean water", message: "Staying hydrated is crucial. Found a stream that looks safe." },
    { action: "Building better shelter", message: "If I'm going to survive long-term, I need proper protection from the elements." },
    { action: "Crafting tools", message: "Better tools mean better survival odds. Time to upgrade my equipment." },
    { action: "Scouting the area", message: "Knowledge of my surroundings could save my life. Let's see what's out there." },
    { action: "Foraging for food", message: "Building up food reserves while I can. Never know when hunting will be impossible." },
    { action: "Setting traps", message: "Passive food gathering. Work smarter, not harder." },
    { action: "Starting a fire", message: "Fire means safety, warmth, and cooked food. Essential for survival." },
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
    inventory: { wood: 2, berries: 3 },
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

// Add user advice to the queue
export function addAdvice(advice: string) {
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
}

// Get recent advice for display
export function getRecentAdvice(): UserAdvice[] {
  return gameState.recentAdvice;
}

function broadcast() {
  gameState.lastUpdate = Date.now();
  subscribers.forEach(callback => {
    try {
      callback(gameState);
    } catch (e) {
      subscribers.delete(callback);
    }
  });
}

// Smart action selection based on game state and user advice
function selectSurvivorAction(): { action: string; message: string } {
  // Check for pending user advice first (30% chance to use it)
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

  // Priority 1: Critical health
  if (gameState.health < 25) {
    const actions = SURVIVOR_ACTIONS.critical_health;
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Priority 2: Critical hunger
  if (gameState.hunger < 20) {
    const actions = SURVIVOR_ACTIONS.critical_hunger;
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Priority 3: Critical energy
  if (gameState.energy < 15) {
    const actions = SURVIVOR_ACTIONS.critical_energy;
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

  // Smarter GOD - less threats if player is weak
  let godResponse;
  if (gameState.health < 30 || gameState.hunger < 20) {
    // Mercy mode - no new threats when player is struggling
    const safeResponses = GOD_RESPONSES.filter(r => !r.threat);
    godResponse = safeResponses[Math.floor(Math.random() * safeResponses.length)];
  } else {
    godResponse = GOD_RESPONSES[Math.floor(Math.random() * GOD_RESPONSES.length)];
  }

  addLog('god', `👁️ GOD: ${godResponse.message}`);

  // Apply GOD's changes
  if (godResponse.timeChange) {
    gameState.timeOfDay = godResponse.timeChange as GameState['timeOfDay'];

    if (godResponse.timeChange === 'dawn') {
      gameState.daysSurvived++;
      addLog('system', `☀️ Day ${gameState.daysSurvived + 1} begins!`);
    }
  }

  if (godResponse.weather) {
    gameState.weather = godResponse.weather as GameState['weather'];
    const weatherEmoji = godResponse.weather === 'rain' ? '🌧️' : godResponse.weather === 'storm' ? '⛈️' : '☀️';
    addLog('system', `${weatherEmoji} Weather: ${godResponse.weather}`);
  }

  if (godResponse.threat) {
    if (!gameState.threats.includes(godResponse.threat)) {
      gameState.threats.push(godResponse.threat);
      addLog('system', `⚠️ THREAT: ${godResponse.threat}!`);
    }
  }

  broadcast();
  await sleep(2000);

  // SURVIVOR phase
  gameState.currentPhase = 'survivor_thinking';
  broadcast();

  await sleep(1500);

  // SURVIVOR acts - now with smart selection
  gameState.currentPhase = 'survivor_speaking';
  const survivorResponse = selectSurvivorAction();

  gameState.currentAction = survivorResponse.action;
  addLog('survivor', `🧑 CLAUDE: ${survivorResponse.message}`);
  addLog('action', `▶️ ${survivorResponse.action}`);

  // Apply action effects
  applyActionEffects(survivorResponse.action);

  // Clear threats with better success rate when fighting
  if (survivorResponse.action.toLowerCase().includes('fight')) {
    if (gameState.threats.length > 0 && Math.random() > 0.3) {
      const clearedThreat = gameState.threats.pop();
      addLog('system', `⚔️ ${clearedThreat} defeated!`);
    }
  } else if (survivorResponse.action.toLowerCase().includes('retreat') || survivorResponse.action.toLowerCase().includes('distraction')) {
    if (gameState.threats.length > 0 && Math.random() > 0.4) {
      const clearedThreat = gameState.threats.pop();
      addLog('system', `✅ Escaped from ${clearedThreat}!`);
    }
  }

  // Natural stat decay (reduced)
  gameState.hunger = Math.max(0, gameState.hunger - 2);
  gameState.energy = Math.max(0, gameState.energy - 1);

  // Weather effects
  if (gameState.weather === 'storm') {
    gameState.health = Math.max(0, gameState.health - 3);
    gameState.energy = Math.max(0, gameState.energy - 3);
  } else if (gameState.weather === 'rain') {
    gameState.energy = Math.max(0, gameState.energy - 1);
  }

  // Threat damage (reduced chance)
  if (gameState.threats.length > 0 && Math.random() > 0.7) {
    const damage = 3 + Math.floor(Math.random() * 7);
    gameState.health = Math.max(0, gameState.health - damage);
    addLog('system', `💥 Took ${damage} damage from ${gameState.threats[0]}!`);
  }

  // Night healing if resting
  if (gameState.timeOfDay === 'night' && survivorResponse.action.toLowerCase().includes('rest')) {
    gameState.health = Math.min(100, gameState.health + 5);
  }

  // Check death
  if (gameState.health <= 0) {
    gameState.isRunning = false;
    addLog('system', `💀 GAME OVER - Claude survived ${gameState.daysSurvived} days!`);
    setTimeout(() => {
      gameState = createInitialState();
      pendingAdvice = [];
      addLog('system', '🔄 New game starting...');
      broadcast();
    }, 10000);
  } else if (gameState.hunger <= 0) {
    gameState.isRunning = false;
    addLog('system', `💀 STARVED TO DEATH after ${gameState.daysSurvived} days!`);
    setTimeout(() => {
      gameState = createInitialState();
      pendingAdvice = [];
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
    gameState.energy = Math.max(0, gameState.energy - 8);
  } else if (a.includes('berr') || a.includes('forag') || a.includes('food')) {
    gameState.inventory.berries = (gameState.inventory.berries || 0) + 3;
    gameState.hunger = Math.min(100, gameState.hunger + 20);
    gameState.energy = Math.max(0, gameState.energy - 5);
  } else if (a.includes('rest') || a.includes('sleep')) {
    gameState.energy = Math.min(100, gameState.energy + 35);
    gameState.health = Math.min(100, gameState.health + 8);
  } else if (a.includes('fire')) {
    gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 1);
    gameState.energy = Math.min(100, gameState.energy + 10);
    // Fire scares away threats
    if (gameState.threats.length > 0 && Math.random() > 0.6) {
      gameState.threats.pop();
    }
  } else if (a.includes('fight') || a.includes('weapon')) {
    gameState.energy = Math.max(0, gameState.energy - 12);
  } else if (a.includes('shelter') || a.includes('build') || a.includes('fortif')) {
    gameState.inventory.wood = Math.max(0, (gameState.inventory.wood || 0) - 2);
    gameState.energy = Math.max(0, gameState.energy - 12);
  } else if (a.includes('water')) {
    gameState.hunger = Math.min(100, gameState.hunger + 8);
    gameState.energy = Math.max(0, gameState.energy - 3);
  } else if (a.includes('wound') || a.includes('heal') || a.includes('herb') || a.includes('medic')) {
    gameState.health = Math.min(100, gameState.health + 15);
    gameState.energy = Math.max(0, gameState.energy - 5);
  } else if (a.includes('trap')) {
    gameState.inventory.berries = (gameState.inventory.berries || 0) + 1;
    gameState.hunger = Math.min(100, gameState.hunger + 10);
    gameState.energy = Math.max(0, gameState.energy - 8);
  } else if (a.includes('scout') || a.includes('explor')) {
    gameState.energy = Math.max(0, gameState.energy - 10);
    // Chance to find resources
    if (Math.random() > 0.5) {
      gameState.inventory.wood = (gameState.inventory.wood || 0) + 1;
      gameState.inventory.berries = (gameState.inventory.berries || 0) + 1;
    }
  } else if (a.includes('retreat') || a.includes('hiding') || a.includes('distraction')) {
    gameState.energy = Math.max(0, gameState.energy - 15);
  } else if (a.includes('vigil')) {
    gameState.energy = Math.max(0, gameState.energy - 5);
  } else if (a.includes('protect') || a.includes('suppli')) {
    gameState.energy = Math.max(0, gameState.energy - 5);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the game loop
export function startGameLoop() {
  if (gameLoopInterval) return;

  console.log('[SharedGame] Starting game loop...');

  gameLoopInterval = setInterval(() => {
    runGameTurn().catch(console.error);
  }, 8000);

  runGameTurn().catch(console.error);
}

// Subscribe to game updates
export function subscribe(callback: (state: GameState) => void): () => void {
  subscribers.add(callback);
  callback(gameState);

  if (!gameLoopInterval) {
    startGameLoop();
  }

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
