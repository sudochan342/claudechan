'use client';

import { motion } from 'framer-motion';
import { Agent } from '@/lib/agents';

interface OracleOrbProps {
  agent: Agent;
  isActive: boolean;
  isSpeaking: boolean;
}

export default function OracleOrb({ agent, isActive, isSpeaking }: OracleOrbProps) {
  const isLumis = agent.id === 'lumis';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Orb Container */}
      <motion.div
        className="relative w-32 h-32 md:w-40 md:h-40"
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : isActive ? 1.05 : 1,
        }}
        transition={{
          duration: isSpeaking ? 1.5 : 0.3,
          repeat: isSpeaking ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ backgroundColor: agent.glowColor }}
          animate={{
            opacity: isSpeaking ? [0.4, 0.8, 0.4] : isActive ? 0.5 : 0.2,
            scale: isSpeaking ? [1, 1.3, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Inner orb */}
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{
            background: isLumis
              ? 'radial-gradient(circle at 30% 30%, #fef3c7, #fbbf24, #b45309)'
              : 'radial-gradient(circle at 30% 30%, #ddd6fe, #8b5cf6, #4c1d95)',
            boxShadow: `0 0 60px ${agent.glowColor}, inset 0 0 30px rgba(255,255,255,0.3)`,
          }}
          animate={{
            rotate: isLumis ? 360 : -360,
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Core */}
        <motion.div
          className="absolute inset-8 rounded-full"
          style={{
            background: isLumis
              ? 'radial-gradient(circle at 40% 40%, #ffffff, #fef3c7)'
              : 'radial-gradient(circle at 40% 40%, #ffffff, #c4b5fd)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
          }}
          animate={{
            scale: isSpeaking ? [1, 0.9, 1] : 1,
          }}
          transition={{
            duration: 0.8,
            repeat: isSpeaking ? Infinity : 0,
          }}
        />

        {/* Particle effects when speaking */}
        {isSpeaking && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: agent.color,
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, (Math.random() - 0.5) * 100],
                  y: [0, (Math.random() - 0.5) * 100],
                  opacity: [1, 0],
                  scale: [1, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}

        {/* Eye/symbol in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-2xl"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isLumis ? '◉' : '◎'}
          </motion.span>
        </div>
      </motion.div>

      {/* Name and title */}
      <div className="text-center">
        <motion.h3
          className="text-xl font-bold tracking-wider"
          style={{ color: agent.color }}
          animate={{
            textShadow: isSpeaking
              ? [`0 0 10px ${agent.glowColor}`, `0 0 30px ${agent.glowColor}`, `0 0 10px ${agent.glowColor}`]
              : `0 0 10px ${agent.glowColor}`,
          }}
          transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
        >
          {agent.name}
        </motion.h3>
        <p className="text-sm text-gray-400">{agent.title}</p>
        <p className="text-xs text-gray-500 mt-1">{agent.essence}</p>
      </div>
    </div>
  );
}
