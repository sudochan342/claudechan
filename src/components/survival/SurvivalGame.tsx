'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';
import { PixiGameWorld } from './PixiGameWorld';
import { PlayerStats } from './PlayerStats';
import { GameLog } from './GameLog';
import { AIBrains } from './AIBrain';
import { PumpChat } from './PumpChat';
import { TeachingPanel } from './TeachingPanel';
import { TokenInfo } from './TokenInfo';

// Configure your token here
const TOKEN_CONFIG = {
  contractAddress: 'YOUR_CONTRACT_ADDRESS_HERE', // Replace with your actual CA
  tokenSymbol: '$CLAUDE',
  twitterUrl: '#',
  telegramUrl: '#',
};

// Background music URLs (royalty free)
const MUSIC_TRACKS = [
  'https://assets.mixkit.co/music/preview/mixkit-forest-treasure-140.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
];

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
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const turnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoStarted = useRef(false);

  // Initialize audio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(MUSIC_TRACKS[0]);
      audioRef.current.loop = true;
      audioRef.current.volume = musicVolume;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle music toggle
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
      if (musicEnabled) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [musicEnabled, musicVolume]);

  // Auto-start game on mount
  useEffect(() => {
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setTimeout(() => {
        resetGame();
        startGame();
        addGameEvent({
          source: 'system',
          type: 'environmental',
          content: '🌅 LIVE on Pump.fun! Claude begins survival...',
          emoji: '🌅'
        });
        addChatMessage({
          username: 'System',
          message: '🎮 LIVE! Watch Claude survive in the forest!',
          color: '#4caf50'
        });
      }, 500);
    }
  }, [resetGame, startGame, addGameEvent, addChatMessage]);

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
                case 'god_thought':
                  setGodThoughts(data.content);
                  break;
                case 'world_event':
                  addGameEvent({ source: 'god', type: 'environmental', content: data.content, emoji: '⚡' });
                  break;
                case 'world_state_change':
                  if (data.changes) updateWorldState(data.changes);
                  break;
                case 'player_stat_change':
                  if (data.changes) updatePlayerStats(data.changes);
                  break;
                case 'threat_spawned':
                  updateWorldState({ threats: [...worldState.threats, data.threat] });
                  addGameEvent({ source: 'god', type: 'danger', content: `⚠️ ${data.threat} appeared!`, emoji: '⚠️' });
                  break;
                case 'survivor_thought':
                  setSurvivorThoughts(data.content);
                  break;
                case 'survivor_action':
                  setCurrentAction(data.action);
                  addGameEvent({ source: 'survivor', type: 'action', content: `🎯 ${data.description}`, emoji: '🎯' });
                  break;
                case 'action_result':
                  if (data.statChanges) updatePlayerStats(data.statChanges);
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
                  addGameEvent({ source: 'system', type: data.success ? 'success' : 'failure', content: data.message, emoji: data.success ? '✅' : '❌' });
                  break;
                case 'turn_complete':
                  setTurnNumber(data.turnNumber);
                  setCurrentAction('');
                  if (data.turnNumber % 4 === 0) progressTime();
                  break;
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      // Check death - auto restart
      if (playerStats.health <= 0) {
        addGameEvent({ source: 'system', type: 'failure', content: `💀 Claude survived ${worldState.daysSurvived} days. Restarting...`, emoji: '💀' });
        addChatMessage({ username: 'System', message: `💀 RIP! Claude survived ${worldState.daysSurvived} days! Restarting...`, color: '#f44336' });

        // Auto restart after death
        setTimeout(() => {
          resetGame();
          startGame();
          addGameEvent({ source: 'system', type: 'environmental', content: '🌅 New run begins!', emoji: '🌅' });
        }, 3000);
      }

    } catch (error) {
      console.error('Turn error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isPlaying, isPaused, isProcessing, worldState, playerStats, inventory, gameEvents, turnNumber, updateWorldState, updatePlayerStats, addGameEvent, setGodThoughts, setSurvivorThoughts, setCurrentAction, addInventoryItem, addChatMessage, getActiveAdvice, markAdviceApplied, resetGame, startGame]);

  const progressTime = useCallback(() => {
    const times: Array<'dawn' | 'day' | 'dusk' | 'night'> = ['dawn', 'day', 'dusk', 'night'];
    const currentIndex = times.indexOf(worldState.timeOfDay);
    const nextIndex = (currentIndex + 1) % times.length;
    updateWorldState({
      timeOfDay: times[nextIndex],
      daysSurvived: nextIndex === 0 ? worldState.daysSurvived + 1 : worldState.daysSurvived,
    });
  }, [worldState.timeOfDay, worldState.daysSurvived, updateWorldState]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !isPaused) {
      const interval = 8000 / gameSpeed;
      turnIntervalRef.current = setInterval(processTurn, interval);
      // First turn
      setTimeout(processTurn, 1000);
    }
    return () => {
      if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
    };
  }, [isPlaying, isPaused, gameSpeed, processTurn]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500">
      {/* Simple animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative bg-white/95 backdrop-blur-xl border-b-4 border-lime-500 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <motion.div
                  className="text-4xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🌲
                </motion.div>
                <div>
                  <h1 className="text-2xl font-black bg-gradient-to-r from-lime-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    CLAUDE SURVIVAL
                  </h1>
                  <p className="text-xs font-bold text-gray-500">{TOKEN_CONFIG.tokenSymbol} • LIVE on Pump.fun ⛽</p>
                </div>
              </motion.div>

              {/* LIVE indicator */}
              <motion.div
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.div
                  className="w-3 h-3 bg-white rounded-full"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className="text-white font-black text-sm">LIVE</span>
              </motion.div>

              {/* VS Badge */}
              <div className="hidden md:flex items-center gap-2">
                <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm">
                  🌲 FOREST
                </div>
                <span className="text-xl">⚔️</span>
                <div className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold text-sm">
                  🤖 CLAUDE
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Music Toggle */}
              <motion.button
                onClick={() => setMusicEnabled(!musicEnabled)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  musicEnabled
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {musicEnabled ? '🎵 ON' : '🔇 OFF'}
              </motion.button>

              {/* Volume slider when music is on */}
              {musicEnabled && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              )}

              {/* Speed controls */}
              <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-md border-2 border-gray-100">
                {[1, 2, 3].map((speed) => (
                  <motion.button
                    key={speed}
                    onClick={() => setGameSpeed(speed as 1 | 2 | 3)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all ${
                      gameSpeed === speed
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {speed}x
                  </motion.button>
                ))}
              </div>

              {/* Pause/Play */}
              <motion.button
                onClick={isPaused ? resumeGame : pauseGame}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-5 py-2 rounded-xl font-bold text-sm ${
                  isPaused
                    ? 'bg-gradient-to-r from-lime-500 to-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isPaused ? '▶️ Play' : '⏸️ Pause'}
              </motion.button>

              {/* Social Links */}
              <div className="hidden sm:flex items-center gap-2">
                <motion.a
                  href={TOKEN_CONFIG.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-9 h-9 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-md"
                >
                  𝕏
                </motion.a>
                <motion.a
                  href={TOKEN_CONFIG.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-9 h-9 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl flex items-center justify-center text-white shadow-md"
                >
                  ✈️
                </motion.a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Main game area */}
          <div className="lg:col-span-3 space-y-5">
            <PixiGameWorld />
            <AIBrains />
            <GameLog />
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <TokenInfo
              contractAddress={TOKEN_CONFIG.contractAddress}
              tokenSymbol={TOKEN_CONFIG.tokenSymbol}
            />
            <PlayerStats />
            <TeachingPanel />
            <PumpChat contractAddress={TOKEN_CONFIG.contractAddress} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative bg-white/95 backdrop-blur-xl border-t-4 border-lime-500 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🌲</span>
              <div>
                <p className="font-black text-xl bg-gradient-to-r from-lime-600 to-emerald-600 bg-clip-text text-transparent">
                  Claude Survival
                </p>
                <p className="font-semibold text-gray-500 text-sm">{TOKEN_CONFIG.tokenSymbol} on Pump.fun ⛽</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.a
                href={TOKEN_CONFIG.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg"
              >
                𝕏
              </motion.a>
              <motion.a
                href={TOKEN_CONFIG.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl flex items-center justify-center text-white shadow-lg"
              >
                ✈️
              </motion.a>
              <motion.a
                href={`https://pump.fun/coin/${TOKEN_CONFIG.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 bg-gradient-to-r from-lime-400 to-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg"
              >
                ⛽
              </motion.a>
            </div>

            <p className="text-gray-500 font-medium text-sm">
              ⚡ Powered by AI • DYOR NFA 🚀
            </p>
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
