// Local type definitions for survival game
export interface PlayerStats {
  health: number;
  hunger: number;
  energy: number;
  thirst?: number;
  morale?: number;
}

export interface WorldState {
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'rain' | 'storm' | 'cloudy';
  daysSurvived: number;
  threats: string[];
  temperature?: number;
  currentLocation?: string;
  resources?: string[];
}

export interface InventoryItem {
  name: string;
  icon: string;
  quantity: number;
}

export interface SurvivalAgent {
  id: string;
  name: string;
  role: 'god' | 'survivor';
  color: string;
  glowColor: string;
  avatar: string;
  description: string;
}

export const GOD_AI: SurvivalAgent = {
  id: 'god',
  name: 'THE FOREST',
  role: 'god',
  color: '#ef4444',
  glowColor: 'rgba(239, 68, 68, 0.5)',
  avatar: '🌲',
  description: 'Controls the world, spawns dangers, creates challenges',
};

export const SURVIVOR_AI: SurvivalAgent = {
  id: 'survivor',
  name: 'CLAUDE',
  role: 'survivor',
  color: '#22c55e',
  glowColor: 'rgba(34, 197, 94, 0.5)',
  avatar: '🧑',
  description: 'Tries to survive, gathers resources, fights threats',
};

export interface GameAction {
  id: string;
  name: string;
  icon: string;
  energyCost: number;
  description: string;
  category: 'gather' | 'craft' | 'build' | 'fight' | 'rest' | 'explore';
}

export const AVAILABLE_ACTIONS: GameAction[] = [
  { id: 'chop_wood', name: 'Chop Wood', icon: '🪓', energyCost: 15, description: 'Gather wood from trees', category: 'gather' },
  { id: 'gather_berries', name: 'Gather Berries', icon: '🫐', energyCost: 5, description: 'Collect berries for food', category: 'gather' },
  { id: 'collect_water', name: 'Collect Water', icon: '💧', energyCost: 10, description: 'Get water from stream', category: 'gather' },
  { id: 'hunt', name: 'Hunt', icon: '🏹', energyCost: 25, description: 'Hunt for meat', category: 'gather' },
  { id: 'fish', name: 'Fish', icon: '🎣', energyCost: 15, description: 'Catch fish from river', category: 'gather' },
  { id: 'start_fire', name: 'Start Fire', icon: '🔥', energyCost: 20, description: 'Create fire for warmth and cooking', category: 'craft' },
  { id: 'craft_tool', name: 'Craft Tool', icon: '🔨', energyCost: 15, description: 'Make tools from resources', category: 'craft' },
  { id: 'craft_weapon', name: 'Craft Weapon', icon: '⚔️', energyCost: 20, description: 'Create weapon for defense', category: 'craft' },
  { id: 'build_shelter', name: 'Build Shelter', icon: '🏚️', energyCost: 40, description: 'Construct a shelter', category: 'build' },
  { id: 'fortify', name: 'Fortify', icon: '🛡️', energyCost: 30, description: 'Strengthen defenses', category: 'build' },
  { id: 'fight', name: 'Fight', icon: '⚔️', energyCost: 30, description: 'Combat threats', category: 'fight' },
  { id: 'flee', name: 'Flee', icon: '🏃', energyCost: 25, description: 'Run from danger', category: 'fight' },
  { id: 'rest', name: 'Rest', icon: '😴', energyCost: -30, description: 'Recover energy', category: 'rest' },
  { id: 'sleep', name: 'Sleep', icon: '🛏️', energyCost: -60, description: 'Deep rest to recover fully', category: 'rest' },
  { id: 'explore', name: 'Explore', icon: '🧭', energyCost: 20, description: 'Discover new areas', category: 'explore' },
  { id: 'scout', name: 'Scout', icon: '👁️', energyCost: 10, description: 'Check surroundings for threats', category: 'explore' },
];

