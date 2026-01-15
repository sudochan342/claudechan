'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

const timeColors = {
  dawn: 'from-orange-400/30 via-pink-300/20 to-purple-400/30',
  day: 'from-sky-400/30 via-yellow-200/20 to-sky-300/30',
  dusk: 'from-orange-500/30 via-red-400/30 to-purple-500/30',
  night: 'from-indigo-900/50 via-purple-900/40 to-slate-900/50',
};

const weatherEffects = {
  clear: null,
  cloudy: '☁️',
  rain: '🌧️',
  storm: '⛈️',
};

export function GameWorld() {
  const { worldState, currentAction, isPlaying, playerStats } = useSurvivalStore();

  const isNight = worldState.timeOfDay === 'night';
  const isDusk = worldState.timeOfDay === 'dusk';

  return (
    <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-700/50">
      {/* Sky gradient based on time of day */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-b ${timeColors[worldState.timeOfDay]} transition-all duration-1000`}
        animate={{
          opacity: isPlaying ? 1 : 0.5,
        }}
      />

      {/* Stars at night */}
      {isNight && (
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 50}%`,
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}

      {/* Moon at night */}
      {isNight && (
        <motion.div
          className="absolute top-4 right-8 w-12 h-12 rounded-full bg-gray-200"
          style={{
            boxShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
          }}
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
        />
      )}

      {/* Sun during day/dawn/dusk */}
      {!isNight && (
        <motion.div
          className="absolute w-16 h-16 rounded-full"
          style={{
            background: worldState.timeOfDay === 'dawn' ? '#fbbf24' : worldState.timeOfDay === 'dusk' ? '#f97316' : '#facc15',
            boxShadow: `0 0 60px ${worldState.timeOfDay === 'dusk' ? 'rgba(249, 115, 22, 0.6)' : 'rgba(250, 204, 21, 0.6)'}`,
            top: worldState.timeOfDay === 'dawn' ? '60%' : worldState.timeOfDay === 'day' ? '10%' : '65%',
            left: worldState.timeOfDay === 'dawn' ? '10%' : worldState.timeOfDay === 'day' ? '50%' : '80%',
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
        />
      )}

      {/* Forest treeline */}
      <div className="absolute bottom-0 left-0 right-0 h-32">
        {/* Background trees */}
        <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
          <path
            d="M0,40 L0,25 L5,15 L10,25 L15,12 L20,25 L25,18 L30,25 L35,10 L40,25 L45,15 L50,25 L55,8 L60,25 L65,14 L70,25 L75,12 L80,25 L85,18 L90,25 L95,15 L100,25 L100,40 Z"
            fill={isNight ? '#1a2e1a' : isDusk ? '#2d4a2d' : '#1e4620'}
            className="transition-colors duration-1000"
          />
        </svg>

        {/* Foreground trees */}
        <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
          <path
            d="M0,40 L0,30 L8,18 L16,30 L24,14 L32,30 L40,20 L48,30 L56,12 L64,30 L72,16 L80,30 L88,18 L96,30 L100,28 L100,40 Z"
            fill={isNight ? '#0f1f0f' : isDusk ? '#1a3a1a' : '#15521a'}
            className="transition-colors duration-1000"
          />
        </svg>
      </div>

      {/* Ground */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-8 ${isNight ? 'bg-gray-900' : 'bg-green-900/80'} transition-colors duration-1000`}
      />

      {/* Weather overlay */}
      <AnimatePresence>
        {worldState.weather === 'rain' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-4 bg-blue-400/40 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: -20,
                }}
                animate={{
                  top: '120%',
                  opacity: [0.5, 0.8, 0],
                }}
                transition={{
                  duration: 0.8 + Math.random() * 0.4,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </motion.div>
        )}

        {worldState.weather === 'storm' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Heavy rain */}
            {[...Array(80)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-6 bg-blue-300/50 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: -20,
                }}
                animate={{
                  top: '120%',
                  opacity: [0.6, 0.9, 0],
                }}
                transition={{
                  duration: 0.5 + Math.random() * 0.3,
                  repeat: Infinity,
                  delay: Math.random() * 1.5,
                }}
              />
            ))}
            {/* Lightning flash */}
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{
                opacity: [0, 0, 1, 0, 0, 0, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatDelay: Math.random() * 3,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claude character */}
      <motion.div
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        animate={{
          y: currentAction ? [0, -5, 0] : 0,
        }}
        transition={{
          duration: 0.5,
          repeat: currentAction ? Infinity : 0,
        }}
      >
        <div className="relative">
          {/* Character glow based on health */}
          <motion.div
            className="absolute -inset-4 rounded-full blur-xl"
            style={{
              background: playerStats.health > 50
                ? 'rgba(34, 197, 94, 0.4)'
                : playerStats.health > 25
                  ? 'rgba(234, 179, 8, 0.4)'
                  : 'rgba(239, 68, 68, 0.4)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
          <span className="text-5xl relative z-10">🧑</span>
        </div>
      </motion.div>

      {/* Threats visualization */}
      <AnimatePresence>
        {worldState.threats.map((threat, i) => (
          <motion.div
            key={threat + i}
            className="absolute bottom-12"
            style={{
              left: `${20 + i * 15}%`,
            }}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
          >
            <motion.span
              className="text-4xl"
              animate={{
                y: [0, -3, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            >
              {threat === 'Wolf' ? '🐺' : threat === 'Bear' ? '🐻' : threat === 'Snake' ? '🐍' : '👹'}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Location label */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-600/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">📍</span>
          <span className="text-white font-medium">{worldState.currentLocation}</span>
        </div>
      </div>

      {/* Weather & Temperature */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-600/50">
        <div className="flex items-center gap-3">
          <span className="text-lg">{weatherEffects[worldState.weather] || '☀️'}</span>
          <span className={`font-mono ${worldState.temperature < 10 ? 'text-blue-400' : worldState.temperature > 30 ? 'text-red-400' : 'text-green-400'}`}>
            {worldState.temperature}°C
          </span>
        </div>
      </div>

      {/* Day counter */}
      <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-600/50">
        <span className="text-white font-medium">Day {worldState.daysSurvived + 1}</span>
      </div>

      {/* Current action indicator */}
      <AnimatePresence>
        {currentAction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600/80 backdrop-blur-sm px-4 py-2 rounded-lg"
          >
            <span className="text-white font-medium">{currentAction}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
