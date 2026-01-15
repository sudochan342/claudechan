'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';
import { PixiGameWorld } from './PixiGameWorld';
import { PlayerStats } from './PlayerStats';
import { GameLog } from './GameLog';
import { AIBrains } from './AIBrain';
import { PumpChat } from './PumpChat';

export function SurvivalGame() {
  const {
    isPlaying,
    isPaused,
    gameSpeed,
    playerStats,
    inventory,
    worldState,
    gameEvents,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    setGameSpeed,
    updatePlayerStats,
    updateWorldState,
    addGameEvent,
    setGodThoughts,
    setSurvivorThoughts,
    setCurrentAction,
    addInventoryItem,
    addChatMessage,
    resetGame,
  } = useSurvivalStore();

  const [turnNumber, setTurnNumber] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [survivalTip, setSurvivalTip] = useState<string | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Process a single game turn
  const processTurn = useCallback(async () => {
    if (!isPlaying || isPaused || isProcessing) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/survival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldState,
          playerStats,
          inventory,
          recentEvents: gameEvents.slice(-5).map(e => e.content),
          turnNumber,
        }),
      });

      if (!response.ok) throw new Error('Game API error');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'phase':
                if (data.phase === 'god_thinking') {
                  setCurrentAction('The Forest is scheming...');
                } else if (data.phase === 'survivor_thinking') {
                  setCurrentAction('Claude is thinking...');
                }
                break;

              case 'god_thought':
                setGodThoughts(data.content);
                addGameEvent({
                  source: 'god',
                  type: 'thought',
                  content: data.content,
                  emoji: '🧠',
                });
                break;

              case 'world_event':
                addGameEvent({
                  source: 'world',
                  type: 'environmental',
                  content: data.content,
                  emoji: '🌲',
                });
                // Trigger chat reaction
                addChatMessage({
                  username: 'system',
                  message: `🌲 ${data.content.slice(0, 50)}...`,
                  color: '#a855f7',
                });
                break;

              case 'world_state_change':
                updateWorldState(data.changes);
                break;

              case 'player_stat_change':
                updatePlayerStats(data.changes);
                if (data.changes.health && data.changes.health < 0) {
                  addGameEvent({
                    source: 'system',
                    type: 'danger',
                    content: `Environmental damage: ${Math.abs(data.changes.health)} health lost`,
                    emoji: '💔',
                  });
                }
                break;

              case 'threat_spawned':
                addGameEvent({
                  source: 'god',
                  type: 'danger',
                  content: `A ${data.threat} appears!`,
                  emoji: '⚠️',
                });
                updateWorldState({
                  threats: [...worldState.threats, data.threat],
                });
                break;

              case 'survivor_thought':
                setSurvivorThoughts(data.content);
                addGameEvent({
                  source: 'survivor',
                  type: 'thought',
                  content: data.content,
                  emoji: '💭',
                });
                break;

              case 'survivor_action':
                setCurrentAction(data.action.replace('_', ' ').toUpperCase());
                addGameEvent({
                  source: 'survivor',
                  type: 'action',
                  content: data.description,
                  emoji: '🎯',
                });
                break;

              case 'survival_tip':
                setSurvivalTip(data.tip);
                setTimeout(() => setSurvivalTip(null), 8000);
                break;

              case 'action_result':
                updatePlayerStats(data.statChanges);
                addGameEvent({
                  source: 'system',
                  type: data.success ? 'success' : 'failure',
                  content: data.message,
                  emoji: data.success ? '✅' : '❌',
                });

                // Handle inventory changes
                if (data.inventoryChanges?.add) {
                  for (const item of data.inventoryChanges.add) {
                    addInventoryItem({
                      id: item,
                      name: item.charAt(0).toUpperCase() + item.slice(1),
                      quantity: 1,
                      icon: getItemIcon(item),
                      type: getItemType(item),
                    });
                  }
                }
                break;

              case 'turn_complete':
                setTurnNumber(data.turnNumber);
                setCurrentAction('');

                // Check for game over
                const newStats = { ...playerStats, ...data.summary?.statsAfter };
                if (newStats.health <= 0) {
                  endGame();
                  addGameEvent({
                    source: 'system',
                    type: 'danger',
                    content: `GAME OVER - Claude survived ${worldState.daysSurvived} days.`,
                    emoji: '💀',
                  });
                }

                // Update day counter
                if (data.turnNumber % 4 === 0) {
                  updateWorldState({
                    daysSurvived: worldState.daysSurvived + 1,
                  });
                }

                // Cycle time of day
                const times: Array<'dawn' | 'day' | 'dusk' | 'night'> = ['dawn', 'day', 'dusk', 'night'];
                const currentIdx = times.indexOf(worldState.timeOfDay);
                updateWorldState({
                  timeOfDay: times[(currentIdx + 1) % 4],
                });
                break;
            }
          } catch {
            // Ignore parse errors from partial data
          }
        }
      }
    } catch (error) {
      console.error('Turn processing error:', error);
      addGameEvent({
        source: 'system',
        type: 'failure',
        content: 'Connection lost... retrying...',
        emoji: '⚠️',
      });
    } finally {
      setIsProcessing(false);
      setGodThoughts('');
      setSurvivorThoughts('');
    }
  }, [
    isPlaying,
    isPaused,
    isProcessing,
    worldState,
    playerStats,
    inventory,
    gameEvents,
    turnNumber,
    updatePlayerStats,
    updateWorldState,
    addGameEvent,
    setGodThoughts,
    setSurvivorThoughts,
    setCurrentAction,
    addInventoryItem,
    addChatMessage,
    endGame,
  ]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !isPaused) {
      const interval = 6000 / gameSpeed; // Base interval adjusted by speed
      gameLoopRef.current = setInterval(processTurn, interval);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPlaying, isPaused, gameSpeed, processTurn]);

  // Handle start game
  const handleStart = () => {
    resetGame();
    startGame();
    setTurnNumber(0);

    addGameEvent({
      source: 'system',
      type: 'environmental',
      content: 'Claude wakes up in a mysterious forest. Survival begins now.',
      emoji: '🌅',
    });

    addChatMessage({
      username: 'system',
      message: '🎮 Game started! Can Claude survive The Forest?',
      color: '#22c55e',
    });

    // Start first turn after a short delay
    setTimeout(processTurn, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.h1
                className="text-2xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                🌲 CLAUDE SURVIVAL
              </motion.h1>
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
                <span>GOD AI vs SURVIVOR AI</span>
                <span className="text-green-500">●</span>
                <span>LIVE</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isPlaying ? (
                <motion.button
                  onClick={handleStart}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all"
                >
                  ▶️ START GAME
                </motion.button>
              ) : (
                <>
                  <motion.button
                    onClick={isPaused ? resumeGame : pauseGame}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {isPaused ? '▶️' : '⏸️'}
                  </motion.button>

                  <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                    {[1, 2, 3].map((speed) => (
                      <motion.button
                        key={speed}
                        onClick={() => setGameSpeed(speed as 1 | 2 | 3)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`px-3 py-1 rounded text-sm ${gameSpeed === speed
                            ? 'bg-green-600 text-white'
                            : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        {speed}x
                      </motion.button>
                    ))}
                  </div>

                  <motion.button
                    onClick={() => {
                      endGame();
                      resetGame();
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-red-600/50 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    ⏹️ END
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Game World Visualization */}
            <PixiGameWorld />

            {/* AI Brains */}
            <AIBrains />

            {/* Survival Tip */}
            <AnimatePresence>
              {survivalTip && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-blue-500/30 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h4 className="text-blue-400 font-bold text-sm mb-1">SURVIVAL TIP</h4>
                      <p className="text-gray-200">{survivalTip}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Game Log */}
            <GameLog />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Player Stats */}
            <PlayerStats />

            {/* Pump.fun Style Chat */}
            <PumpChat />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Claude Survival Game - Watch AI try to survive in a hostile world</p>
          <p className="text-xs mt-1">Powered by dual AI: THE FOREST (God) vs CLAUDE (Survivor)</p>
        </div>
      </footer>
    </div>
  );
}

// Helper functions
function getItemIcon(item: string): string {
  const icons: Record<string, string> = {
    wood: '🪵',
    berries: '🫐',
    water: '💧',
    meat: '🥩',
    fish: '🐟',
    stone: '🪨',
    tool: '🔨',
    spear: '🗡️',
    stick: '🪵',
  };
  return icons[item] || '📦';
}

function getItemType(item: string): 'resource' | 'tool' | 'food' | 'weapon' {
  const types: Record<string, 'resource' | 'tool' | 'food' | 'weapon'> = {
    wood: 'resource',
    stone: 'resource',
    stick: 'resource',
    berries: 'food',
    meat: 'food',
    fish: 'food',
    water: 'food',
    tool: 'tool',
    spear: 'weapon',
  };
  return types[item] || 'resource';
}
