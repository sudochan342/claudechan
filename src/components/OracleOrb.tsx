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

  // Generate deterministic particle positions
  const particles = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * 30) * (Math.PI / 180),
    delay: i * 0.15,
    distance: 80 + (i % 3) * 20,
  }));

  const orbitingParticles = Array.from({ length: 8 }, (_, i) => ({
    delay: i * 0.5,
    duration: 3 + (i % 2),
  }));

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Orb Container - Much bigger */}
      <motion.div
        className="relative w-44 h-44 md:w-56 md:h-56 lg:w-64 lg:h-64"
        animate={{
          scale: isSpeaking ? [1, 1.08, 1] : isActive ? 1.03 : 1,
        }}
        transition={{
          duration: isSpeaking ? 2 : 0.5,
          repeat: isSpeaking ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Outer aura rings */}
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={ring}
            className="absolute rounded-full border"
            style={{
              inset: -20 * ring,
              borderColor: isLumis
                ? `rgba(251, 191, 36, ${0.15 / ring})`
                : `rgba(139, 92, 246, ${0.15 / ring})`,
            }}
            animate={{
              scale: isSpeaking ? [1, 1.1, 1] : [1, 1.02, 1],
              opacity: isSpeaking ? [0.3, 0.6, 0.3] : [0.2, 0.3, 0.2],
              rotate: isLumis ? 360 : -360,
            }}
            transition={{
              duration: 8 + ring * 2,
              repeat: Infinity,
              ease: 'linear',
              delay: ring * 0.3,
            }}
          />
        ))}

        {/* Large outer glow */}
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            inset: -40,
            background: isLumis
              ? 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)',
          }}
          animate={{
            opacity: isSpeaking ? [0.5, 1, 0.5] : isActive ? 0.6 : 0.3,
            scale: isSpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Medium glow layer */}
        <motion.div
          className="absolute rounded-full blur-xl"
          style={{
            inset: -10,
            background: isLumis
              ? 'radial-gradient(circle, rgba(254,243,199,0.6) 0%, rgba(251,191,36,0.3) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(221,214,254,0.6) 0%, rgba(139,92,246,0.3) 50%, transparent 70%)',
          }}
          animate={{
            opacity: isSpeaking ? [0.6, 1, 0.6] : 0.5,
            scale: isSpeaking ? [1, 1.15, 1] : [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Main orb body */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: isLumis
              ? 'radial-gradient(circle at 35% 35%, #fffbeb, #fef3c7 30%, #fbbf24 60%, #d97706 85%, #92400e)'
              : 'radial-gradient(circle at 35% 35%, #f5f3ff, #ddd6fe 30%, #8b5cf6 60%, #6d28d9 85%, #4c1d95)',
            boxShadow: isLumis
              ? '0 0 80px rgba(251,191,36,0.8), inset 0 0 60px rgba(255,255,255,0.4), inset -20px -20px 40px rgba(180,83,9,0.3)'
              : '0 0 80px rgba(139,92,246,0.8), inset 0 0 60px rgba(255,255,255,0.4), inset -20px -20px 40px rgba(76,29,149,0.3)',
          }}
          animate={{
            rotate: isLumis ? 360 : -360,
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Inner core - bright center */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: '25%',
            background: isLumis
              ? 'radial-gradient(circle at 40% 40%, #ffffff 0%, #fef9c3 40%, #fde047 100%)'
              : 'radial-gradient(circle at 40% 40%, #ffffff 0%, #e9d5ff 40%, #a78bfa 100%)',
            boxShadow: 'inset 0 0 30px rgba(255,255,255,0.8)',
          }}
          animate={{
            scale: isSpeaking ? [1, 0.92, 1] : [1, 0.98, 1],
            opacity: isSpeaking ? [0.9, 1, 0.9] : 0.95,
          }}
          transition={{
            duration: isSpeaking ? 1 : 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Orbiting particles */}
        {isActive && orbitingParticles.map((p, i) => (
          <motion.div
            key={`orbit-${i}`}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: isLumis
                ? 'radial-gradient(circle, #fef3c7, #fbbf24)'
                : 'radial-gradient(circle, #ddd6fe, #8b5cf6)',
              boxShadow: `0 0 10px ${agent.color}`,
              left: '50%',
              top: '50%',
            }}
            animate={{
              x: [0, 70, 0, -70, 0].map(v => v * Math.cos(i * 0.8)),
              y: [70, 0, -70, 0, 70].map(v => v * Math.sin(i * 0.8)),
              opacity: [0.6, 1, 0.6],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Burst particles when speaking */}
        {isSpeaking && particles.map((p, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: agent.color,
              boxShadow: `0 0 8px ${agent.color}`,
              left: '50%',
              top: '50%',
            }}
            animate={{
              x: [0, Math.cos(p.angle) * p.distance],
              y: [0, Math.sin(p.angle) * p.distance],
              opacity: [1, 0],
              scale: [1.5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Sacred geometry symbol in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative"
            animate={{
              rotate: isLumis ? [0, 360] : [360, 0],
              scale: isSpeaking ? [1, 1.1, 1] : 1,
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
              scale: { duration: 1.5, repeat: isSpeaking ? Infinity : 0 },
            }}
          >
            <span
              className="text-4xl md:text-5xl font-thin"
              style={{
                color: isLumis ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.9)',
                textShadow: `0 0 20px ${agent.color}, 0 0 40px ${agent.color}`,
              }}
            >
              {isLumis ? '☀' : '☾'}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Name and title - enhanced */}
      <div className="text-center">
        <motion.h3
          className="text-2xl md:text-3xl font-bold tracking-[0.2em] uppercase"
          style={{ color: agent.color }}
          animate={{
            textShadow: isSpeaking
              ? [
                  `0 0 20px ${agent.glowColor}, 0 0 40px ${agent.glowColor}`,
                  `0 0 40px ${agent.glowColor}, 0 0 80px ${agent.glowColor}`,
                  `0 0 20px ${agent.glowColor}, 0 0 40px ${agent.glowColor}`,
                ]
              : `0 0 20px ${agent.glowColor}`,
          }}
          transition={{ duration: 1.5, repeat: isSpeaking ? Infinity : 0 }}
        >
          {agent.name}
        </motion.h3>
        <motion.p
          className="text-sm md:text-base text-gray-300 mt-1 tracking-wide"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {agent.title}
        </motion.p>
        <p className="text-xs text-gray-500 mt-2 tracking-widest uppercase">
          {agent.essence}
        </p>
      </div>
    </div>
  );
}