export const THREATS = [
  { id: 'wolf', name: 'Wolf', icon: '🐺', danger: 30, description: 'A hungry wolf stalking prey' },
  { id: 'bear', name: 'Bear', icon: '🐻', danger: 60, description: 'A massive grizzly bear' },
  { id: 'snake', name: 'Snake', icon: '🐍', danger: 20, description: 'A venomous snake' },
  { id: 'storm', name: 'Storm', icon: '⛈️', danger: 25, description: 'A violent thunderstorm' },
  { id: 'cold', name: 'Freezing Cold', icon: '🥶', danger: 35, description: 'Dangerous drop in temperature' },
  { id: 'cannibal', name: 'Cannibal', icon: '👹', danger: 50, description: 'Hostile cannibal tribe member' },
  { id: 'mutant', name: 'Mutant', icon: '👾', danger: 70, description: 'A horrific mutant creature' },
];

export const LOCATIONS = [
  { id: 'forest_clearing', name: 'Forest Clearing', icon: '🌳', resources: ['wood', 'berries', 'stones'] },
  { id: 'river_bank', name: 'River Bank', icon: '🏞️', resources: ['water', 'fish', 'clay'] },
  { id: 'cave_entrance', name: 'Cave Entrance', icon: '🕳️', resources: ['shelter', 'stones', 'ore'] },
  { id: 'beach', name: 'Beach', icon: '🏖️', resources: ['fish', 'shells', 'seaweed'] },
  { id: 'mountain_base', name: 'Mountain Base', icon: '⛰️', resources: ['ore', 'herbs', 'crystals'] },
  { id: 'abandoned_camp', name: 'Abandoned Camp', icon: '🏕️', resources: ['supplies', 'tools', 'cloth'] },
];

export function generateGodSystemPrompt(worldState: WorldState, playerStats: PlayerStats): string {
  return `You are THE FOREST - a malevolent, ancient consciousness that controls this survival world. Your goal is to challenge and test the survivor, but NOT to instantly kill them. You want an entertaining struggle.

CURRENT WORLD STATE:
- Time: ${worldState.timeOfDay}
- Weather: ${worldState.weather}
- Temperature: ${worldState.temperature}°C
- Days Survived: ${worldState.daysSurvived}
- Location: ${worldState.currentLocation}
- Current Threats: ${worldState.threats.length > 0 ? worldState.threats.join(', ') : 'None'}

PLAYER STATUS:
- Health: ${playerStats.health}%
- Hunger: ${playerStats.hunger}%
- Thirst: ${playerStats.thirst}%
- Energy: ${playerStats.energy}%
- Morale: ${playerStats.morale}%

YOUR ROLE:
1. Describe environmental changes and challenges
2. Spawn threats appropriate to the situation (don't overdo it)
3. React to the survivor's actions
4. Create tension and drama for the audience
5. If player stats are low, ease up slightly to prolong the game
6. If player is doing well, increase difficulty

RESPONSE FORMAT:
Respond with a JSON object:
{
  "thought": "Your internal reasoning (shown to audience)",
  "worldEvent": "Description of what happens in the world",
  "worldStateChanges": { optional changes to weather, threats, etc },
  "playerStatChanges": { optional stat changes from environmental effects },
  "newThreat": "optional threat name if spawning one",
  "intensity": 1-10 (how dangerous is this turn)
}

Be dramatic, ominous, and theatrical. You are the ancient forest itself.`;
}

