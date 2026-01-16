'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

interface AIBrainPanelProps {
  type: 'god' | 'survivor';
}

export function AIBrainPanel({ type }: AIBrainPanelProps) {
  const { gameEvents, currentPhase, isPlaying } = useSurvivalStore();

  const isGod = type === 'god';

  // Get the latest thought for this AI type from game events
  const relevantEvents = gameEvents.filter(e => e.type === type);
  const latestThought = relevantEvents.length > 0
    ? relevantEvents[relevantEvents.length - 1].message
    : null;

  // Check if this AI is currently active
  const isActive = isGod
    ? currentPhase === 'god_thinking' || currentPhase === 'god_speaking'
    : currentPhase === 'survivor_thinking' || currentPhase === 'survivor_speaking';

  const config = {
    god: {
      name: 'THE FOREST',
      icon: '🌲',
      subtitle: 'World Controller AI',
      gradient: 'from-purple-500 via-pink-500 to-rose-500',
      bgGradient: 'from-purple-50 via-pink-50 to-rose-50',
      borderColor: 'border-purple-400',
      textColor: 'text-purple-700',
      glowColor: 'shadow-purple-500/30',
      activeLabel: '🎭 Plotting...',
      idleText: 'The forest watches silently...',
    },
    survivor: {
      name: 'CLAUDE',
      icon: '🤖',
      subtitle: 'Survivor AI',
      gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
      bgGradient: 'from-cyan-50 via-blue-50 to-indigo-50',
      borderColor: 'border-cyan-400',
      textColor: 'text-cyan-700',
      glowColor: 'shadow-cyan-500/30',
      activeLabel: '🧠 Thinking...',
      idleText: 'Awaiting the next challenge...',
    },
  };

  const c = config[type];

  // Clean up the message (remove emoji prefixes like "👁️ GOD: ")
  const displayThought = latestThought
    ?.replace(/^👁️\s*GOD:\s*/i, '')
    ?.replace(/^🧑\s*CLAUDE:\s*/i, '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-gradient-to-br ${c.bgGradient} rounded-3xl border-4 border-white/50 overflow-hidden shadow-2xl ${c.glowColor}`}
    >
      {/* Animated background glow */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${c.gradient} opacity-10`}
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
          opacity: isActive ? [0.1, 0.2, 0.1] : 0.05,
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <motion.div
              className="relative"
              animate={isGod && isActive ? { rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.span
                className="text-5xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {c.icon}
              </motion.span>
              <motion.div
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  isActive ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gray-300'
                }`}
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </motion.div>
            <div>
              <h3 className={`text-xl font-black bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>
                {c.name}
              </h3>
              <p className="text-sm font-semibold text-gray-500">{c.subtitle}</p>
            </div>
          </div>

          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`px-4 py-2 rounded-full bg-gradient-to-r ${c.gradient} shadow-lg`}
              >
                <span className="text-white font-bold text-sm">{c.activeLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Thought bubble */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-gray-100 min-h-[100px] shadow-inner">
          <AnimatePresence mode="wait">
            {displayThought ? (
              <motion.div
                key="thoughts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-3"
              >
                <motion.span
                  className="text-3xl"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  💭
                </motion.span>
                <p className={`text-base font-medium ${c.textColor} italic leading-relaxed`}>{displayThought}</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full py-4"
              >
                <motion.span
                  className="text-4xl mb-2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {isGod ? '🌲' : '🤖'}
                </motion.span>
                <p className="text-gray-400 italic font-medium">
                  {isPlaying ? c.idleText : 'Waiting for game to begin...'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Neural activity */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500">Neural Activity:</span>
          <div className="flex items-end gap-1">
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                className={`w-2 rounded-full bg-gradient-to-t ${c.gradient}`}
                animate={{
                  height: isActive ? [8, 20 + Math.random() * 12, 8] : 8,
                  opacity: isActive ? [0.5, 1, 0.5] : 0.3,
                }}
                transition={{
                  duration: 0.4,
                  repeat: Infinity,
                  delay: i * 0.08,
                }}
                style={{ height: 8 }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AIBrains() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <AIBrainPanel type="god" />
      <AIBrainPanel type="survivor" />
    </div>
  );
}
