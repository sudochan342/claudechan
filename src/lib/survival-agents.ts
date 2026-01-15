import { PlayerStats, WorldState, InventoryItem } from '@/store/survival';

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
- Temperature: ${worldState.temperature}°C
- Days Survived: ${worldState.daysSurvived}
- Location: ${worldState.currentLocation}
- Visible Threats: ${worldState.threats.length > 0 ? worldState.threats.join(', ') : 'None'}
- Available Resources: ${worldState.resources.join(', ')}

YOUR STATUS:
- Health: ${playerStats.health}% ${playerStats.health < 30 ? '⚠️ CRITICAL' : ''}
- Hunger: ${playerStats.hunger}% ${playerStats.hunger < 30 ? '⚠️ STARVING' : ''}
- Thirst: ${playerStats.thirst}% ${playerStats.thirst < 30 ? '⚠️ DEHYDRATED' : ''}
- Energy: ${playerStats.energy}% ${playerStats.energy < 30 ? '⚠️ EXHAUSTED' : ''}
- Morale: ${playerStats.morale}%

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

// Demo mode responses for when API is unavailable
export const DEMO_GOD_RESPONSES = [
  {
    thought: "The survivor thinks they're safe... let me remind them of their fragility.",
    worldEvent: "A cold wind sweeps through the forest. Branches creak ominously overhead. Something watches from the shadows...",
    worldStateChanges: { temperature: -3, weather: 'cloudy' as const },
    playerStatChanges: { morale: -5 },
    intensity: 4
  },
  {
    thought: "Time to test their reflexes. A predator approaches.",
    worldEvent: "Rustling in the underbrush. A pair of yellow eyes gleam in the darkness. A wolf has caught your scent!",
    worldStateChanges: { threats: ['Wolf'] },
    newThreat: 'wolf',
    intensity: 6
  },
  {
    thought: "Night falls. Let the true test begin.",
    worldEvent: "The sun dips below the treeline. Shadows lengthen and merge into darkness. The forest comes alive with unseen movements.",
    worldStateChanges: { timeOfDay: 'night' as const, temperature: -5 },
    playerStatChanges: { morale: -10 },
    intensity: 5
  },
];

export const DEMO_SURVIVOR_RESPONSES = [
  {
    thought: "I need to gather wood before nightfall. Fire is essential for survival.",
    chosenAction: "chop_wood",
    actionDescription: "I find a fallen birch tree and begin breaking off dry branches. The wood is perfect - dry enough to burn cleanly.",
    emotionalState: "focused",
    survivalTip: "Always gather more firewood than you think you need. The night is long and cold."
  },
  {
    thought: "My thirst is becoming critical. Dehydration kills faster than hunger.",
    chosenAction: "collect_water",
    actionDescription: "I follow the sound of running water to a small stream. I cup my hands and drink deeply, then fill my makeshift container.",
    emotionalState: "relieved",
    survivalTip: "In survival situations, prioritize water over food. You can survive weeks without food, but only days without water."
  },
  {
    thought: "A wolf! I need to evaluate - fight or flight? My energy is low...",
    chosenAction: "fight",
    actionDescription: "I grab a thick branch and stand my ground, making myself appear larger. I shout and wave the branch aggressively!",
    emotionalState: "terrified but determined",
    survivalTip: "Against wolves, never run - it triggers their chase instinct. Make noise, appear big, and back away slowly."
  },
];
