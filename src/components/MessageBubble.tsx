'use client';

import { motion } from 'framer-motion';
import { DebateMessage } from '@/lib/agents';
import { LUMIS, UMBRA } from '@/lib/agents';

interface MessageBubbleProps {
  message: DebateMessage;
  index: number;
}

export default function MessageBubble({ message, index }: MessageBubbleProps) {
  const isLumis = message.agent === 'lumis';
  const isSynthesis = message.agent === 'synthesis';
  const agent = isLumis ? LUMIS : UMBRA;

  if (isSynthesis) {
    return (
      <motion.div
        className="w-full max-w-2xl mx-auto my-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative p-6 rounded-2xl bg-gradient-to-r from-amber-900/30 via-purple-900/30 to-violet-900/30 border border-amber-500/30">
          {/* Gradient glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/10 to-violet-500/10 blur-xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400">◉</span>
              <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">
                SYNTHESIS
              </span>
              <span className="text-violet-400">◎</span>
            </div>
            <p className="text-gray-200 leading-relaxed italic">
              {message.content}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`flex ${isLumis ? 'justify-start' : 'justify-end'} my-4`}
      initial={{ opacity: 0, x: isLumis ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div
        className={`max-w-md p-4 rounded-2xl ${
          isLumis
            ? 'bg-amber-950/50 border border-amber-500/30 rounded-tl-sm'
            : 'bg-violet-950/50 border border-violet-500/30 rounded-tr-sm'
        }`}
        style={{
          boxShadow: `0 0 20px ${agent.glowColor}`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: agent.color }}>
            {isLumis ? '◉' : '◎'}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: agent.color }}
          >
            {agent.name}
          </span>
        </div>
        <p className="text-gray-200 leading-relaxed text-sm">
          {message.content}
        </p>
      </div>
    </motion.div>
  );
}
