'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebateStore } from '@/store/debate';
import { VIRAL_TOPICS } from '@/lib/agents';

export default function TopicInput() {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [randomTopics, setRandomTopics] = useState<string[]>([]);
  const { setTopic, isDebating } = useDebateStore();

  // Pick random topics on mount
  useEffect(() => {
    const shuffled = [...VIRAL_TOPICS].sort(() => Math.random() - 0.5);
    setRandomTopics(shuffled.slice(0, 6));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isDebating) {
      setTopic(input.trim());
      setInput('');
      setShowSuggestions(false);
    }
  };

  const selectTopic = (topic: string) => {
    setTopic(topic);
    setInput('');
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      {/* Prompt text */}
      <motion.p
        className="text-center text-gray-500 mb-4 text-sm tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Ask anything. Watch two AI minds battle for truth.
      </motion.p>

      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Animated glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-violet-500/20 rounded-2xl blur-xl"
            animate={{
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="relative flex gap-2 p-2 bg-black/60 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="What truth shall we seek today?"
              disabled={isDebating}
              className="flex-1 px-4 py-4 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-lg"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isDebating}
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-violet-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(139,92,246,0.5)' }}
              whileTap={{ scale: 0.98 }}
            >
              {isDebating ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    ✧
                  </motion.span>
                  SEEKING...
                </span>
              ) : (
                'CONSULT'
              )}
            </motion.button>
          </div>
        </div>
      </form>

      {/* Hot topics */}
      <AnimatePresence>
        {showSuggestions && !isDebating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-purple-500/50" />
              <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">Hot Topics</p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-purple-500/50" />
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {randomTopics.map((topic, i) => (
                <motion.button
                  key={i}
                  onClick={() => selectTopic(topic)}
                  className="px-4 py-2 text-sm bg-gray-900/50 text-gray-300 rounded-full border border-gray-800/50 hover:border-purple-500/50 hover:text-purple-300 hover:bg-purple-500/10 transition-all duration-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {topic.length > 45 ? topic.slice(0, 45) + '...' : topic}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
