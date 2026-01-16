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
    worldState,
    inventory,
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
    getActiveAdvice,
    markAdviceApplied,
  } = useSurvivalStore();

  const [turnNumber, setTurnNumber] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [survivalTip, setSurvivalTip] = useState<string | null>(null);
  const turnIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const processTurn = useCallback(async () => {
    if (!isPlaying || isPaused || isProcessing) return;

    setIsProcessing(true);

    try {
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

      activeAdvice.forEach(a => markAdviceApplied(a.id));

      if (!response.ok) throw new Error('Game API error');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'phase':
                  if (data.phase === 'god_thinking') {
                    addGameEvent({
                      source: 'system',
                      type: 'environmental',
                      content: '🌲 The forest awakens...',
                      emoji: '🌲'
                    });
                  }
                  break;

                case 'god_thought':
                  setGodThoughts(data.content);
                  break;

                case 'world_event':
                  addGameEvent({
                    source: 'god',
                    type: 'environmental',
                    content: data.content,
                    emoji: '⚡'
                  });
                  break;

                case 'world_state_change':
                  if (data.changes) {
                    updateWorldState(data.changes);
                  }
                  break;

                case 'player_stat_change':
                  if (data.changes) {
                    updatePlayerStats(data.changes);
                  }
                  break;

                case 'threat_spawned':
                  updateWorldState({
                    threats: [...worldState.threats, data.threat]
                  });
                  addGameEvent({
                    source: 'god',
                    type: 'danger',
                    content: `⚠️ ${data.threat} appeared!`,
                    emoji: '⚠️'
                  });
                  break;

                case 'survivor_thought':
                  setSurvivorThoughts(data.content);
                  break;

                case 'survivor_action':
                  setCurrentAction(data.action);
                  addGameEvent({
                    source: 'survivor',
                    type: 'action',
                    content: `🎯 ${data.description}`,
                    emoji: '🎯'
                  });
                  break;

                case 'survival_tip':
                  setSurvivalTip(data.tip);
                  setTimeout(() => setSurvivalTip(null), 8000);
                  break;

                case 'action_result':
                  if (data.statChanges) {
                    updatePlayerStats(data.statChanges);
                  }
                  if (data.inventoryChanges?.add) {
                    data.inventoryChanges.add.forEach((item: string) => {
                      addInventoryItem({
                        id: item,
                        name: item.charAt(0).toUpperCase() + item.slice(1),
                        quantity: 1,
                        icon: getItemIcon(item),
                        type: getItemType(item),
                      });
                    });
                  }
                  addGameEvent({
                    source: 'system',
                    type: data.success ? 'success' : 'failure',
                    content: data.message,
                    emoji: data.success ? '✅' : '❌'
                  });
                  break;

                case 'turn_complete':
                  setTurnNumber(data.turnNumber);
                  setCurrentAction('');
                  if (data.turnNumber % 4 === 0) {
                    progressTime();
                  }
                  break;

                case 'error':
                  addGameEvent({
                    source: 'system',
                    type: 'failure',
                    content: data.message,
                    emoji: '❌'
                  });
                  break;
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      if (playerStats.health <= 0) {
        endGame();
        addGameEvent({
          source: 'system',
          type: 'failure',
          content: `💀 Claude survived ${worldState.daysSurvived} days. Game Over!`,
          emoji: '💀'
        });
        addChatMessage({
          username: 'System',
          message: `Game Over! Claude survived ${worldState.daysSurvived} days!`,
          color: '#f44336'
        });
      }

    } catch (error) {
      console.error('Turn error:', error);
      addGameEvent({
        source: 'system',
        type: 'failure',
        content: 'Connection lost... Reconnecting...',
        emoji: '🔄'
      });
    } finally {
      setIsProcessing(false);
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
    updateWorldState,
    updatePlayerStats,
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

  const progressTime = useCallback(() => {
    const times: Array<'dawn' | 'day' | 'dusk' | 'night'> = ['dawn', 'day', 'dusk', 'night'];
    const currentIndex = times.indexOf(worldState.timeOfDay);
    const nextIndex = (currentIndex + 1) % times.length;

    updateWorldState({
      timeOfDay: times[nextIndex],
      daysSurvived: nextIndex === 0 ? worldState.daysSurvived + 1 : worldState.daysSurvived,
    });
  }, [worldState.timeOfDay, worldState.daysSurvived, updateWorldState]);

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const interval = 8000 / gameSpeed;
      turnIntervalRef.current = setInterval(processTurn, interval);
    }

    return () => {
      if (turnIntervalRef.current) {
        clearInterval(turnIntervalRef.current);
      }
    };
  }, [isPlaying, isPaused, gameSpeed, processTurn]);

  const handleStart = () => {
    resetGame();
    startGame();
    addGameEvent({
      source: 'system',
      type: 'environmental',
      content: '🌅 A new adventure begins! Good luck, Claude!',
      emoji: '🌅'
    });
    addChatMessage({
      username: 'System',
      message: '🎮 Game Started! Let the adventure begin!',
      color: '#4caf50'
    });
    setTimeout(processTurn, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-300/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 -left-40 w-80 h-80 bg-pink-400/40 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], y: [0, 50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 right-1/3 w-96 h-96 bg-purple-400/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity }}
        />
      </div>

      {/* Header */}
      <header className="relative bg-white/95 backdrop-blur-xl border-b-4 border-emerald-500 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="relative">
                  <motion.div
                    className="text-5xl"
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    🌲
                  </motion.div>
                  <motion.div
                    className="absolute -inset-4 bg-emerald-400/50 rounded-full blur-xl -z-10"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
                    CLAUDE SURVIVAL
                  </h1>
                  <p className="text-sm font-bold text-emerald-600">The Ultimate AI Adventure 🎮</p>
                </div>
              </motion.div>

              <div className="hidden lg:flex items-center gap-3 ml-8">
                <motion.div
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/40"
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  🌲 THE FOREST
                </motion.div>
                <motion.span
                  className="text-3xl"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ⚔️
                </motion.span>
                <motion.div
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-cyan-500/40"
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  🤖 CLAUDE
                </motion.div>

                {isPlaying && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 ml-4 px-5 py-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-lg shadow-red-500/40"
                  >
                    <motion.span
                      className="w-3 h-3 bg-white rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    <span className="text-white font-black">LIVE</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isPlaying ? (
                <motion.button
                  onClick={handleStart}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative px-10 py-4 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-emerald-500/50 hover:shadow-emerald-400/70 transition-all overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  <span className="relative flex items-center gap-3">
                    <motion.span
                      className="text-2xl"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ▶️
                    </motion.span>
                    START ADVENTURE
                  </span>
                </motion.button>
              ) : (
                <>
                  <motion.button
                    onClick={isPaused ? resumeGame : pauseGame}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg ${
                      isPaused
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/40'
                        : 'bg-white text-gray-700 border-3 border-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    {isPaused ? '▶️ Play' : '⏸️ Pause'}
                  </motion.button>

                  <div className="flex items-center gap-1 bg-white rounded-2xl p-2 shadow-lg border-2 border-gray-100">
                    {[1, 2, 3].map((speed) => (
                      <motion.button
                        key={speed}
                        onClick={() => setGameSpeed(speed as 1 | 2 | 3)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
                          gameSpeed === speed
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {speed}x
                      </motion.button>
                    ))}
                  </div>

                  <motion.button
                    onClick={() => { endGame(); resetGame(); }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-500/40 hover:shadow-red-500/60 transition-all"
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
      <main className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Survival tip */}
        <AnimatePresence>
          {survivalTip && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="mb-6 p-5 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 rounded-3xl shadow-2xl shadow-amber-500/40 border-4 border-white/50"
            >
              <p className="text-amber-900 font-black text-lg text-center flex items-center justify-center gap-3">
                <motion.span
                  className="text-3xl"
                  animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  💡
                </motion.span>
                <span>{survivalTip}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main game area */}
          <div className="lg:col-span-3 space-y-6">
            <PixiGameWorld />
            <AIBrains />
            <GameLog />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PlayerStats />
            <TeachingPanel />
            <PumpChat />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative bg-white/95 backdrop-blur-xl border-t-4 border-emerald-500 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <motion.span
                className="text-5xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                🌲
              </motion.span>
              <div>
                <p className="font-black text-2xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Claude Survival
                </p>
                <p className="font-semibold text-gray-500">Watch AI learn to survive!</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50" />
                <span className="font-bold text-gray-600">THE FOREST</span>
              </div>
              <span className="text-2xl">⚔️</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/50" />
                <span className="font-bold text-gray-600">CLAUDE</span>
              </div>
            </div>
            <div className="px-5 py-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full">
              <span className="font-bold text-gray-600">⚡ Powered by OpenRouter AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function getItemIcon(item: string): string {
  const icons: Record<string, string> = {
    wood: '🪵', stone: '🪨', berries: '🫐', water: '💧',
    meat: '🥩', fish: '🐟', tool: '🔧', spear: '🔱',
    stick: '🪵', rope: '🪢', shelter: '🏠', fire: '🔥',
  };
  return icons[item] || '📦';
}

function getItemType(item: string): 'resource' | 'tool' | 'food' | 'weapon' {
  const types: Record<string, 'resource' | 'tool' | 'food' | 'weapon'> = {
    wood: 'resource', stone: 'resource', stick: 'resource', rope: 'resource',
    berries: 'food', meat: 'food', fish: 'food', water: 'food',
    tool: 'tool', spear: 'weapon',
  };
  return types[item] || 'resource';
}