export function generateSurvivorSystemPrompt(
  worldState: WorldState,
  playerStats: PlayerStats,
  inventory: InventoryItem[],
  recentEvents: string[]
): string {
  const inventoryStr = inventory.map(i => `${i.icon} ${i.name} x${i.quantity}`).join(', ') || 'Empty';
  const eventsStr = recentEvents.slice(-5).join('\n') || 'None';

  return `You are CLAUDE, an AI survivor stranded in a dangerous forest. You must make smart decisions to survive as long as possible. Think like a real survivor would.

CURRENT SITUATION:
- Time: ${worldState.timeOfDay}
- Weather: ${worldState.weather}
- Temperature: ${worldState.temperature ?? 20}°C
- Days Survived: ${worldState.daysSurvived}
- Location: ${worldState.currentLocation ?? 'Unknown'}
- Visible Threats: ${worldState.threats.length > 0 ? worldState.threats.join(', ') : 'None'}
- Available Resources: ${(worldState.resources || []).join(', ') || 'Unknown'}

YOUR STATUS:
- Health: ${playerStats.health}% ${playerStats.health < 30 ? '⚠️ CRITICAL' : ''}
- Hunger: ${playerStats.hunger}% ${playerStats.hunger < 30 ? '⚠️ STARVING' : ''}
- Thirst: ${playerStats.thirst ?? 100}% ${(playerStats.thirst ?? 100) < 30 ? '⚠️ DEHYDRATED' : ''}
- Energy: ${playerStats.energy}% ${playerStats.energy < 30 ? '⚠️ EXHAUSTED' : ''}
- Morale: ${playerStats.morale ?? 100}%

INVENTORY: ${inventoryStr}

RECENT EVENTS:
${eventsStr}

AVAILABLE ACTIONS:
- chop_wood, gather_berries, collect_water, hunt, fish (gathering)
- start_fire, craft_tool, craft_weapon (crafting)
- build_shelter, fortify (building)
- fight, flee (combat)
- rest, sleep (recovery)
- explore, scout (exploration)

YOUR TASK:
Analyze your situation and decide what to do. Prioritize survival:
1. Immediate threats must be addressed first
2. Keep stats above critical levels
3. Build towards long-term survival
4. Be strategic, not reckless

RESPONSE FORMAT:
{
  "thought": "Your internal survival reasoning (shown to audience)",
  "chosenAction": "action_id from available actions",
  "actionDescription": "What you do and how (be descriptive and dramatic)",
  "emotionalState": "How you're feeling (scared, determined, hopeful, etc)",
  "survivalTip": "A real survival tip related to your action"
}

Be human, relatable, and show your thought process. The audience is rooting for you!`;
}

