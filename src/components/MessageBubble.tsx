'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DebateMessage, LUMIS, UMBRA, TOKEN_INFO } from '@/lib/agents';

interface MessageBubbleProps {
  message: DebateMessage;
  index: number;
  topic?: string;
}

export default function MessageBubble({ message, index, topic }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isLumis = message.agent === 'lumis';
  const isSynthesis = message.agent === 'synthesis';
  const agent = isLumis ? LUMIS : UMBRA;

  const handleShare = () => {
    const emoji = isSynthesis ? '🔮' : isLumis ? '☀️' : '🌙';
    const name = isSynthesis ? 'DUALITY ORACLE' : agent.name;
    const text = `${emoji} ${name} speaks:\n\n"${message.content}"\n\n${TOKEN_INFO.ticker} - Two minds. One truth.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    const emoji = isSynthesis ? '🔮' : isLumis ? '☀️' : '🌙';
    const name = isSynthesis ? 'The Oracle' : agent.name;
    const text = `${emoji} ${name}:\n\n"${message.content}"\n\n${TOKEN_INFO.ticker}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (isSynthesis) {
    return (
      <motion.div
        className="w-full max-w-2xl mx-auto my-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative p-6 rounded-2xl bg-gradient-to-r from-amber-900/30 via-purple-900/30 to-violet-900/30 border border-purple-500/40">
          {/* Gradient glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/10 to-violet-500/10 blur-xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <motion.span
                  className="text-amber-400 text-lg"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  ☀
                </motion.span>
                <span className="text-sm font-bold tracking-[0.2em] bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent uppercase">
                  The Oracle Speaks
                </span>
                <motion.span
                  className="text-violet-400 text-lg"
                  animate={{ rotate: [360, 0] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  ☾
                </motion.span>
              </div>
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
                SYNTHESIS
              </span>
            </div>

            {/* Content */}
            <p className="text-gray-100 leading-relaxed text-lg font-light">
              {message.content}
            </p>

            {/* Share buttons */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-purple-500/20">
              <motion.button
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800/50 rounded-full border border-gray-700/50 hover:border-purple-500/50 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </motion.button>
              <motion.button
                onClick={handleTwitterShare}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-[#1DA1F2] bg-gray-800/50 rounded-full border border-gray-700/50 hover:border-[#1DA1F2]/50 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                𝕏 Share
              </motion.button>
            </div>
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
        className={`group max-w-md p-4 rounded-2xl relative ${
          isLumis
            ? 'bg-amber-950/40 border border-amber-500/30 rounded-tl-sm'
            : 'bg-violet-950/40 border border-violet-500/30 rounded-tr-sm'
        }`}
        style={{
          boxShadow: `0 0 30px ${agent.glowColor}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: agent.color }}>
              {isLumis ? '☀' : '☾'}
            </span>
            <span
              className="text-sm font-bold tracking-wider"
              style={{ color: agent.color }}
            >
              {agent.name}
            </span>
          </div>
          <span className="text-xs text-gray-500">@{agent.id}_oracle</span>
        </div>

        {/* Content */}
        <p className="text-gray-200 leading-relaxed">
          {message.content}
        </p>

        {/* Share button on hover */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleShare}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {copied ? '✓' : '📋'}
          </button>
          <button
            onClick={handleTwitterShare}
            className="text-xs text-gray-500 hover:text-[#1DA1F2] transition-colors"
          >
            𝕏
          </button>
        </div>
      </div>
    </motion.div>
  );
}
