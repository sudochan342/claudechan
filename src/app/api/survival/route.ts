import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import {
  generateGodSystemPrompt,
  generateSurvivorSystemPrompt,
  DEMO_GOD_RESPONSES,
  DEMO_SURVIVOR_RESPONSES,
} from '@/lib/survival-agents';
import { PlayerStats, WorldState, InventoryItem } from '@/store/survival';

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'Claude Survival Game',
  },
});

interface GameTurnRequest {
  worldState: WorldState;
  playerStats: PlayerStats;
  inventory: InventoryItem[];
  recentEvents: string[];
  turnNumber: number;
  userAdvice?: { advice: string }[];
}

function getRandomDemoGod() {
  return DEMO_GOD_RESPONSES[Math.floor(Math.random() * DEMO_GOD_RESPONSES.length)];
}

function getRandomDemoSurvivor() {
  return DEMO_SURVIVOR_RESPONSES[Math.floor(Math.random() * DEMO_SURVIVOR_RESPONSES.length)];
}

export async function POST(request: NextRequest) {
  const gameState: GameTurnRequest = await request.json();

  if (!gameState.worldState || !gameState.playerStats) {
    return new Response('Invalid game state', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Phase 1: God AI evaluates and creates challenges
        sendEvent({ type: 'phase', phase: 'god_thinking' });

        const godResponse = await generateGodResponse(gameState);
        sendEvent({ type: 'god_thought', content: godResponse.thought });
        await new Promise(r => setTimeout(r, 800));

        sendEvent({ type: 'world_event', content: godResponse.worldEvent });

        if (godResponse.worldStateChanges) {
          sendEvent({ type: 'world_state_change', changes: godResponse.worldStateChanges });
        }

        if (godResponse.playerStatChanges) {
          sendEvent({ type: 'player_stat_change', changes: godResponse.playerStatChanges, source: 'environment' });
        }

        if (godResponse.newThreat) {
          sendEvent({ type: 'threat_spawned', threat: godResponse.newThreat });
        }

        sendEvent({ type: 'god_intensity', intensity: godResponse.intensity || 5 });

        await new Promise(r => setTimeout(r, 1000));

        // Phase 2: Survivor AI responds
        sendEvent({ type: 'phase', phase: 'survivor_thinking' });

        // Update the state with god's changes for survivor's context
        const updatedWorldState = {
          ...gameState.worldState,
          ...(godResponse.worldStateChanges || {})
        };
        const updatedPlayerStats = {
          ...gameState.playerStats,
          ...(godResponse.playerStatChanges || {})
        };

        const survivorResponse = await generateSurvivorResponse({
          ...gameState,
          worldState: updatedWorldState,
          playerStats: updatedPlayerStats,
          recentEvents: [...gameState.recentEvents, godResponse.worldEvent],
          userAdvice: gameState.userAdvice,
        });

        sendEvent({ type: 'survivor_thought', content: survivorResponse.thought });
        await new Promise(r => setTimeout(r, 600));

        sendEvent({
          type: 'survivor_action',
          action: survivorResponse.chosenAction,
          description: survivorResponse.actionDescription,
          emotionalState: survivorResponse.emotionalState,
        });

        if (survivorResponse.survivalTip) {
          sendEvent({ type: 'survival_tip', tip: survivorResponse.survivalTip });
        }

        // Calculate action results
        const actionResults = calculateActionResults(
          survivorResponse.chosenAction,
          updatedPlayerStats,
          updatedWorldState
        );

        sendEvent({ type: 'action_result', ...actionResults });

        // Phase 3: Complete the turn
        sendEvent({
          type: 'turn_complete',
          turnNumber: gameState.turnNumber + 1,
          summary: {
            godEvent: godResponse.worldEvent,
            playerAction: survivorResponse.chosenAction,
            statsAfter: {
              ...updatedPlayerStats,
              ...actionResults.statChanges
            }
          }
        });

        controller.close();

      } catch (error) {
        console.error('Survival game error:', error);
        sendEvent({ type: 'error', message: 'The forest grows silent... Please try again.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function generateGodResponse(gameState: GameTurnRequest) {
  // Demo mode if no API key
  if (!process.env.OPENROUTER_API_KEY) {
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    return getRandomDemoGod();
  }

  const systemPrompt = generateGodSystemPrompt(gameState.worldState, gameState.playerStats);

  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Turn ${gameState.turnNumber}. Recent events: ${gameState.recentEvents.slice(-3).join('; ') || 'Game just started'}.

Generate the next world event. Remember: challenge but don't instantly kill. Make it entertaining.`
      },
    ],
    max_tokens: 300,
    temperature: 0.85,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return {
      thought: 'The forest stirs...',
      worldEvent: 'An eerie silence falls over the forest.',
      intensity: 3
    };
  }
}

async function generateSurvivorResponse(gameState: GameTurnRequest) {
  // Demo mode if no API key
  if (!process.env.OPENROUTER_API_KEY) {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    return getRandomDemoSurvivor();
  }

  const systemPrompt = generateSurvivorSystemPrompt(
    gameState.worldState,
    gameState.playerStats,
    gameState.inventory,
    gameState.recentEvents
  );

  // Build user message with optional advice
  let userMessage = `It's turn ${gameState.turnNumber}. Analyze your situation carefully and decide your next action. Think through your priorities and survival needs.`;

  if (gameState.userAdvice && gameState.userAdvice.length > 0) {
    const adviceText = gameState.userAdvice
      .map(a => `- "${a.advice}"`)
      .join('\n');
    userMessage += `\n\n**VIEWER ADVICE FROM THE WATCHERS:**\n${adviceText}\n\nConsider this advice from viewers who are watching you survive. They may have valuable insights!`;
  }

  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: userMessage
      },
    ],
    max_tokens: 300,
    temperature: 0.8,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return {
      thought: 'I need to stay focused...',
      chosenAction: 'scout',
      actionDescription: 'I carefully observe my surroundings.',
      emotionalState: 'cautious'
    };
  }
}