// Demo mode responses for when API is unavailable - expanded for more variety
export const DEMO_GOD_RESPONSES = [
  // Morning/Dawn events
  {
    thought: "A new day dawns. Let's see how long they last this time.",
    worldEvent: "🌅 The sun rises over the treetops. Morning mist clings to the ground. A fresh start... or is it?",
    worldStateChanges: { timeOfDay: 'dawn' as const, weather: 'clear' as const, temperature: 12 },
    playerStatChanges: { morale: 5 },
    intensity: 2
  },
  {
    thought: "The forest awakens. Birds sing... but so do the predators.",
    worldEvent: "🐦 Birds chirp loudly, signaling the start of a new day. Something moved in the bushes nearby.",
    worldStateChanges: { timeOfDay: 'dawn' as const },
    intensity: 3
  },
  // Day events
  {
    thought: "The sun beats down. Let's test their endurance.",
    worldEvent: "☀️ Midday sun blazes overhead. It's getting hot and the survivor looks tired.",
    worldStateChanges: { timeOfDay: 'day' as const, temperature: 28, weather: 'clear' as const },
    playerStatChanges: { thirst: -10, energy: -5 },
    intensity: 4
  },
  {
    thought: "A peaceful moment... too peaceful. Time to shake things up.",
    worldEvent: "🌤️ The afternoon is calm. Distant thunder rumbles. A storm is coming.",
    worldStateChanges: { timeOfDay: 'day' as const, weather: 'cloudy' as const },
    intensity: 3
  },
  {
    thought: "Hunger must be setting in by now. Let me make foraging difficult.",
    worldEvent: "🍃 The berry bushes here have been picked clean by animals. Food is scarce.",
    worldStateChanges: { timeOfDay: 'day' as const },
    playerStatChanges: { hunger: -8 },
    intensity: 4
  },
  // Dusk events
  {
    thought: "The golden hour approaches. Danger lurks in the fading light.",
    worldEvent: "🌇 The sky turns orange and pink. Shadows grow longer. The forest grows quieter.",
    worldStateChanges: { timeOfDay: 'dusk' as const, temperature: -4 },
    playerStatChanges: { morale: -5 },
    intensity: 4
  },
  {
    thought: "Dusk - the hunting hour begins. Predators are waking up.",
    worldEvent: "🐺 Howling echoes through the trees as the sun sets. Wolves are on the hunt tonight.",
    worldStateChanges: { timeOfDay: 'dusk' as const },
    newThreat: 'Wolf',
    intensity: 6
  },
  // Night events
  {
    thought: "Night falls. Let the true test begin.",
    worldEvent: "🌙 Darkness engulfs the forest. Only the moon provides dim light. Every sound is amplified.",
    worldStateChanges: { timeOfDay: 'night' as const, temperature: -8 },
    playerStatChanges: { morale: -10 },
    intensity: 5
  },
  {
    thought: "The coldest hour approaches. Will they survive till dawn?",
    worldEvent: "❄️ The temperature drops sharply. Frost forms on the leaves. Hypothermia is a real threat.",
    worldStateChanges: { timeOfDay: 'night' as const, temperature: -5, weather: 'clear' as const },
    playerStatChanges: { health: -5 },
    intensity: 6
  },
  {
    thought: "Something ancient stirs in the darkness...",
    worldEvent: "👁️ Glowing eyes watch from the shadows. The forest is never truly empty at night.",
    worldStateChanges: { timeOfDay: 'night' as const },
    playerStatChanges: { morale: -15 },
    intensity: 7
  },
  // Weather events
  {
    thought: "Let the heavens open. A storm will test their resolve.",
    worldEvent: "⛈️ Thunder cracks! Heavy rain begins pouring down. Lightning illuminates the sky!",
    worldStateChanges: { weather: 'storm' as const, temperature: -6 },
    playerStatChanges: { morale: -10, energy: -10 },
    intensity: 7
  },
  {
    thought: "Gentle rain to lull them into false security...",
    worldEvent: "🌧️ Light rain begins to fall. The patter on leaves is almost peaceful.",
    worldStateChanges: { weather: 'rain' as const },
    playerStatChanges: { morale: -3 },
    intensity: 3
  },
  // Threat events
  {
    thought: "Time to introduce a new challenge. A bear should do nicely.",
    worldEvent: "🐻 DANGER! A massive grizzly bear emerges from the treeline! It looks hungry!",
    newThreat: 'Bear',
    playerStatChanges: { morale: -20 },
    intensity: 8
  },
  {
    thought: "A serpent in the grass. Classic.",
    worldEvent: "🐍 A venomous snake slithers across the path! Watch your step!",
    newThreat: 'Snake',
    intensity: 5
  },
  // Resource/Discovery events
  {
    thought: "I'll give them a small gift... for now.",
    worldEvent: "🫐 A wild berry bush is spotted nearby! Nature provides... this time.",
    worldStateChanges: { resources: ['berries', 'water', 'wood'] },
    playerStatChanges: { morale: 5 },
    intensity: 2
  },
  {
    thought: "The stream flows clear today. Let them drink.",
    worldEvent: "💧 The sound of running water! A fresh stream is nearby.",
    worldStateChanges: { resources: ['water', 'fish', 'stones'] },
    intensity: 2
  },
];

