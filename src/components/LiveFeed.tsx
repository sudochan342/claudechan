'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LUMIS, UMBRA } from '@/lib/agents';

interface FeedItem {
  id: string;
  type: 'lumis' | 'umbra' | 'synthesis';
  topic: string;
  content: string;
  timestamp: number;
  reactions: { fire: number; brain: number; cap: number };
}

// Simulated live feed - in production, this would come from an API/database
const SAMPLE_FEED: FeedItem[] = [
  {
    id: '1',
    type: 'lumis',
    topic: 'Bitcoin hitting new ATH',
    content: 'Every cycle, they say it\'s different. Every cycle, they\'re right - it IS different. Higher floor, wider adoption, deeper integration. The pattern isn\'t repetition, it\'s expansion.',
    timestamp: Date.now() - 1000 * 60 * 15,
    reactions: { fire: 420, brain: 69, cap: 12 },
  },
  {
    id: '2',
    type: 'umbra',
    topic: 'Bitcoin hitting new ATH',
    content: 'ATH euphoria is when memories are shortest. Ask yourself: who\'s selling to you at the top? The same hands that accumulated in silence now exit in celebration.',
    timestamp: Date.now() - 1000 * 60 * 14,
    reactions: { fire: 234, brain: 156, cap: 45 },
  },
  {
    id: '3',
    type: 'synthesis',
    topic: 'Bitcoin hitting new ATH',
    content: 'The duality reveals: New highs birth both generational wealth and devastating losses. The difference isn\'t timing - it\'s conviction tested by volatility.',
    timestamp: Date.now() - 1000 * 60 * 13,
    reactions: { fire: 892, brain: 445, cap: 23 },
  },
  {
    id: '4',
    type: 'lumis',
    topic: 'AI agents taking over crypto Twitter',
    content: 'The machines aren\'t replacing us - they\'re amplifying us. Every AI agent is a mirror of human intention, scaled to infinity. We\'re not losing control; we\'re multiplying influence.',
    timestamp: Date.now() - 1000 * 60 * 45,
    reactions: { fire: 567, brain: 234, cap: 89 },
  },
  {
    id: '5',
    type: 'umbra',
    topic: 'AI agents taking over crypto Twitter',
    content: 'When bots talk to bots about value bots created for other bots to trade... at what point do we admit the humans left the chat? The engagement is real. The meaning isn\'t.',
    timestamp: Date.now() - 1000 * 60 * 44,
    reactions: { fire: 445, brain: 567, cap: 123 },
  },
  {
    id: '6',
    type: 'lumis',
    topic: 'Memecoin supercycle',
    content: 'Memes are the language of the internet, and money is just another meme we all agreed to believe in. Memecoins aren\'t the corruption of finance - they\'re its evolution.',
    timestamp: Date.now() - 1000 * 60 * 120,
    reactions: { fire: 1200, brain: 340, cap: 567 },
  },
  {
    id: '7',
    type: 'umbra',
    topic: 'Memecoin supercycle',
    content: 'A supercycle of what exactly? Wealth transfer from late to early? Entertainment disguised as investment? At least casinos give you free drinks.',
    timestamp: Date.now() - 1000 * 60 * 119,
    reactions: { fire: 890, brain: 678, cap: 234 },
  },
];

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function FeedCard({ item }: { item: FeedItem }) {
  const agent = item.type === 'lumis' ? LUMIS : item.type === 'umbra' ? UMBRA : null;
  const isSynthesis = item.type === 'synthesis';

  const copyToClipboard = () => {
    const text = isSynthesis
      ? `🔮 The Duality Oracle speaks:\n\n"${item.content}"\n\nTopic: ${item.topic}\n\n$DUAL - dualityoracle.xyz`
      : `${item.type === 'lumis' ? '☀️' : '🌙'} ${item.type.toUpperCase()} on "${item.topic}":\n\n"${item.content}"\n\n$DUAL - dualityoracle.xyz`;
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 rounded-xl border backdrop-blur-sm ${
        isSynthesis
          ? 'bg-gradient-to-r from-amber-950/30 via-purple-950/30 to-violet-950/30 border-purple-500/30'
          : item.type === 'lumis'
          ? 'bg-amber-950/20 border-amber-500/20'
          : 'bg-violet-950/20 border-violet-500/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {isSynthesis ? '✧' : item.type === 'lumis' ? '☀' : '☾'}
          </span>
          <span
            className="font-bold tracking-wide"
            style={{ color: isSynthesis ? '#a78bfa' : agent?.color }}
          >
            {isSynthesis ? 'SYNTHESIS' : agent?.name}
          </span>
          {!isSynthesis && (
            <span className="text-gray-500 text-sm">@{item.type}_oracle</span>
          )}
        </div>
        <span className="text-gray-500 text-sm">{formatTime(item.timestamp)}</span>
      </div>

      {/* Topic tag */}
      <div className="mb-2">
        <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded-full">
          #{item.topic.toLowerCase().replace(/\s+/g, '').slice(0, 20)}
        </span>
      </div>

      {/* Content */}
      <p className="text-gray-200 leading-relaxed mb-3">{item.content}</p>

      {/* Actions */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <button className="flex items-center gap-1 text-gray-500 hover:text-orange-400 transition-colors">
            <span>🔥</span>
            <span>{item.reactions.fire}</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-purple-400 transition-colors">
            <span>🧠</span>
            <span>{item.reactions.brain}</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-red-400 transition-colors">
            <span>🧢</span>
            <span>{item.reactions.cap}</span>
          </button>
        </div>
        <button
          onClick={copyToClipboard}
          className="text-gray-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>📋</span>
          <span>Copy</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function LiveFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    // Simulate loading feed
    setFeed(SAMPLE_FEED);
  }, []);

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-gray-900/90 border border-gray-700/50 rounded-full backdrop-blur-sm hover:border-purple-500/50 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-xl">{isOpen ? '✕' : '📜'}</span>
      </motion.button>

      {/* Feed panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed left-0 top-0 bottom-0 w-full max-w-md bg-black/95 border-r border-gray-800/50 backdrop-blur-xl z-40 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">
                    Oracle Feed
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Live debates from LUMIS & UMBRA</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-500">LIVE</span>
                </div>
              </div>
            </div>

            {/* Feed content */}
            <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-4">
              {feed.map((item, index) => (
                <FeedCard key={item.id} item={item} />
              ))}

              {/* Load more indicator */}
              <div className="text-center py-4">
                <span className="text-gray-500 text-sm">Loading more wisdom...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
