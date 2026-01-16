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
import { TokenInfo } from './TokenInfo';

// Configure your token here
const TOKEN_CONFIG = {
  contractAddress: 'YOUR_CONTRACT_ADDRESS_HERE', // Replace with your actual CA
  tokenSymbol: '$CLAUDE',
  twitterUrl: '#', // Replace with your Twitter URL
  telegramUrl: '#', // Replace with your Telegram URL
};

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
  const [showHero, setShowHero] = useState(true);
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
    setShowHero(false);
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
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-300/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-400/40 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], y: [0, 50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 right-1/3 w-96 h-96 bg-emerald-400/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity }}
        />
        {/* Floating tokens */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -30, 0],
              rotate: [0, 360],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          >
            {['🌲', '💎', '🚀', '⛽', '🌙', '🔥', '💰', '🎮'][i]}
          </motion.div>
        ))}
      </div>

      {/* Hero Section */}
      <AnimatePresence>
        {showHero && !isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            className="relative py-16 px-4"
          >
            <div className="max-w-6xl mx-auto text-center">
              {/* Logo */}
              <motion.div
                className="flex items-center justify-center gap-6 mb-8"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <motion.span
                  className="text-8xl filter drop-shadow-2xl"
                  animate={{
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  🌲
                </motion.span>
                <div>
                  <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-2xl">
                    CLAUDE
                  </h1>
                  <h2 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 bg-clip-text text-transparent">
                    SURVIVAL
                  </h2>
                </div>
                <motion.span
                  className="text-8xl filter drop-shadow-2xl"
                  animate={{
                    rotate: [0, -5, 5, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                >
                  🤖
                </motion.span>
              </motion.div>

              {/* Tagline */}
              <motion.p
                className="text-2xl md:text-3xl font-bold text-white/90 mb-12 max-w-3xl mx-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Watch AI fight for survival in a hostile forest!
                <span className="block mt-2 text-yellow-200">
                  THE FOREST vs CLAUDE - Who will win? 🔥
                </span>
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <motion.button
                  onClick={handleStart}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative px-12 py-6 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white font-black text-2xl rounded-3xl shadow-2xl shadow-orange-500/50 hover:shadow-orange-400/70 transition-all overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  <span className="relative flex items-center gap-4">
                    <motion.span
                      className="text-3xl"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      🎮
                    </motion.span>
                    PLAY NOW
                    <motion.span
                      className="text-3xl"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                    >
                      🚀
                    </motion.span>
                  </span>
                </motion.button>

                <motion.a
                  href={`https://pump.fun/coin/${TOKEN_CONFIG.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-12 py-6 bg-white/20 backdrop-blur-xl text-white font-black text-2xl rounded-3xl border-4 border-white/40 hover:bg-white/30 transition-all shadow-2xl flex items-center gap-4"
                >
                  <span className="text-3xl">⛽</span>
                  BUY {TOKEN_CONFIG.tokenSymbol}
                </motion.a>
              </motion.div>

              {/* Token Stats Preview */}
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {[
                  { label: 'LIVE VIEWERS', value: '1.2K+', icon: '👁' },
                  { label: 'GAMES PLAYED', value: '5K+', icon: '🎮' },
                  { label: 'TOKEN HOLDERS', value: '500+', icon: '💎' },
                  { label: 'COMMUNITY', value: 'BASED', icon: '🔥' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="bg-white/20 backdrop-blur-xl rounded-2xl p-4 border-2 border-white/30"
                  >
                    <span className="text-3xl">{stat.icon}</span>
                    <p className="text-2xl font-black text-white mt-2">{stat.value}</p>
                    <p className="text-sm font-bold text-white/70">{stat.label}</p>
                  </motion.div>
                ))}
              </motion.div>

              {/* Social Links */}
              <motion.div
                className="flex items-center justify-center gap-4 mt-8"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <motion.a
                  href={TOKEN_CONFIG.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl border-2 border-white/30 hover:bg-white/30 transition-all"
                >
                  𝕏
                </motion.a>
                <motion.a
                  href={TOKEN_CONFIG.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl border-2 border-white/30 hover:bg-white/30 transition-all"
                >
                  ✈️
                </motion.a>
                <motion.a
                  href={`https://pump.fun/coin/${TOKEN_CONFIG.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-2xl border-2 border-white/30 hover:bg-white/30 transition-all"
                >
                  ⛽
                </motion.a>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Sticky when game is active */}
      <header className={`relative bg-white/95 backdrop-blur-xl border-b-4 border-lime-500 ${isPlaying ? 'sticky top-0' : ''} z-50 shadow-xl`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-4 cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => !isPlaying && setShowHero(true)}
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
                    className="absolute -inset-4 bg-lime-400/50 rounded-full blur-xl -z-10"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-black bg-gradient-to-r from-lime-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent drop-shadow-sm">
                    CLAUDE SURVIVAL
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-lime-600">{TOKEN_CONFIG.tokenSymbol}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm font-bold text-gray-500">on Pump.fun ⛽</span>
                  </div>
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
                  className="group relative px-10 py-4 bg-gradient-to-r from-lime-500 via-emerald-500 to-teal-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-lime-500/50 hover:shadow-lime-400/70 transition-all overflow-hidden"
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
                        ? 'bg-gradient-to-r from-lime-500 to-emerald-500 text-white shadow-lime-500/40'
                        : 'bg-white text-gray-700 border-3 border-lime-400 hover:bg-lime-50'
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
                    onClick={() => { endGame(); resetGame(); setShowHero(true); }}
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
      <footer className="relative bg-white/95 backdrop-blur-xl border-t-4 border-lime-500 py-8 mt-12">
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
                <p className="font-black text-2xl bg-gradient-to-r from-lime-600 to-emerald-600 bg-clip-text text-transparent">
                  Claude Survival
                </p>
                <p className="font-semibold text-gray-500">{TOKEN_CONFIG.tokenSymbol} on Pump.fun ⛽</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <motion.a
                href={TOKEN_CONFIG.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"
              >
                𝕏
              </motion.a>
              <motion.a
                href={TOKEN_CONFIG.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"
              >
                ✈️
              </motion.a>
              <motion.a
                href={`https://pump.fun/coin/${TOKEN_CONFIG.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="w-12 h-12 bg-gradient-to-r from-lime-400 to-emerald-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"
              >
                ⛽
              </motion.a>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50" />
              <span className="font-bold text-gray-600">FOREST</span>
              <span className="text-2xl mx-2">⚔️</span>
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/50" />
              <span className="font-bold text-gray-600">CLAUDE</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t-2 border-gray-200 text-center">
            <p className="text-gray-500 font-medium">
              ⚡ Powered by AI • Built for degens • DYOR NFA 🚀
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
