'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';
import { PixelGameWorld } from './PixelGameWorld';
import { PlayerStats } from './PlayerStats';
import { GameLog } from './GameLog';
import { AIBrains } from './AIBrain';
import { PumpChat } from './PumpChat';
import { TeachingPanel } from './TeachingPanel';
import { TokenInfo } from './TokenInfo';

// Token config - set these in Vercel Environment Variables
// NEXT_PUBLIC_CONTRACT_ADDRESS - your Pump.fun CA
// NEXT_PUBLIC_TOKEN_SYMBOL - your token symbol
// NEXT_PUBLIC_TWITTER_URL - your Twitter/X link
// NEXT_PUBLIC_TELEGRAM_URL - your Telegram link
const TOKEN_CONFIG = {
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'DEPLOYING...',
  tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL || '$CLAUDE',
  twitterUrl: process.env.NEXT_PUBLIC_TWITTER_URL || '#',
  telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_URL || '#',
};

// Background music
const MUSIC_TRACKS = [
  'https://assets.mixkit.co/music/preview/mixkit-forest-treasure-140.mp3',
];

export function SurvivalGame() {
  const {
    isPlaying,
    isConnected,
    isConnecting,
    connectionError,
    playerStats,
    worldState,
    gameEvents,
    currentAction,
    currentPhase,
    viewerCount,
    connect,
  } = useSurvivalStore();

  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasConnected = useRef(false);

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

  // Connect to shared game on mount
  useEffect(() => {
    if (!hasConnected.current) {
      hasConnected.current = true;
      connect();
    }
  }, [connect]);

  // Get phase display text
  const getPhaseText = () => {
    switch (currentPhase) {
      case 'god_thinking': return '👁️ GOD is watching...';
      case 'god_speaking': return '👁️ GOD speaks!';
      case 'survivor_thinking': return '🤔 Claude is thinking...';
      case 'survivor_speaking': return '🎯 Claude acts!';
      default: return '⏳ Waiting...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500">
      {/* Animated background */}
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg ${
                  isConnected
                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                    : 'bg-gray-400'
                }`}
                animate={{ scale: isConnected ? [1, 1.05, 1] : 1 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.div
                  className="w-3 h-3 bg-white rounded-full"
                  animate={{ opacity: isConnected ? [1, 0.5, 1] : 0.5 }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className="text-white font-black text-sm">
                  {isConnecting ? 'CONNECTING...' : isConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </motion.div>

              {/* Phase indicator */}
              {isConnected && (
                <motion.div
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-black/80 text-white rounded-xl font-bold text-sm"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {getPhaseText()}
                </motion.div>
              )}

              {/* Viewer count */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-700 rounded-xl font-bold text-sm">
                👥 {viewerCount} watching
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

      {/* Connection error banner */}
      {connectionError && (
        <div className="bg-red-500 text-white text-center py-2 font-bold">
          {connectionError}
        </div>
      )}

      {/* Main content */}
      <main className="relative max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Main game area */}
          <div className="lg:col-span-3 space-y-5">
            <PixelGameWorld />
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