function calculateActionResults(
  action: string,
  currentStats: PlayerStats,
  worldState: WorldState
): {
  success: boolean;
  statChanges: Partial<PlayerStats>;
  inventoryChanges?: { add?: string[]; remove?: string[] };
  message: string;
} {
  const hasThreat = worldState.threats && worldState.threats.length > 0;
  const isNight = worldState.timeOfDay === 'night' || worldState.timeOfDay === 'dusk';
  const isCold = worldState.temperature < 10;
  const isStorm = worldState.weather === 'storm' || worldState.weather === 'rain';

  // Base success chance modified by conditions
  let successChance = 0.8;
  if (isNight) successChance -= 0.15;
  if (isStorm) successChance -= 0.1;
  if (currentStats.energy < 30) successChance -= 0.2;

  const success = Math.random() < successChance;

  const actionEffects: Record<string, {
    statChanges: Partial<PlayerStats>;
    inventory?: { add?: string[]; remove?: string[] };
    successMsg: string;
    failMsg: string;
  }> = {
    chop_wood: {
      statChanges: { energy: -15, hunger: -5 },
      inventory: { add: ['wood'] },
      successMsg: 'Successfully gathered firewood!',
      failMsg: 'The axe slipped... wasted effort but no injury.'
    },
    gather_berries: {
      statChanges: { energy: -5, hunger: 20 },
      inventory: { add: ['berries'] },
      successMsg: 'Found a bush full of ripe berries!',
      failMsg: 'The berries look poisonous... better not risk it.'
    },
    collect_water: {
      statChanges: { energy: -10, thirst: 30 },
      inventory: { add: ['water'] },
      successMsg: 'Collected fresh water from the stream.',
      failMsg: 'The water source was murky... need to find another.'
    },
    hunt: {
      statChanges: { energy: -25, hunger: success ? 40 : -10 },
      inventory: success ? { add: ['meat'] } : undefined,
      successMsg: 'The hunt was successful! Fresh meat secured.',
      failMsg: 'The prey escaped. Wasted energy and still hungry.'
    },
    fish: {
      statChanges: { energy: -15, hunger: success ? 25 : 0 },
      inventory: success ? { add: ['fish'] } : undefined,
      successMsg: 'Caught a fish! Dinner is served.',
      failMsg: 'The fish aren\'t biting today...'
    },
    start_fire: {
      statChanges: { energy: -20, morale: 15 },
      inventory: { remove: ['wood'] },
      successMsg: 'The fire crackles to life, warmth spreads.',
      failMsg: 'The wood is too damp... fire won\'t start.'
    },
    craft_tool: {
      statChanges: { energy: -15 },
      inventory: success ? { add: ['tool'], remove: ['stone', 'stick'] } : undefined,
      successMsg: 'Crafted a useful tool from available materials.',
      failMsg: 'The materials broke... need to try again.'
    },
    craft_weapon: {
      statChanges: { energy: -20 },
      inventory: success ? { add: ['spear'], remove: ['stick', 'stone'] } : undefined,
      successMsg: 'Fashioned a crude but effective spear.',
      failMsg: 'The binding won\'t hold... weapon is unusable.'
    },
    build_shelter: {
      statChanges: { energy: -40, morale: 20 },
      inventory: { remove: ['wood', 'wood', 'wood'] },
      successMsg: 'Shelter construction complete! A roof over your head.',
      failMsg: 'The structure collapsed... need more materials and try again.'
    },
    fortify: {
      statChanges: { energy: -30, morale: 10 },
      successMsg: 'Defenses strengthened. Feel safer now.',
      failMsg: 'The fortifications are weak... they won\'t hold.'
    },
    fight: {
      statChanges: {
        energy: -30,
        health: success ? -10 : -30,
        morale: success ? 20 : -20
      },
      successMsg: 'Victory! The threat has been neutralized.',
      failMsg: 'Took serious damage in the fight!'
    },
    flee: {
      statChanges: { energy: -25, morale: -10 },
      successMsg: 'Escaped successfully! Heart pounding but safe.',
      failMsg: 'Couldn\'t outrun the threat! Took damage fleeing.'
    },
    rest: {
      statChanges: { energy: 30, hunger: -10, thirst: -10 },
      successMsg: 'A brief rest restores some energy.',
      failMsg: 'Too anxious to rest properly...'
    },
    sleep: {
      statChanges: { energy: 60, hunger: -20, thirst: -15, health: 10 },
      successMsg: 'Deep sleep restores body and mind.',
      failMsg: 'Sleep was restless... nightmares haunt you.'
    },
    explore: {
      statChanges: { energy: -20 },
      successMsg: 'Discovered a new area with promising resources!',
      failMsg: 'Got lost for a while... wasted time and energy.'
    },
    scout: {
      statChanges: { energy: -10 },
      successMsg: 'Scouting reveals useful information about surroundings.',
      failMsg: 'Visibility is poor... couldn\'t see much.'
    }
  };

  const effect = actionEffects[action] || {
    statChanges: { energy: -10 },
    successMsg: 'Action completed.',
    failMsg: 'Action failed.'
  };

  // Apply cold/storm penalties
  const environmentalPenalty: Partial<PlayerStats> = {};
  if (isCold) environmentalPenalty.health = -5;
  if (isStorm) environmentalPenalty.morale = -5;

  return {
    success,
    statChanges: { ...effect.statChanges, ...environmentalPenalty },
    inventoryChanges: success ? effect.inventory : undefined,
    message: success ? effect.successMsg : effect.failMsg
  };
}

// GET endpoint for game status/leaderboard
export async function GET() {
  return Response.json({
    status: 'active',
    message: 'Claude Survival Game API',
    version: '1.0.0'
  });
}
