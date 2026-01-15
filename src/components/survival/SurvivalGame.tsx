'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';
import { PixiGameWorld } from './PixiGameWorld';
import { PlayerStats } from './PlayerStats';
import { GameLog } from './GameLog';
import { AIBrains } from './AIBrain';
import { PumpChat } from './PumpChat';
import { TeachingPanel } from './TeachingPanel';

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
    userAdvice,
    getActiveAdvice,
    markAdviceApplied,
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
      // Get active advice to send to AI
      const activeAdvice = getActiveAdvice();

      const response = await fetch('/api/survival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldState,
          playerStats,
          inventory,
          recentEvents: gameEvents.slice(-5).map(e => e.content),
          turnNumber,
          userAdvice: activeAdvice.map(a => ({ advice: a.advice })),
        }),
      });

      // Mark advice as applied after sending
      activeAdvice.forEach(a => markAdviceApplied(a.id));

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
    getActiveAdvice,
    markAdviceApplied,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="relative">
                  <motion.span
                    className="text-3xl"
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    🌲
                  </motion.span>
                  <motion.div
                    className="absolute -inset-2 bg-green-500/20 rounded-full blur-md"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    CLAUDE SURVIVAL
                  </h1>
                  <p className="text-xs text-gray-500 font-medium -mt-0.5">The Forest vs Claude</p>
                </div>
              </motion.div>
              <div className="hidden md:flex items-center gap-2 ml-4">
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-bold text-purple-300">
                  GOD AI
                </span>
                <span className="text-gray-600">vs</span>
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-bold text-blue-300">
                  SURVIVOR AI
                </span>
                {isPlaying && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 ml-2 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full"
                  >
                    <motion.span
                      className="w-2 h-2 bg-red-500 rounded-full"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-xs font-bold text-red-400">LIVE</span>
                  </motion.span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isPlaying ? (
                <motion.button
                  onClick={handleStart}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 opacity-0 group-hover:opacity-20 transition-opacity"
                  />
                  <span className="relative flex items-center gap-2">
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      ▶️
                    </motion.span>
                    START GAME
                  </span>
                </motion.button>
              ) : (
                <>
                  <motion.button
                    onClick={isPaused ? resumeGame : pauseGame}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                      isPaused
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </motion.button>

                  <div className="flex items-center gap-1 bg-gray-800/80 rounded-xl p-1 border border-gray-700/50">
                    {[1, 2, 3].map((speed) => (
                      <motion.button
                        key={speed}
                        onClick={() => setGameSpeed(speed as 1 | 2 | 3)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          gameSpeed === speed
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
                    className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 rounded-xl font-medium transition-all"
                  >
                    ⏹️ End
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

            {/* Teaching Panel */}
            <TeachingPanel />

            {/* Pump.fun Style Chat */}
            <PumpChat />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-6 mt-12 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌲</span>
              <div>
                <p className="font-bold text-white">Claude Survival Game</p>
                <p className="text-xs text-gray-500">A dual AI experiment in survival</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>THE FOREST (God AI)</span>
              </div>
              <span className="text-gray-700">vs</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>CLAUDE (Survivor AI)</span>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              Powered by OpenRouter AI
            </div>
          </div>
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
