'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

interface AIBrainPanelProps {
  type: 'god' | 'survivor';
}

export function AIBrainPanel({ type }: AIBrainPanelProps) {
  const { godThoughts, survivorThoughts, isPlaying } = useSurvivalStore();

  const isGod = type === 'god';
  const thoughts = isGod ? godThoughts : survivorThoughts;

  const config = {
    god: {
      name: 'THE FOREST',
      icon: '🌲',
      subtitle: 'World Controller',
      color: 'red',
      bgGradient: 'from-red-900/40 to-red-950/60',
      borderColor: 'border-red-500/30',
      glowColor: 'rgba(239, 68, 68, 0.3)',
      textColor: 'text-red-400',
      activeLabel: 'Plotting...',
    },
    survivor: {
      name: 'CLAUDE',
      icon: '🧑',
      subtitle: 'Survivor AI',
      color: 'green',
      bgGradient: 'from-green-900/40 to-green-950/60',
      borderColor: 'border-green-500/30',
      glowColor: 'rgba(34, 197, 94, 0.3)',
      textColor: 'text-green-400',
      activeLabel: 'Thinking...',
    },
  };

  const c = config[type];

  return (
    <motion.div
      className={`relative bg-gradient-to-br ${c.bgGradient} rounded-2xl border ${c.borderColor} overflow-hidden`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${c.glowColor}, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: thoughts ? [0.5, 0.7, 0.5] : 0.3,
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.div
              className="relative"
              animate={{
                rotate: isGod && thoughts ? [0, 5, -5, 0] : 0,
              }}
              transition={{
                duration: 2,
                repeat: thoughts ? Infinity : 0,
              }}
            >
              <span className="text-3xl">{c.icon}</span>
              <motion.div
                className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full ${thoughts ? 'bg-yellow-400' : 'bg-gray-600'}`}
                animate={thoughts ? {
                  scale: [1, 1.3, 1],
                  opacity: [1, 0.7, 1],
                } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </motion.div>
            <div>
              <h3 className={`font-bold ${c.textColor}`}>{c.name}</h3>
              <p className="text-xs text-gray-500">{c.subtitle}</p>
            </div>
          </div>

          <AnimatePresence>
            {thoughts && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex items-center gap-1 px-2 py-1 rounded-full bg-${c.color}-500/20 border border-${c.color}-500/30`}
              >
                <motion.span
                  className={`w-2 h-2 rounded-full bg-${c.color}-400`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className={`text-xs ${c.textColor}`}>{c.activeLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Thought bubble */}
        <div className="min-h-[80px] bg-black/30 rounded-xl p-3 border border-gray-700/30">
          <AnimatePresence mode="wait">
            {thoughts ? (
              <motion.div
                key="thoughts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2"
              >
                <span className="text-gray-400 text-lg">💭</span>
                <p className="text-sm text-gray-200 italic leading-relaxed">{thoughts}</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full"
              >
                <p className="text-gray-500 text-sm italic">
                  {isPlaying
                    ? isGod
                      ? 'The forest watches silently...'
                      : 'Awaiting the next challenge...'
                    : 'Waiting for game to begin...'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Neural activity visualization */}
        <div className="mt-3 flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-2">Neural Activity:</span>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className={`w-2 rounded-full ${thoughts ? `bg-${c.color}-500` : 'bg-gray-700'}`}
              animate={{
                height: thoughts ? [8, 16 + Math.random() * 8, 8] : 8,
                opacity: thoughts ? [0.5, 1, 0.5] : 0.3,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1,
              }}
              style={{ height: 8 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function AIBrains() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AIBrainPanel type="god" />
      <AIBrainPanel type="survivor" />
    </div>
  );
}