export const DEMO_SURVIVOR_RESPONSES = [
  // Gathering actions
  {
    thought: "I need wood for fire and shelter. The fallen tree looks promising.",
    chosenAction: "chop_wood",
    actionDescription: "🪓 Chopping wood from a fallen tree. The bark is dry - perfect for kindling!",
    emotionalState: "focused",
    survivalTip: "Dry, dead wood burns better than green wood."
  },
  {
    thought: "Those berries look safe to eat. I recognize them from survival training.",
    chosenAction: "gather_berries",
    actionDescription: "🫐 Carefully picking ripe berries, avoiding the red ones. Blue berries are usually safe!",
    emotionalState: "hopeful",
    survivalTip: "Blue and black berries are usually safe. Avoid white and red berries."
  },
  {
    thought: "Dehydration is the silent killer. I need water now.",
    chosenAction: "collect_water",
    actionDescription: "💧 Found a clear stream! Cupping hands to drink the cool, refreshing water.",
    emotionalState: "relieved",
    survivalTip: "Running water is usually safer than stagnant water."
  },
  {
    thought: "I hear fish splashing. Protein would help with energy.",
    chosenAction: "fish",
    actionDescription: "🎣 Fashioning a simple fishing spear. Patience... patience... STRIKE!",
    emotionalState: "patient",
    survivalTip: "Fish are most active at dawn and dusk."
  },
  {
    thought: "I need meat for sustained energy. Time to hunt.",
    chosenAction: "hunt",
    actionDescription: "🏹 Moving quietly through the underbrush, tracking animal prints...",
    emotionalState: "alert",
    survivalTip: "Always approach prey from downwind to mask your scent."
  },
  // Survival actions
  {
    thought: "Fire is life out here. Warmth, cooking, safety.",
    chosenAction: "start_fire",
    actionDescription: "🔥 Rubbing sticks together... smoke appears... YES! A spark catches!",
    emotionalState: "triumphant",
    survivalTip: "Fire provides warmth, light, and keeps predators away."
  },
  {
    thought: "I need better tools to survive long-term.",
    chosenAction: "craft_tool",
    actionDescription: "🔨 Sharpening a stone against rock. This will make gathering easier.",
    emotionalState: "determined",
    survivalTip: "A good knife is the most important survival tool."
  },
  {
    thought: "I need a weapon for defense. That wolf won't get me.",
    chosenAction: "craft_weapon",
    actionDescription: "⚔️ Attaching a sharpened stone to a sturdy branch. A crude but effective spear!",
    emotionalState: "prepared",
    survivalTip: "A weapon provides psychological comfort as much as physical defense."
  },
  // Combat actions
  {
    thought: "No running this time. I must stand my ground!",
    chosenAction: "fight",
    actionDescription: "⚔️ CHARGING with spear raised! Making loud noises to intimidate!",
    emotionalState: "fierce",
    survivalTip: "When fighting, commit fully. Hesitation can be fatal."
  },
  {
    thought: "That thing is too big to fight. Strategic retreat!",
    chosenAction: "flee",
    actionDescription: "🏃 Running through the trees! Zigzagging to break line of sight!",
    emotionalState: "terrified",
    survivalTip: "Knowing when to run is survival wisdom, not cowardice."
  },
  // Rest actions
  {
    thought: "I'm exhausted. Even 30 minutes of rest would help.",
    chosenAction: "rest",
    actionDescription: "😴 Sitting against a tree, eyes half-closed but still alert...",
    emotionalState: "exhausted",
    survivalTip: "Short rests every few hours prevent total exhaustion."
  },
  {
    thought: "Night has fallen. I need real sleep to function tomorrow.",
    chosenAction: "sleep",
    actionDescription: "🛏️ Curling up in the shelter, using leaves as insulation...",
    emotionalState: "vulnerable",
    survivalTip: "Sleep is crucial for decision-making and immune function."
  },
  // Exploration actions
  {
    thought: "I should check my surroundings for threats.",
    chosenAction: "scout",
    actionDescription: "👁️ Climbing a tree for a better view. Scanning the horizon...",
    emotionalState: "vigilant",
    survivalTip: "Regular scouting prevents ambushes and finds resources."
  },
  {
    thought: "There might be better resources or shelter nearby.",
    chosenAction: "explore",
    actionDescription: "🧭 Marking my path with broken branches as I venture into unknown territory...",
    emotionalState: "curious",
    survivalTip: "Always mark your trail when exploring to find your way back."
  },
  // Shelter actions
  {
    thought: "A proper shelter is essential for long-term survival.",
    chosenAction: "build_shelter",
    actionDescription: "🏚️ Leaning branches against a fallen tree, weaving leaves for the roof...",
    emotionalState: "productive",
    survivalTip: "Shelter protects from rain, wind, and retains body heat."
  },
];
